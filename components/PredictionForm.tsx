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
  predictedHome: number | null;
  predictedAway: number | null;
  predictedWinner: string | null;
  score: number | null;
}

interface Props {
  match: {
    id: string;
    homeTeam: Team;
    awayTeam: Team;
    status: string;
    stage: string;
  };
  groups: Group[];
  existingPredictions: ExistingPrediction[];
  locked?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const WINNER_COLORS = {
  home: {
    bg: "rgba(52, 211, 153, 0.15)",
    border: "rgba(52, 211, 153, 0.35)",
    text: "rgb(110, 231, 183)",
  },
  away: {
    bg: "rgba(251, 113, 133, 0.15)",
    border: "rgba(251, 113, 133, 0.35)",
    text: "rgb(253, 164, 175)",
  },
};

const MAX_PTS: Record<string, string> = {
  group: "3 p",
  r32: "2 p",
  r16: "2 p",
  qf: "2 p",
  sf: "2 p",
  "3p": "2 p",
  final: "5 p",
};

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function ScoreInput({
  homeTeamName,
  awayTeamName,
  homeVal,
  awayVal,
  onHomeChange,
  onAwayChange,
}: {
  homeTeamName: string;
  awayTeamName: string;
  homeVal: number;
  awayVal: number;
  onHomeChange: (v: number) => void;
  onAwayChange: (v: number) => void;
}) {
  function clamp(val: number) {
    return Math.max(0, Math.min(99, val));
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex-1 text-right">
          <p className="text-sm font-semibold text-white/80 mb-2 truncate">{homeTeamName}</p>
          <input
            type="number"
            min={0}
            max={99}
            value={homeVal}
            onChange={(e) => onHomeChange(clamp(parseInt(e.target.value) || 0))}
            className="w-full text-center text-3xl font-black tabular-nums rounded-xl px-3 py-3 transition-all duration-150 outline-none focus:ring-2"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "white",
            }}
          />
        </div>
        <span className="text-2xl font-black text-white/30 mt-7">–</span>
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-white/80 mb-2 truncate">{awayTeamName}</p>
          <input
            type="number"
            min={0}
            max={99}
            value={awayVal}
            onChange={(e) => onAwayChange(clamp(parseInt(e.target.value) || 0))}
            className="w-full text-center text-3xl font-black tabular-nums rounded-xl px-3 py-3 transition-all duration-150 outline-none focus:ring-2"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "white",
            }}
          />
        </div>
      </div>
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
  );
}

