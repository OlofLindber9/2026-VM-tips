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
      className="min-h-screen flex flex-col overflow-x-hidden"
      style={{
        background: "linear-gradient(160deg, #050e1a 0%, #0d1f35 45%, #1a3a5c 100%)",
      }}
    >
      {/* Athlete background image */}
      <div
        className="fixed inset-0 pointer-events-none mix-blend-luminosity"
        style={{
          backgroundImage: "url('/images/Ebba.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.25,
          zIndex: 0,
        }}
      />

      {/* Dark gradient overlay — keeps content readable */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(5,14,26,0.55) 0%, rgba(5,14,26,0.2) 45%, rgba(5,14,26,0.75) 100%)",
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
