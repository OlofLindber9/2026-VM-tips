"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateGroupPage() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setError("Group name must be at least 2 characters.");
      return;
    }
    setLoading(true);
    setError("");

    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Failed to create group");
    } else {
      router.push(`/groups/${data.id}`);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <Link href="/groups" className="text-ski-ice text-sm hover:text-white transition-colors">← Back to groups</Link>
        <h1 className="text-2xl font-bold text-white mt-2">Create a group</h1>
        <p className="text-white/50 text-sm mt-1">
          Once created, you will get an invite code to share with friends.
        </p>
      </div>

      <div className="glass-card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">Group name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="input-dark"
              placeholder="e.g. Office Ski Gang"
            />
          </div>

          {error && (
            <div className="text-red-300 text-sm bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-2.5">{error}</div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating…" : "Create group"}
          </button>
        </form>
      </div>
    </div>
  );
}
