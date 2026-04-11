import { auth } from "@/auth";
import { redirect } from "next/navigation";
import NavBar from "@/components/NavBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const displayName = session.user?.name || session.user?.email?.split("@")[0] || "Spelare";

  return (
    <div
      className="min-h-screen flex flex-col overflow-x-hidden"
      style={{
        background: "linear-gradient(160deg, #040d08 0%, #091a10 45%, #0f2d1a 100%)",
      }}
    >
      {/* Subtle horizontal pitch lines */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 80px,
            rgba(255,255,255,0.5) 80px,
            rgba(255,255,255,0.5) 81px
          )`,
          zIndex: 0,
        }}
      />

      {/* Dark gradient overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(4,13,8,0.45) 0%, rgba(4,13,8,0.1) 45%, rgba(4,13,8,0.65) 100%)",
          zIndex: 0,
        }}
      />

      <NavBar user={{ email: session.user?.email!, displayName }} />

      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {children}
      </main>
    </div>
  );
}
