"use client";

import { useState } from "react";
import { stageLabel, teamFlag } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Layout constants
// ─────────────────────────────────────────────────────────────────────────────
const N = 16;        // WC 2026: 16 R32 matches → full bracket height
const CARD_H = 76;   // px — match card height
const CARD_W = 200;  // px — match card width
const COL_GAP = 40;  // px — gap between columns (connectors drawn here)
const BRACKET_H = N * CARD_H; // 1216px total

// Top pixel offset for match i in round r (0-indexed)
function topPos(r: number, i: number): number {
  return (CARD_H * (Math.pow(2, r) * (2 * i + 1) - 1)) / 2;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface BracketMatch {
  id: string;
  stage: string;
  status: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  homeScore: number | null;
  awayScore: number | null;
  knockoutWinner: string | null;
  scheduledAt: string;
}

interface Pred {
  predictedHome: number | null;
  predictedAway: number | null;
  predictedWinner: string | null;
  score: number | null;
}

type PredsMap = Record<string, Record<string, Pred>>;

interface UserGroup {
  id: string;
  name: string;
}

interface Props {
  matchesByStage: Record<string, BracketMatch[]>;
  initialPreds: {
    matchId: string;
    groupId: string;
    predictedHome: number | null;
    predictedAway: number | null;
    predictedWinner: string | null;
    score: number | null;
  }[];
  groups: UserGroup[];
  mockMode?: boolean;
}

// Main bracket stages left→right
const MAIN_STAGES = ["r32", "r16", "qf", "sf", "final"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function KnockoutBracket({ matchesByStage, initialPreds, groups, mockMode = false }: Props) {
  const [selectedGroup, setSelectedGroup] = useState(groups[0]?.id ?? "");
  const [preds, setPreds] = useState<PredsMap>(() => {
    const map: PredsMap = {};
    for (const p of initialPreds) {
      if (!map[p.matchId]) map[p.matchId] = {};
      map[p.matchId][p.groupId] = {
        predictedHome: p.predictedHome,
        predictedAway: p.predictedAway,
        predictedWinner: p.predictedWinner,
        score: p.score,
      };
    }
    return map;
  });
  const [saving, setSaving] = useState(new Set<string>());
  const [finalModal, setFinalModal] = useState<BracketMatch | null>(null);

  async function handlePick(match: BracketMatch, winner: "home" | "away") {
    if (match.stage === "final") {
      setFinalModal(match);
      return;
    }
    const { id: matchId } = match;
    setSaving((prev) => new Set([...prev, matchId]));

    if (mockMode) {
      // Skip the API call in mock mode — just update local state
      setPreds((prev) => ({
        ...prev,
        [matchId]: {
          ...prev[matchId],
          [selectedGroup]: { predictedHome: null, predictedAway: null, predictedWinner: winner, score: null },
        },
      }));
      setSaving((prev) => { const next = new Set(prev); next.delete(matchId); return next; });
      return;
    }

    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, groupId: selectedGroup, predictedWinner: winner }),
    });
    if (res.ok) {
      setPreds((prev) => ({
        ...prev,
        [matchId]: {
          ...prev[matchId],
          [selectedGroup]: {
            predictedHome: null,
            predictedAway: null,
            predictedWinner: winner,
            score: null,
          },
        },
      }));
    }
    setSaving((prev) => {
      const next = new Set(prev);
      next.delete(matchId);
      return next;
    });
  }

  async function handleFinalSave(
    matchId: string,
    home: number,
    away: number,
    winner: "home" | "away"
  ) {
    if (mockMode) {
      setPreds((prev) => ({
        ...prev,
        [matchId]: {
          ...prev[matchId],
          [selectedGroup]: { predictedHome: home, predictedAway: away, predictedWinner: winner, score: null },
        },
      }));
      setFinalModal(null);
      return;
    }

    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        matchId,
        groupId: selectedGroup,
        predictedHome: home,
        predictedAway: away,
        predictedWinner: winner,
      }),
    });
    if (res.ok) {
      setPreds((prev) => ({
        ...prev,
        [matchId]: {
          ...prev[matchId],
          [selectedGroup]: {
            predictedHome: home,
            predictedAway: away,
            predictedWinner: winner,
            score: null,
          },
        },
      }));
      setFinalModal(null);
    }
  }

  const thirdPlaceMatches = matchesByStage["3p"] ?? [];

  return (
    <div className="space-y-6">
      {/* Group selector */}
      {groups.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-white/40">Grupp:</span>
          <div className="flex gap-2 flex-wrap">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setSelectedGroup(g.id)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-150 border"
                style={
                  selectedGroup === g.id
                    ? {
                        background: "rgba(46,139,87,0.25)",
                        borderColor: "rgba(46,139,87,0.5)",
                        color: "rgb(110,231,183)",
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        borderColor: "rgba(255,255,255,0.12)",
                        color: "rgba(255,255,255,0.5)",
                      }
                }
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tip hint */}
      <p className="text-xs text-white/35">
        Klicka på ett lag för att tippa vinnare. Ändra tipset när som helst innan matchen startar.
      </p>

      {/* Bracket */}
      <div style={{ overflowX: "auto", overflowY: "visible" }}>
        <div
          style={{
            display: "flex",
            position: "relative",
            height: BRACKET_H + 56,
            paddingTop: 48,
            // Bracket columns: each gets CARD_W + COL_GAP, last one doesn't need the gap
            width: MAIN_STAGES.length * CARD_W + (MAIN_STAGES.length - 1) * COL_GAP,
          }}
        >
          {MAIN_STAGES.map((stage, r) => {
            const matches = matchesByStage[stage] ?? [];
            return (
              <BracketColumn
                key={stage}
                stage={stage}
                r={r}
                matches={matches}
                preds={preds}
                selectedGroup={selectedGroup}
                saving={saving}
                onPick={handlePick}
                isLastCol={r === MAIN_STAGES.length - 1}
              />
            );
          })}
        </div>
      </div>

      {/* 3rd place match — not connected to main bracket */}
      {thirdPlaceMatches.length > 0 && (
        <div className="glass-card">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">
            Bronsmatch
          </p>
          <div style={{ width: CARD_W }}>
            {thirdPlaceMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                pred={preds[match.id]?.[selectedGroup] ?? null}
                isSaving={saving.has(match.id)}
                isFinal={false}
                onPick={(w) => handlePick(match, w)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Final modal */}
      {finalModal && (
        <FinalModal
          match={finalModal}
          existingPred={preds[finalModal.id]?.[selectedGroup] ?? null}
          onSave={handleFinalSave}
          onClose={() => setFinalModal(null)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BracketColumn
// ─────────────────────────────────────────────────────────────────────────────
function BracketColumn({
  stage,
  r,
  matches,
  preds,
  selectedGroup,
  saving,
  onPick,
  isLastCol,
}: {
  stage: string;
  r: number;
  matches: BracketMatch[];
  preds: PredsMap;
  selectedGroup: string;
  saving: Set<string>;
  onPick: (match: BracketMatch, winner: "home" | "away") => void;
  isLastCol: boolean;
}) {
  const colWidth = isLastCol ? CARD_W : CARD_W + COL_GAP;
  const pairCount = Math.floor(matches.length / 2);

  return (
    <div style={{ width: colWidth, position: "relative", flexShrink: 0, height: BRACKET_H }}>
      {/* Round header */}
      <div
        style={{
          position: "absolute",
          top: -40,
          left: 0,
          width: CARD_W,
          textAlign: "center",
        }}
      >
        <span
          className="text-[10px] font-black uppercase tracking-[0.12em]"
          style={{ color: stage === "final" ? "#f5c842" : "rgba(255,255,255,0.4)" }}
        >
          {stageLabel(stage)}
        </span>
      </div>

      {/* Match cards */}
      {matches.map((match, i) => {
        const top = topPos(r, i);
        const pred = preds[match.id]?.[selectedGroup] ?? null;
        return (
          <div
            key={match.id}
            style={{ position: "absolute", top, left: 0, width: CARD_W, height: CARD_H }}
          >
            <MatchCard
              match={match}
              pred={pred}
              isSaving={saving.has(match.id)}
              isFinal={stage === "final"}
              onPick={(w) => onPick(match, w)}
            />
          </div>
        );
      })}

      {/* Connector lines to the right (draw one per pair) */}
      {!isLastCol &&
        Array.from({ length: pairCount }).map((_, pairIdx) => {
          const i0 = pairIdx * 2;
          const i1 = pairIdx * 2 + 1;
          if (i1 >= matches.length) return null;
          return (
            <Connector
              key={pairIdx}
              upperTop={topPos(r, i0)}
              lowerTop={topPos(r, i1)}
            />
          );
        })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Connector lines between rounds
// ─────────────────────────────────────────────────────────────────────────────
function Connector({ upperTop, lowerTop }: { upperTop: number; lowerTop: number }) {
  const uc = upperTop + CARD_H / 2;  // upper card center
  const lc = lowerTop + CARD_H / 2;  // lower card center
  const mid = (uc + lc) / 2;
  const c = "rgba(255,255,255,0.09)";
  const line = (style: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    background: c,
    ...style,
  });

  return (
    <>
      {/* Horizontal: upper card → vertical stem */}
      <div style={line({ top: uc - 0.5, left: CARD_W, width: COL_GAP / 2, height: 1 })} />
      {/* Horizontal: lower card → vertical stem */}
      <div style={line({ top: lc - 0.5, left: CARD_W, width: COL_GAP / 2, height: 1 })} />
      {/* Vertical stem */}
      <div
        style={line({
          top: uc,
          left: CARD_W + COL_GAP / 2 - 0.5,
          width: 1,
          height: lc - uc,
        })}
      />
      {/* Horizontal: midpoint → next column */}
      <div style={line({ top: mid - 0.5, left: CARD_W + COL_GAP / 2, width: COL_GAP / 2, height: 1 })} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact match card inside the bracket
// ─────────────────────────────────────────────────────────────────────────────
function MatchCard({
  match,
  pred,
  isSaving,
  isFinal,
  onPick,
}: {
  match: BracketMatch;
  pred: Pred | null;
  isSaving: boolean;
  isFinal: boolean;
  onPick: (w: "home" | "away") => void;
}) {
  const isTBD = match.homeTeam.id === "TBD" || match.awayTeam.id === "TBD";
  const isLocked = match.status !== "upcoming";
  const isCompleted = match.status === "completed";
  const canPick = !isTBD && !isLocked && !isSaving;

  // For completed matches, show the actual knockout winner
  const pickedWinner = isCompleted ? match.knockoutWinner : (pred?.predictedWinner ?? null);

  const homeLabel = isTBD ? "–" : shorten(match.homeTeam.name);
  const awayLabel = isTBD ? "–" : shorten(match.awayTeam.name);

  const teamStyle = (side: "home" | "away"): React.CSSProperties => {
    const isPicked = pickedWinner === side;
    return {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      padding: "4px 5px",
      cursor: canPick ? "pointer" : "default",
      transition: "background 0.12s",
      background: isPicked
        ? isCompleted
          ? "rgba(52,211,153,0.18)"
          : "rgba(52,211,153,0.13)"
        : "transparent",
      borderRight: side === "home" ? "1px solid rgba(255,255,255,0.07)" : undefined,
      borderLeft: side === "away" ? "1px solid rgba(255,255,255,0.07)" : undefined,
    };
  };

  const nameStyle = (side: "home" | "away"): React.CSSProperties => ({
    fontSize: 10,
    fontWeight: 700,
    color:
      pickedWinner === side
        ? "rgb(110,231,183)"
        : isTBD
        ? "rgba(255,255,255,0.2)"
        : "rgba(255,255,255,0.72)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
    fontStyle: isTBD ? "italic" : "normal",
  });

  return (
    <div
      style={{
        height: CARD_H,
        width: CARD_W,
        border: `1px solid ${isFinal ? "rgba(245,200,66,0.3)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 8,
        overflow: "hidden",
        display: "flex",
        background: isFinal ? "rgba(9,18,10,0.85)" : "rgba(9,26,16,0.7)",
        opacity: isTBD ? 0.65 : 1,
      }}
    >
      {/* Home */}
      <button
        type="button"
        disabled={!canPick}
        onClick={() => canPick && onPick("home")}
        style={teamStyle("home")}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>
          {isTBD ? "" : teamFlag(match.homeTeam.id) || "🏳"}
        </span>
        <span style={nameStyle("home")}>{homeLabel}</span>
        {pickedWinner === "home" && !isCompleted && (
          <span
            style={{
              fontSize: 7,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgb(110,231,183)",
            }}
          >
            Tippad ✓
          </span>
        )}
      </button>

      {/* Centre: vs or score */}
      <div
        style={{
          width: 28,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          gap: 1,
        }}
      >
        {isCompleted && match.homeScore !== null && match.awayScore !== null ? (
          <span
            style={{ fontSize: 10, fontWeight: 900, color: "rgba(255,255,255,0.6)" }}
          >
            {match.homeScore}–{match.awayScore}
          </span>
        ) : isFinal ? (
          <span style={{ fontSize: 14 }}>🏆</span>
        ) : (
          <span
            style={{ fontSize: 9, color: "rgba(255,255,255,0.22)", fontWeight: 700 }}
          >
            vs
          </span>
        )}
        {isSaving && (
          <span style={{ fontSize: 7, color: "rgba(255,255,255,0.4)" }}>…</span>
        )}
      </div>

      {/* Away */}
      <button
        type="button"
        disabled={!canPick}
        onClick={() => canPick && onPick("away")}
        style={teamStyle("away")}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }}>
          {isTBD ? "" : teamFlag(match.awayTeam.id) || "🏳"}
        </span>
        <span style={nameStyle("away")}>{awayLabel}</span>
        {pickedWinner === "away" && !isCompleted && (
          <span
            style={{
              fontSize: 7,
              fontWeight: 900,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "rgb(110,231,183)",
            }}
          >
            Tippad ✓
          </span>
        )}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Final modal — score + winner
// ─────────────────────────────────────────────────────────────────────────────
function FinalModal({
  match,
  existingPred,
  onSave,
  onClose,
}: {
  match: BracketMatch;
  existingPred: Pred | null;
  onSave: (matchId: string, home: number, away: number, winner: "home" | "away") => Promise<void>;
  onClose: () => void;
}) {
  const isTBD = match.homeTeam.id === "TBD" || match.awayTeam.id === "TBD";
  const isLocked = match.status !== "upcoming";

  const [homeVal, setHomeVal] = useState(existingPred?.predictedHome ?? 0);
  const [awayVal, setAwayVal] = useState(existingPred?.predictedAway ?? 0);
  const [winner, setWinner] = useState<"home" | "away" | null>(
    (existingPred?.predictedWinner as "home" | "away" | null) ?? null
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function clamp(v: number) {
    return Math.max(0, Math.min(99, v));
  }

  async function handleSave() {
    if (!winner) {
      setError("Välj vem du tror vinner finalen.");
      return;
    }
    setSaving(true);
    setError("");
    await onSave(match.id, homeVal, awayVal, winner);
    setSaving(false);
  }

  const homeName = match.homeTeam.id === "TBD" ? "Okänt lag" : match.homeTeam.name;
  const awayName = match.awayTeam.id === "TBD" ? "Okänt lag" : match.awayTeam.name;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(0,0,0,0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
      }}
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-md space-y-5"
        style={{ borderColor: "rgba(245,200,66,0.3)", zIndex: 101 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-app-gold/70 mb-0.5">
              Final
            </p>
            <h2 className="font-bold text-white text-lg">
              {homeName} <span className="text-white/30 font-normal text-sm">vs</span> {awayName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-white/35 hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {isLocked || isTBD ? (
          <p className="text-sm text-white/40 text-center py-4">
            {isTBD ? "Lagen är ännu inte fastslagna." : "Tipsningen är stängd för finalen."}
          </p>
        ) : (
          <>
            {/* 90-min score */}
            <div>
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
                Resultat efter 90 min (ordinarie tid)
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 text-right">
                  <p className="text-sm font-semibold text-white/75 mb-2 truncate">{homeName}</p>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={homeVal}
                    onChange={(e) => setHomeVal(clamp(parseInt(e.target.value) || 0))}
                    className="w-full text-center text-3xl font-black tabular-nums rounded-xl px-3 py-3 outline-none focus:ring-2 transition-all"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "white",
                    }}
                  />
                </div>
                <span className="text-2xl font-black text-white/30 mt-7">–</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-white/75 mb-2 truncate">{awayName}</p>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={awayVal}
                    onChange={(e) => setAwayVal(clamp(parseInt(e.target.value) || 0))}
                    className="w-full text-center text-3xl font-black tabular-nums rounded-xl px-3 py-3 outline-none focus:ring-2 transition-all"
                    style={{
                      background: "rgba(255,255,255,0.07)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      color: "white",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Winner toggle */}
            <div>
              <label className="block text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
                Vem vinner finalen? (inkl. förlängning / straffar)
              </label>
              <div className="flex gap-3">
                {(["home", "away"] as const).map((side) => {
                  const name = side === "home" ? homeName : awayName;
                  const isSelected = winner === side;
                  return (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setWinner(side)}
                      className="flex-1 py-4 px-3 rounded-xl font-bold text-sm transition-all duration-150 text-center border-2"
                      style={
                        isSelected
                          ? {
                              background: "rgba(52,211,153,0.15)",
                              borderColor: "rgba(52,211,153,0.4)",
                              color: "rgb(110,231,183)",
                            }
                          : {
                              background: "rgba(255,255,255,0.04)",
                              borderColor: "rgba(255,255,255,0.12)",
                              color: "rgba(255,255,255,0.5)",
                            }
                      }
                    >
                      {name}
                      {isSelected && (
                        <span className="block text-[10px] font-black uppercase tracking-widest mt-1 opacity-75">
                          Vinnare
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-[11px] text-white/35 text-center">
              Rätt vinnare = 2 p &nbsp;·&nbsp; Rätt vinnare + exakt 90-min = 5 p
            </p>

            {error && (
              <p className="text-red-300 text-sm bg-red-900/30 border border-red-500/30 rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary w-full"
            >
              {saving ? "Sparar…" : existingPred?.predictedWinner ? "Uppdatera tips" : "Spara tips"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function shorten(name: string, max = 9): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + "…";
}
