"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function JoinGroupPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");

    const res = await fetch("/api/groups/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: code.trim() }),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Kunde inte gå med i gruppen");
    } else {
      router.push(`/groups/${data.id}`);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <Link href="/groups" className="text-app-ice text-sm hover:text-white transition-colors">← Tillbaka till grupper</Link>
        <h1 className="text-2xl font-bold text-white mt-2">Gå med i en grupp</h1>
        <p className="text-white/50 text-sm mt-1">
          Ange den 8-siffriga inbjudningskoden som din vän delade med dig.
        </p>
      </div>

      <div className="glass-card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">Inbjudningskod</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={12}
              className="input-dark font-mono uppercase tracking-widest"
              placeholder="ABCD1234"
            />
          </div>

          {error && (
            <div className="text-red-300 text-sm bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-2.5">{error}</div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Går med…" : "Gå med i grupp"}
          </button>
        </form>
      </div>
    </div>
  );
}
