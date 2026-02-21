import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// POST /api/predictions — submit or update a prediction
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { raceId, groupId, first, second, third } = body;

  if (!raceId || !groupId || !first || !second || !third) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (first === second || first === third || second === third) {
    return NextResponse.json({ error: "Each podium position must be a different athlete" }, { status: 400 });
  }

  // Verify race is still upcoming
  const race = await prisma.race.findUnique({ where: { id: raceId } });
  if (!race) return NextResponse.json({ error: "Race not found" }, { status: 404 });
  if (race.status === "completed") {
    return NextResponse.json({ error: "Predictions are closed — race has finished" }, { status: 403 });
  }

  // Verify user is a member of the group
  const membership = await prisma.groupMembership.findUnique({
    where: { userId_groupId: { userId: user.id, groupId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "You are not a member of this group" }, { status: 403 });
  }

  const prediction = await prisma.prediction.upsert({
    where: { userId_raceId_groupId: { userId: user.id, raceId, groupId } },
    update: { first, second, third, score: null },
    create: { userId: user.id, raceId, groupId, first, second, third },
  });

  return NextResponse.json(prediction);
}
