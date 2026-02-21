import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// POST /api/profile — upsert profile for current user (called after sign-up/sign-in)
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const displayName =
    (user.user_metadata?.username as string) ||
    user.email?.split("@")[0] ||
    "Skier";

  const profile = await prisma.profile.upsert({
    where: { id: user.id },
    update: { displayName, email: user.email! },
    create: { id: user.id, displayName, email: user.email! },
  });

  return NextResponse.json(profile);
}
