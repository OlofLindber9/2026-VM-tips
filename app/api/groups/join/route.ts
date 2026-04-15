import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const inviteCode = (body.inviteCode as string)?.trim().toUpperCase();
  if (!inviteCode) {
    return NextResponse.json({ error: "Invite code is required" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { inviteCode } });
  if (!group) {
    return NextResponse.json({ error: "Invalid invite code" }, { status: 404 });
  }

  const existing = await prisma.groupMembership.findUnique({
    where: { userId_groupId: { userId: session.user!.id as string, groupId: group.id } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already a member" }, { status: 409 });
  }

  await prisma.groupMembership.create({
    data: { userId: session.user!.id as string, groupId: group.id },
  });

  return NextResponse.json(group);
}
