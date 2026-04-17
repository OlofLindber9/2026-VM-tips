import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const KNOCKOUT_STAGES = new Set(["r32", "r16", "qf", "sf", "3p", "final"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { matchId, groupId, predictedHome, predictedAway, predictedWinner } = body;

  if (!matchId || !groupId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const userId = session.user!.id as string;

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.status === "live" || match.status === "completed") {
    return NextResponse.json({ error: "Tipsningen är stängd — matchen har startat" }, { status: 403 });
  }
  if (match.stage === "group" && new Date() >= new Date("2026-06-11T00:00:00Z")) {
    return NextResponse.json({ error: "Tipsningen för gruppspelet är stängd — VM har börjat" }, { status: 403 });
  }

  const isKnockout = KNOCKOUT_STAGES.has(match.stage);
  const isFinal = match.stage === "final";
  const isGroup = match.stage === "group";

  // Validate fields per stage
  if (isGroup) {
    if (predictedHome === undefined || predictedAway === undefined) {
      return NextResponse.json({ error: "Ange ett resultat för gruppspelsmatchen" }, { status: 400 });
    }
    const home = Number(predictedHome);
    const away = Number(predictedAway);
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 99 || away > 99) {
      return NextResponse.json({ error: "Resultatet måste vara ett heltal mellan 0 och 99" }, { status: 400 });
    }
  } else if (isFinal) {
    if (predictedHome === undefined || predictedAway === undefined || !predictedWinner) {
      return NextResponse.json({ error: "Ange resultat efter 90 min och vem som vinner finalen" }, { status: 400 });
    }
    const home = Number(predictedHome);
    const away = Number(predictedAway);
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 99 || away > 99) {
      return NextResponse.json({ error: "Resultatet måste vara ett heltal mellan 0 och 99" }, { status: 400 });
    }
    if (predictedWinner !== "home" && predictedWinner !== "away") {
      return NextResponse.json({ error: "Ogiltig vinnare" }, { status: 400 });
    }
  } else if (isKnockout) {
    if (!predictedWinner) {
      return NextResponse.json({ error: "Välj vem du tror vinner matchen" }, { status: 400 });
    }
    if (predictedWinner !== "home" && predictedWinner !== "away") {
      return NextResponse.json({ error: "Ogiltig vinnare" }, { status: 400 });
    }
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { userId_groupId: { userId: userId, groupId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Du är inte med i den här gruppen" }, { status: 403 });
  }

  // Build upsert data based on stage
  let createData: {
    userId: string;
    matchId: string;
    groupId: string;
    predictedHome?: number | null;
    predictedAway?: number | null;
    predictedWinner?: string | null;
  };
  let updateData: {
    predictedHome?: number | null;
    predictedAway?: number | null;
    predictedWinner?: string | null;
    score: null;
  };

  if (isGroup) {
    const home = Number(predictedHome);
    const away = Number(predictedAway);
    createData = { userId: userId, matchId, groupId, predictedHome: home, predictedAway: away, predictedWinner: null };
    updateData = { predictedHome: home, predictedAway: away, predictedWinner: null, score: null };
  } else if (isFinal) {
    const home = Number(predictedHome);
    const away = Number(predictedAway);
    createData = { userId: userId, matchId, groupId, predictedHome: home, predictedAway: away, predictedWinner };
    updateData = { predictedHome: home, predictedAway: away, predictedWinner, score: null };
  } else {
    // Knockout non-final — no score, just winner
    createData = { userId: userId, matchId, groupId, predictedHome: null, predictedAway: null, predictedWinner };
    updateData = { predictedHome: null, predictedAway: null, predictedWinner, score: null };
  }

  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId_groupId: { userId: userId, matchId, groupId } },
    update: updateData,
    create: createData,
  });

  return NextResponse.json(prediction);
}
