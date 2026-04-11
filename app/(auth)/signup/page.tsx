"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    // Auto sign-in after account creation
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Account created but login failed — please log in manually");
      setLoading(false);
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <div className="page-dark">
      {/* Gold top accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: "linear-gradient(90deg, transparent, #e8a020 30%, #f5c842 60%, transparent)",
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <Link
          href="/"
          className="absolute top-5 left-5 text-white/40 hover:text-white/70 text-sm font-medium transition-colors"
        >
          ← Home
        </Link>

        <div className="glass-card w-full max-w-sm animate-scale-in">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🏆</div>
            <h1
              className="text-white text-3xl font-black uppercase"
              style={{ fontFamily: "var(--font-barlow), 'Barlow Condensed', sans-serif" }}
            >
              Join the game
            </h1>
            <p className="text-white/45 text-sm mt-1">Create your free account</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Display name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-dark"
                placeholder="YourName42"
              />
            </div>
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-dark"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-dark"
                placeholder="At least 6 characters"
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
              className="w-full py-3 rounded-xl font-bold text-app-midnight text-sm tracking-wide transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
              style={{
                background: loading
                  ? "rgba(232,160,32,0.5)"
                  : "linear-gradient(135deg, #f5c842, #e8a020)",
                fontFamily: "var(--font-barlow), sans-serif",
                letterSpacing: "0.05em",
              }}
            >
              {loading ? "Creating account…" : "CREATE ACCOUNT"}
            </button>
          </form>

          <p className="text-center text-white/35 text-sm mt-5">
            Already have an account?{" "}
            <Link href="/login" className="text-app-accent hover:text-app-gold font-semibold transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