function WinnerToggle({
  homeTeamName,
  awayTeamName,
  selected,
  onSelect,
}: {
  homeTeamName: string;
  awayTeamName: string;
  selected: string | null;
  onSelect: (v: "home" | "away") => void;
}) {
  return (
    <div className="flex gap-3">
      {(["home", "away"] as const).map((side) => {
        const teamName = side === "home" ? homeTeamName : awayTeamName;
        const isSelected = selected === side;
        const colors = WINNER_COLORS[side];
        return (
          <button
            key={side}
            type="button"
            onClick={() => onSelect(side)}
            className="flex-1 py-4 px-3 rounded-xl font-bold text-sm transition-all duration-150 text-center border-2"
            style={
              isSelected
                ? { background: colors.bg, borderColor: colors.border, color: colors.text }
                : {
                    background: "rgba(255,255,255,0.04)",
                    borderColor: "rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.5)",
                  }
            }
          >
            {teamName}
            {isSelected && (
              <span className="block text-[10px] font-black uppercase tracking-widest mt-1 opacity-75">
                Vinnare
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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
  const [winnerVal, setWinnerVal] = useState<string | null>(initial?.predictedWinner ?? null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const isCompleted = match.status === "completed";
  const isLocked = isCompleted || locked;
  const existing = getInitial(selectedGroup);

  const isGroup = match.stage === "group";
  const isFinal = match.stage === "final";
  const isKnockout = !isGroup; // r32 / r16 / qf / sf / 3p / final
  const isTeamTBD = match.homeTeam.id === "TBD" || match.awayTeam.id === "TBD";

  function handleGroupChange(groupId: string) {
    setSelectedGroup(groupId);
    const pred = getInitial(groupId);
    setHomeVal(pred?.predictedHome ?? 0);
    setAwayVal(pred?.predictedAway ?? 0);
    setWinnerVal(pred?.predictedWinner ?? null);
    setSuccess(false);
    setError("");
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    // Validate winner selection for knockout
    if (isKnockout && !winnerVal) {
      setError("Välj vem du tror vinner matchen.");
      setLoading(false);
      return;
    }

    const body: Record<string, unknown> = {
      matchId: match.id,
      groupId: selectedGroup,
    };

    if (isGroup) {
      body.predictedHome = homeVal;
      body.predictedAway = awayVal;
    } else if (isFinal) {
      body.predictedHome = homeVal;
      body.predictedAway = awayVal;
      body.predictedWinner = winnerVal;
    } else {
      body.predictedWinner = winnerVal;
    }

    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Något gick fel");
    } else {
      setSuccess(true);
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers for locked state
  // ---------------------------------------------------------------------------

  function LockedScoreView({ pred }: { pred: ExistingPrediction }) {
    const home = pred.predictedHome ?? 0;
    const away = pred.predictedAway ?? 0;
    return (
      <div className="space-y-3">
        <div
          className="flex items-center justify-center gap-4 p-4 rounded-xl border"
          style={{
            background: resultColor(home, away),
            borderColor: resultBorder(home, away),
          }}
        >
          <span className="font-semibold text-white/80 text-right flex-1">{match.homeTeam.name}</span>
          <span className="text-3xl font-black tabular-nums" style={{ color: resultTextColor(home, away) }}>
            {home} – {away}
          </span>
          <span className="font-semibold text-white/80 text-left flex-1">{match.awayTeam.name}</span>
        </div>
        <p className="text-center text-sm font-medium" style={{ color: resultTextColor(home, away) }}>
          {resultLabel(home, away)}
        </p>
      </div>
    );
  }

  function LockedWinnerView({ pred }: { pred: ExistingPrediction }) {
    const winner = pred.predictedWinner;
    if (!winner) return null;
    const colors = WINNER_COLORS[winner as "home" | "away"];
    const teamName = winner === "home" ? match.homeTeam.name : match.awayTeam.name;
    return (
      <div
        className="flex items-center justify-center gap-3 p-4 rounded-xl border"
        style={{ background: colors.bg, borderColor: colors.border }}
      >
        <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: colors.text }}>
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-0.5" style={{ color: colors.text, opacity: 0.7 }}>
            Tippad vinnare
          </p>
          <p className="font-bold text-white">{teamName}</p>
        </div>
      </div>
    );
  }

  function LockedFinalView({ pred }: { pred: ExistingPrediction }) {
    return (
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 text-center">
            Resultat efter 90 min
          </p>
          <LockedScoreView pred={pred} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2 text-center">
            Vinnare av matchen
          </p>
          <LockedWinnerView pred={pred} />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Scoring hint strip
  // ---------------------------------------------------------------------------

  function ScoringHint() {
    if (isGroup) {
      return (
        <p className="text-[11px] text-white/35 text-center mt-2">
          Rätt resultat = 1 p &nbsp;·&nbsp; Exakt rätt = 3 p
        </p>
      );
    }
    if (isFinal) {
      return (
        <p className="text-[11px] text-white/35 text-center mt-2">
          Rätt vinnare = 2 p &nbsp;·&nbsp; Rätt vinnare + exakt 90-min = 5 p
        </p>
      );
    }
    return (
      <p className="text-[11px] text-white/35 text-center mt-2">
        Rätt vinnare = 2 p
      </p>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  const hasSavedTip = !!existing;
  const maxPts = MAX_PTS[match.stage] ?? "?";

  return (
    <div
      className="glass-card space-y-5"
      style={hasSavedTip && !isLocked ? { borderColor: "rgba(52, 211, 153, 0.35)" } : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-white">
            {isLocked || hasSavedTip ? "Ditt tip" : "Lägg ditt tip"}
          </h2>
          {hasSavedTip && !isLocked && (
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
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold tracking-widest text-white/25 uppercase">
            Max {maxPts}
          </span>
          {existing?.score !== null && existing?.score !== undefined && (
            <span className="text-app-accent font-bold text-lg">{existing.score} pts</span>
          )}
        </div>
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

      {/* TBD teams — predictions not yet open */}
      {isTeamTBD ? (
        <div className="text-center py-5 space-y-1">
          <p className="text-sm font-semibold text-white/50">Lagen är ännu inte fastslagna</p>
          <p className="text-xs text-white/30">Tipsningen öppnar när matchens lag är klara</p>
        </div>
      ) : /* Locked view */
      isLocked && existing ? (
        <>
          {isGroup && <LockedScoreView pred={existing} />}
          {isFinal && <LockedFinalView pred={existing} />}
          {isKnockout && !isFinal && <LockedWinnerView pred={existing} />}
        </>
      ) : isLocked ? (
        <p className="text-sm text-white/40 text-center py-4">
          Tipsningen är stängd för den här matchen.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Group stage — predict the score */}
          {isGroup && (
            <div>
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
                Tippa slutresultat
              </label>
              <ScoreInput
                homeTeamName={match.homeTeam.name}
                awayTeamName={match.awayTeam.name}
                homeVal={homeVal}
                awayVal={awayVal}
                onHomeChange={setHomeVal}
                onAwayChange={setAwayVal}
              />
            </div>
          )}

          {/* Final — predict 90-min score + overall winner */}
          {isFinal && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
                  Resultat efter 90 min (ordinarie tid)
                </label>
                <ScoreInput
                  homeTeamName={match.homeTeam.name}
                  awayTeamName={match.awayTeam.name}
                  homeVal={homeVal}
                  awayVal={awayVal}
                  onHomeChange={setHomeVal}
                  onAwayChange={setAwayVal}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
                  Vem vinner finalen? (inkl. förlängning / straffar)
                </label>
                <WinnerToggle
                  homeTeamName={match.homeTeam.name}
                  awayTeamName={match.awayTeam.name}
                  selected={winnerVal}
                  onSelect={setWinnerVal}
                />
              </div>
            </div>
          )}

          {/* Knockout non-final — predict the winner only */}
          {isKnockout && !isFinal && (
            <div>
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
                Vem vinner matchen?
              </label>
              <WinnerToggle
                homeTeamName={match.homeTeam.name}
                awayTeamName={match.awayTeam.name}
                selected={winnerVal}
                onSelect={setWinnerVal}
              />
            </div>
          )}

          <ScoringHint />

          {/* Current saved tip indicator */}
          {existing && (
            <div
              className="rounded-xl p-3"
              style={{ background: "rgba(52, 211, 153, 0.06)", border: "1px solid rgba(52, 211, 153, 0.2)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "rgba(110, 231, 183, 0.65)" }}>
                Nuvarande tips
              </p>
              {isGroup && existing.predictedHome !== null && existing.predictedAway !== null && (
                <p className="text-sm text-white/80">
                  {match.homeTeam.name}{" "}
                  <span className="font-bold text-white">{existing.predictedHome} – {existing.predictedAway}</span>{" "}
                  {match.awayTeam.name}
                </p>
              )}
              {isKnockout && !isFinal && existing.predictedWinner && (
                <p className="text-sm text-white/80">
                  Vinnare:{" "}
                  <span className="font-bold text-white">
                    {existing.predictedWinner === "home" ? match.homeTeam.name : match.awayTeam.name}
                  </span>
                </p>
              )}
              {isFinal && (
                <p className="text-sm text-white/80">
                  {existing.predictedHome !== null && existing.predictedAway !== null
                    ? `${existing.predictedHome}–${existing.predictedAway} efter 90 min`
                    : ""}
                  {existing.predictedWinner && (
                    <> · Vinnare: <span className="font-bold text-white">
                      {existing.predictedWinner === "home" ? match.homeTeam.name : match.awayTeam.name}
                    </span></>
                  )}
                </p>
              )}
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
