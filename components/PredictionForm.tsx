"use client";

import { useState } from "react";
import { getResult } from "@/lib/scoring";

interface Team {
  id: string;
  name: string;
}

interface Group {
  id: string;
  name: string;
}

interface ExistingPrediction {
  groupId: string;
  predictedHome: number;
  predictedAway: number;
  score: number | null;
}

interface Props {
  match: {
    id: string;
    homeTeam: Team;
    awayTeam: Team;
    status: string;
  };
  groups: Group[];
  existingPredictions: ExistingPrediction[];
  locked?: boolean;
}

function resultLabel(home: number, away: number): string {
  const r = getResult(home, away);
  if (r === "home") return "Hemmaseger";
  if (r === "away") return "Bortaseger";
  return "Oavgjort";
}

function resultColor(home: number, away: number): string {
  const r = getResult(home, away);
  if (r === "home") return "rgba(52, 211, 153, 0.15)";
  if (r === "away") return "rgba(251, 113, 133, 0.15)";
  return "rgba(251, 191, 36, 0.15)";
}

function resultBorder(home: number, away: number): string {
  const r = getResult(home, away);
  if (r === "home") return "rgba(52, 211, 153, 0.35)";
  if (r === "away") return "rgba(251, 113, 133, 0.35)";
  return "rgba(251, 191, 36, 0.35)";
}

function resultTextColor(home: number, away: number): string {
  const r = getResult(home, away);
  if (r === "home") return "rgb(110, 231, 183)";
  if (r === "away") return "rgb(253, 164, 175)";
  return "rgb(253, 224, 71)";
}

export default function PredictionForm({
  match,
  groups,
  existingPredictions,
  locked = false,
}: Props) {
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.id || "");

  const getInitial = (groupId: string) =>
    existingPredictions.find((p) => p.groupId === groupId);

  const initial = getInitial(groups[0]?.id || "");
  const [homeVal, setHomeVal] = useState(initial?.predictedHome ?? 0);
  const [awayVal, setAwayVal] = useState(initial?.predictedAway ?? 0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const isCompleted = match.status === "completed";
  const isLocked = isCompleted || locked;
  const existing = getInitial(selectedGroup);

  function handleGroupChange(groupId: string) {
    setSelectedGroup(groupId);
    const pred = getInitial(groupId);
    setHomeVal(pred?.predictedHome ?? 0);
    setAwayVal(pred?.predictedAway ?? 0);
    setSuccess(false);
    setError("");
  }

  function clamp(val: number) {
    return Math.max(0, Math.min(99, val));
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId: match.id,
        groupId: selectedGroup,
        predictedHome: homeVal,
        predictedAway: awayVal,
      }),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Något gick fel");
    } else {
      setSuccess(true);
    }
  }

  return (
    <div
      className="glass-card space-y-5"
      style={existing && !isLocked ? { borderColor: "rgba(52, 211, 153, 0.35)" } : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-white">
            {isLocked || existing ? "Ditt tips" : "Lägg ditt tips"}
          </h2>
          {existing && !isLocked && (
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border"
              style={{
                background: "rgba(52, 211, 153, 0.12)",
                borderColor: "rgba(52, 211, 153, 0.3)",
                color: "rgb(110, 231, 183)",
              }}
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Sparat
            </span>
          )}
        </div>
        {existing?.score !== null && existing?.score !== undefined && (
          <span className="text-app-accent font-bold text-lg">{existing.score} pts</span>
        )}
      </div>

      {/* Group selector */}
      {groups.length > 1 && (
        <div>
          <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-1.5">
            Grupp
          </label>
          <select
            value={selectedGroup}
            onChange={(e) => handleGroupChange(e.target.value)}
            className="select-dark"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Locked view */}
      {isLocked && existing ? (
        <div className="space-y-3">
          <div
            className="flex items-center justify-center gap-4 p-4 rounded-xl border"
            style={{
              background: resultColor(existing.predictedHome, existing.predictedAway),
              borderColor: resultBorder(existing.predictedHome, existing.predictedAway),
            }}
          >
            <span className="font-semibold text-white/80 text-right flex-1">{match.homeTeam.name}</span>
            <span
              className="text-3xl font-black tabular-nums"
              style={{ color: resultTextColor(existing.predictedHome, existing.predictedAway) }}
            >
              {existing.predictedHome} – {existing.predictedAway}
            </span>
            <span className="font-semibold text-white/80 text-left flex-1">{match.awayTeam.name}</span>
          </div>
          <p className="text-center text-sm font-medium" style={{ color: resultTextColor(existing.predictedHome, existing.predictedAway) }}>
            {resultLabel(existing.predictedHome, existing.predictedAway)}
          </p>
        </div>
      ) : isLocked ? (
        <p className="text-sm text-white/40 text-center py-4">
          Tipsningen är stängd för den här matchen.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Score input */}
          <div>
            <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
              Tippa slutresultat
            </label>
            <div className="flex items-center gap-3">
              {/* Home team */}
              <div className="flex-1 text-right">
                <p className="text-sm font-semibold text-white/80 mb-2 truncate">{match.homeTeam.name}</p>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={homeVal}
                  onChange={(e) => setHomeVal(clamp(parseInt(e.target.value) || 0))}
                  className="w-full text-center text-3xl font-black tabular-nums rounded-xl px-3 py-3 transition-all duration-150 outline-none focus:ring-2"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "white",
                  }}
                />
              </div>

              {/* Dash */}
              <span className="text-2xl font-black text-white/30 mt-7">–</span>

              {/* Away team */}
              <div className="flex-1 text-left">
                <p className="text-sm font-semibold text-white/80 mb-2 truncate">{match.awayTeam.name}</p>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={awayVal}
                  onChange={(e) => setAwayVal(clamp(parseInt(e.target.value) || 0))}
                  className="w-full text-center text-3xl font-black tabular-nums rounded-xl px-3 py-3 transition-all duration-150 outline-none focus:ring-2"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "white",
                  }}
                />
              </div>
            </div>

            {/* Live result indicator */}
            <div
              className="mt-3 text-center text-xs font-bold uppercase tracking-wider py-1.5 rounded-lg transition-all duration-200"
              style={{
                background: resultColor(homeVal, awayVal),
                color: resultTextColor(homeVal, awayVal),
              }}
            >
              {resultLabel(homeVal, awayVal)}
            </div>
          </div>

          {/* Current saved tip indicator */}
          {existing && (
            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(52, 211, 153, 0.06)", border: "1px solid rgba(52, 211, 153, 0.2)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(110, 231, 183, 0.65)" }}>
                Nuvarande tips
              </p>
              <p className="text-sm text-white/80">
                {match.homeTeam.name}{" "}
                <span className="font-bold text-white">{existing.predictedHome} – {existing.predictedAway}</span>{" "}
                {match.awayTeam.name}
              </p>
              <p className="text-xs text-white/30 mt-0.5">Använd formuläret ovan för att ändra</p>
            </div>
          )}

          {error && (
            <div className="text-red-300 text-sm bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}
          {success && (
            <div className="text-emerald-300 text-sm bg-emerald-900/30 border border-emerald-500/30 rounded-xl px-4 py-2.5">
              Tipset är sparat!
            </div>
          )}

          <button type="submit" disabled={loading || isLocked} className="btn-primary w-full">
            {loading ? "Sparar…" : existing ? "Uppdatera tips" : "Skicka tips"}
          </button>
        </form>
      )}
    </div>
  );
}
