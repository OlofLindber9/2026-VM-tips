import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const displayName =
    (user.user_metadata?.username as string) || user.email?.split("@")[0] || "Skier";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(180deg, #e8f2fb 0%, #f0f4f8 40%, #f7f9fc 100%)",
      }}
    >
      {/*
       * Athlete image in the app background — place a wide landscape photo at:
       *   public/images/app-bg.jpg
       * A subtle alpine scene works great here (forests, mountains, snow).
       */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: "url('/images/app-bg.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.06,
          zIndex: 0,
        }}
      />

      <NavBar user={{ email: user.email!, displayName }} />

      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {children}
      </main>
    </div>
  );
}
