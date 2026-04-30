import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const KNOCKOUT_STAGES = new Set(["r32", "r16", "qf", "sf", "3p", "final"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { matchId, groupId, predictedHome, predictedAway, predictedWinnerTeamId } = body;

  if (!matchId || !groupId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const userId = session.user!.id as string;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: { homeTeam: true, awayTeam: true },
  });
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
    if (predictedHome === undefined || predictedAway === undefined || !predictedWinnerTeamId) {
      return NextResponse.json({ error: "Ange resultat efter 90 min och vilket lag som vinner finalen" }, { status: 400 });
    }
    const home = Number(predictedHome);
    const away = Number(predictedAway);
    if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 99 || away > 99) {
      return NextResponse.json({ error: "Resultatet måste vara ett heltal mellan 0 och 99" }, { status: 400 });
    }
    if (typeof predictedWinnerTeamId !== "string" || predictedWinnerTeamId.length === 0) {
      return NextResponse.json({ error: "Ogiltigt vinnande lag" }, { status: 400 });
    }
  } else if (isKnockout) {
    if (!predictedWinnerTeamId) {
      return NextResponse.json({ error: "Välj vilket lag du tror vinner matchen" }, { status: 400 });
    }
    if (typeof predictedWinnerTeamId !== "string" || predictedWinnerTeamId.length === 0) {
      return NextResponse.json({ error: "Ogiltigt vinnande lag" }, { status: 400 });
    }
  }

  // Knockout: ensure the picked team actually exists in the tournament.
  // We accept any real team (cascading penalty handles the rest at scoring time).
  if (isKnockout && predictedWinnerTeamId) {
    const team = await prisma.team.findUnique({ where: { id: predictedWinnerTeamId } });
    if (!team) {
      return NextResponse.json({ error: "Okänt lag" }, { status: 400 });
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
    predictedWinnerTeamId?: string | null;
  };
  let updateData: {
    predictedHome?: number | null;
    predictedAway?: number | null;
    predictedWinner?: string | null;
    predictedWinnerTeamId?: string | null;
    score: null;
  };

  if (isGroup) {
    const home = Number(predictedHome);
    const away = Number(predictedAway);
    createData = {
      userId, matchId, groupId,
      predictedHome: home, predictedAway: away,
      predictedWinner: null, predictedWinnerTeamId: null,
    };
    updateData = {
      predictedHome: home, predictedAway: away,
      predictedWinner: null, predictedWinnerTeamId: null,
      score: null,
    };
  } else if (isFinal) {
    const home = Number(predictedHome);
    const away = Number(predictedAway);
    createData = {
      userId, matchId, groupId,
      predictedHome: home, predictedAway: away,
      predictedWinner: null, predictedWinnerTeamId,
    };
    updateData = {
      predictedHome: home, predictedAway: away,
      predictedWinner: null, predictedWinnerTeamId,
      score: null,
    };
  } else {
    // Knockout non-final — team ID only
    createData = {
      userId, matchId, groupId,
      predictedHome: null, predictedAway: null,
      predictedWinner: null, predictedWinnerTeamId,
    };
    updateData = {
      predictedHome: null, predictedAway: null,
      predictedWinner: null, predictedWinnerTeamId,
      score: null,
    };
  }

  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId_groupId: { userId, matchId, groupId } },
    update: updateData,
    create: createData,
  });

  return NextResponse.json(prediction);
}
