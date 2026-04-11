import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { raceId, groupId, first, second, third } = body;

  if (!raceId || !groupId || !first || !second || !third) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (first === second || first === third || second === third) {
    return NextResponse.json({ error: "Each podium position must be a different athlete" }, { status: 400 });
  }

  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) return NextResponse.json({ error: "Race not found" }, { status: 404 });
  if (race.status === "completed") {
    return NextResponse.json({ error: "Predictions are closed — race has finished" }, { status: 403 });
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this group" }, { status: 403 });
  }

  const prediction = await prisma.prediction.upsert({
    where: { userId_raceId_groupId: { userId: session.user.id, raceId, groupId } },
    update: { first, second, third, score: null },
    create: { userId: session.user.id, raceId, groupId, first, second, third },
  });

  return NextResponse.json(prediction);
}
