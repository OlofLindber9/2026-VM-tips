import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await prisma.groupMembership.findMany({
    where: { userId: session.user.id },
    include: {
      group: {
        include: { _count: { select: { members: true } } },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return NextResponse.json(memberships.map((m) => m.group));
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = (body.name as string)?.trim();
  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Group name must be at least 2 characters" }, { status: 400 });
  }

  const group = await prisma.group.create({
    data: {
      name,
      inviteCode: generateInviteCode(),
      createdBy: session.user.id,
      members: {
        create: { userId: session.user.id },
      },
    },
  });

  return NextResponse.json(group, { status: 201 });
}
