import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase(); // 8 hex chars
}

// GET /api/groups — list groups the current user belongs to
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await prisma.groupMembership.findMany({
    where: { userId: user.id },
    include: {
      group: {
        include: {
          _count: { select: { members: true } },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return NextResponse.json(memberships.map((m) => m.group));
}

// POST /api/groups — create a new group
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const name = (body.name as string)?.trim();
  if (!name || name.length < 2) {
    return NextResponse.json({ error: "Group name must be at least 2 characters" }, { status: 400 });
  }

  const inviteCode = generateInviteCode();

  const group = await prisma.group.create({
    data: {
      name,
      inviteCode,
      createdBy: user.id,
      members: {
        create: { userId: user.id },
      },
    },
  });

  return NextResponse.json(group, { status: 201 });
}
