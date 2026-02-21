import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #1a3a5c 0%, #2d6a9f 60%, #e8a020 100%)" }}>
      <div className="text-center max-w-xl">
        <div className="text-6xl mb-4">⛷️</div>
        <h1 className="text-4xl font-bold text-white mb-3">Ski Predictor</h1>
        <p className="text-blue-100 text-lg mb-8">
          Compete with your friends by predicting the podiums of the FIS
          Cross-Country World Cup. 3 points for the winner, plus 1 for every
          correct podium athlete.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/signup" className="bg-white text-ski-blue font-bold px-6 py-3 rounded-xl hover:bg-blue-50 transition-colors">
            Get started
          </Link>
          <Link href="/login" className="border border-white text-white font-bold px-6 py-3 rounded-xl hover:bg-white/10 transition-colors">
            Log in
          </Link>
        </div>
      </div>

      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl w-full text-white text-center">
        {[
          { icon: "🏆", title: "Create a group", desc: "Invite your friends with a short code" },
          { icon: "📋", title: "Make predictions", desc: "Pick the top 3 before each race starts" },
          { icon: "📊", title: "Track the standings", desc: "Compete on the leaderboard all season" },
        ].map((f) => (
          <div key={f.title} className="bg-white/10 rounded-xl p-5 backdrop-blur">
            <div className="text-3xl mb-2">{f.icon}</div>
            <div className="font-semibold mb-1">{f.title}</div>
            <div className="text-blue-100 text-sm">{f.desc}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
