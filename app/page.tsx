import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="page-dark relative overflow-hidden">
      {/* Gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to bottom, rgba(5,14,26,0.6) 0%, rgba(5,14,26,0.25) 45%, rgba(5,14,26,0.88) 100%)",
        }}
      />

      {/* Gold accent top bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, transparent, #e8a020 30%, #f5c842 60%, transparent)",
        }}
      />

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col min-h-screen px-4">
        {/* Top nav strip */}
        <div className="flex justify-between items-center max-w-5xl mx-auto w-full py-5">
          <span className="text-white/60 font-bold tracking-widest text-xs uppercase">
            &nbsp;&nbsp;VM 2026
          </span>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-white/60 hover:text-white text-sm font-semibold transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="btn-ghost text-sm px-4 py-1.5 rounded-xl"
            >
              Sign up free
            </Link>
          </div>
        </div>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center text-center max-w-3xl mx-auto w-full pb-12">
          {/* Season chip */}
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-app-accent/40 text-app-accent text-xs font-bold tracking-widest uppercase mb-8 animate-slide-down"
            style={{ background: "rgba(232,160,32,0.1)" }}
          >
            &nbsp;&nbsp;World Cup 2026
          </div>

          {/* Title */}
          <h1
            className="text-white uppercase leading-none mb-5 animate-fade-in"
            style={{
              fontFamily: "var(--font-barlow), 'Barlow Condensed', Impact, sans-serif",
              fontSize: "clamp(4.5rem, 13vw, 9.5rem)",
              fontWeight: 900,
              letterSpacing: "-0.025em",
            }}
          >
            <span className="gradient-text-light">VM</span>
            <br />
            Predictor
          </h1>

          {/* Subtitle */}
          <p
            className="text-app-ice/75 text-lg sm:text-xl max-w-lg mx-auto mb-10 anim-ready animate-slide-up"
          >
            Challenge your friends. Predict the results. Conquer the{" "}
            <span className="text-app-accent font-semibold">World Cup 2026</span>.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-4 justify-center anim-ready animate-slide-up-1">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 font-bold px-8 py-3.5 rounded-2xl text-app-midnight text-base shadow-2xl transition-all duration-200 hover:-translate-y-1 animate-pulse-gold"
              style={{
                background: "linear-gradient(135deg, #f5c842, #e8a020)",
                fontFamily: "var(--font-barlow), sans-serif",
                letterSpacing: "0.02em",
              }}
            >
              Get started →
            </Link>
            <Link href="/login" className="btn-ghost px-8 py-3.5 text-base rounded-2xl">
              Log in
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 py-4 text-center text-white/25 text-xs flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <span>VM Predictor 2026</span>
          <a
            href="mailto:ololin0725@gmail.com?subject=VM%20Predictor%20Feedback"
            className="text-white/35 hover:text-app-accent transition-colors"
          >
            Got any feedback? →
          </a>
        </div>
      </div>
    </main>
  );
}
