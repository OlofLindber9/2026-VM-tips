"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Fel e-postadress eller lösenord");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="page-dark">
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, transparent, #e8a020 30%, #f5c842 60%, transparent)",
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <Link
          href="/"
          className="absolute top-5 left-5 text-white/40 hover:text-white/70 text-sm font-medium transition-colors flex items-center gap-1"
        >
          ← Hem
        </Link>

        <div className="glass-card w-full max-w-sm animate-scale-in">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">⚽</div>
            <h1
              className="text-white text-3xl font-black uppercase"
              style={{ fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif" }}
            >
              Välkommen tillbaka
            </h1>
            <p className="text-white/45 text-sm mt-1">Logga in på 2026 VM-tips</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">
                E-post
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-dark"
                placeholder="du@exempel.se"
              />
            </div>
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Lösenord
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dark"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-red-300 text-sm bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-2.5">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-app-midnight text-sm tracking-wide transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading
                  ? "rgba(232,160,32,0.5)"
                  : "linear-gradient(135deg, #f5c842, #e8a020)",
                fontFamily: "var(--font-barlow), sans-serif",
                letterSpacing: "0.05em",
              }}
            >
              {loading ? "Loggar in…" : "LOGGA IN"}
            </button>
          </form>

          <p className="text-center text-white/35 text-sm mt-5">
            Inget konto?{" "}
            <Link href="/signup" className="text-app-accent hover:text-app-gold font-semibold transition-colors">
              Skapa ett
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
