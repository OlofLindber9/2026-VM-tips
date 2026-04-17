import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

async function assertMember(groupId: string, userId: string) {
  const membership = await prisma.groupMembership.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  return !!membership;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  if (!(await assertMember(groupId, userId)))
    return NextResponse.json({ error: "Ingen åtkomst" }, { status: 403 });

  const messages = await prisma.chatMessage.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });

  // Resolve display names
  const userIds = [...new Set(messages.map((m) => m.userId))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.displayName]));

  return NextResponse.json(
    messages.map((m) => ({
      id: m.id,
      userId: m.userId,
      displayName: userMap[m.userId] ?? "Deltagare",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }))
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: groupId } = await params;
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  if (!userId) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  if (!(await assertMember(groupId, userId)))
    return NextResponse.json({ error: "Ingen åtkomst" }, { status: 403 });

  const body = await req.json();
  const content: string = (body?.content ?? "").trim();
  if (!content || content.length > 4000)
    return NextResponse.json({ error: "Ogiltigt meddelande" }, { status: 400 });

  const message = await prisma.chatMessage.create({
    data: { groupId, userId, content },
  });

  const user = await prisma.user.findUnique({ where: { id: userId } });

  return NextResponse.json({
    id: message.id,
    userId: message.userId,
    displayName: user?.displayName ?? "Deltagare",
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  });
}
