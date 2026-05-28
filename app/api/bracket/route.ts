import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getBracket } from "@/lib/bracket";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/bracket?groupId=xxx
 *
 * Returns the full knockout tree, optionally annotated with the current
 * user's predictions (and their cascade status) for the given group.
 *
 * Response: { rounds: { r32: [...], r16: [...], qf: [...], sf: [...], "3p": [...], final: [...] },
 *             userPointsAwarded, userPointsAtRisk, userPointsLost }
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get("groupId") ?? undefined;
  const userId = session.user!.id as string;

  if (groupId) {
    const membership = await prisma.groupMembership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const bracket = await getBracket(userId, groupId);
  return NextResponse.json(bracket);
}
