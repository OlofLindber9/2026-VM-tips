import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
    // Upsert profile after email confirmation
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const displayName =
        (user.user_metadata?.username as string) ||
        user.email?.split("@")[0] ||
        "Skier";
      await prisma.profile.upsert({
        where: { id: user.id },
        update: { displayName, email: user.email! },
        create: { id: user.id, displayName, email: user.email! },
      });
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
