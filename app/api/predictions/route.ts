import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { matchId, groupId, predictedHome, predictedAway } = body;

  if (!matchId || !groupId || predictedHome === undefined || predictedAway === undefined) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const home = Number(predictedHome);
  const away = Number(predictedAway);

  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0 || home > 99 || away > 99) {
    return NextResponse.json({ error: "Score must be a whole number between 0 and 99" }, { status: 400 });
  }

  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });
  if (match.status === "live" || match.status === "completed") {
    return NextResponse.json({ error: "Predictions are closed — match has started" }, { status: 403 });
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this group" }, { status: 403 });
  }

  const prediction = await prisma.prediction.upsert({
    where: { userId_matchId_groupId: { userId: session.user.id, matchId, groupId } },
    update: { predictedHome: home, predictedAway: away, score: null },
    create: { userId: session.user.id, matchId, groupId, predictedHome: home, predictedAway: away },
  });

  return NextResponse.json(prediction);
}
