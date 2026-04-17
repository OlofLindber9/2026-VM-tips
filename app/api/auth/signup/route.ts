import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = await request.json();
  const email = (body.email as string)?.trim().toLowerCase();
  const password = body.password as string;
  const displayName = (body.displayName as string)?.trim();

  if (!email || !password || !displayName) {
    return NextResponse.json({ error: "Alla fält är obligatoriska" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Ogiltig e-postadress" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Lösenordet måste vara minst 6 tecken" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "E-postadressen används redan" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, password: hashed, displayName },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
