"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import type { BracketNode, KnockoutStage } from "@/lib/bracket";
import { format, formatWithTime, stageLabel, teamFlag } from "@/lib/utils";

export type AdvancedBracketNode = Omit<BracketNode, "scheduledAt"> & {
  scheduledAt: string;
};

export type AdvancedBracketRounds = Record<KnockoutStage, AdvancedBracketNode[]>;

type Props = {
  rounds: AdvancedBracketRounds;
  predictionMode?: {
    isOpen: boolean;
    groupId?: string;
    firstKnockoutStartsAt?: string | null;
    closedMessage?: string;
  };
};

const MAIN_ROUNDS: KnockoutStage[] = ["r32", "r16", "qf", "sf", "final"];
const PREDICTION_ROUNDS: KnockoutStage[] = ["r32", "r16", "qf", "sf", "3p", "final"];
const CARD_W = 252;
const CARD_H = 104;
const SLOT_H = 128;
const ROUND_GAP = 64;
const HEADER_H = 40;
const BASE_SLOTS = 16;

type PositionedNode = {
  node: AdvancedBracketNode;
  roundIndex: number;
  matchIndex: number;
  left: number;
  top: number;
};

type BracketTeam = { id: string; name: string };
type MatchParticipants = { home: BracketTeam | null; away: BracketTeam | null };
type PickValue = {
  predictedWinnerTeamId: string | null;
  predictedHome: number | null;
  predictedAway: number | null;
};
type PickState = Record<string, PickValue>;

export default function AdvancedBracketTree({ rounds, predictionMode }: Props) {
  const router = useRouter();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const sortedRounds = useMemo(() => sortRounds(rounds), [rounds]);
  const editable = predictionMode?.isOpen === true && !!predictionMode.groupId;
  const [picks, setPicks] = useState<PickState>(() =>
    sanitizePicks(sortedRounds, initialPicks(sortedRounds))
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const participants = useMemo(
    () => computeParticipants(sortedRounds, picks),
    [sortedRounds, picks]
  );
  const missingNodes = useMemo(
    () => incompleteNodes(sortedRounds, picks, participants),
    [sortedRounds, picks, participants]
  );
  const totalPredictionNodes = PREDICTION_ROUNDS.flatMap((stage) => sortedRounds[stage]).length;
  const completedPredictionNodes = totalPredictionNodes - missingNodes.length;
  const canSave = editable && missingNodes.length === 0 && !saving;
  const displayRounds = useMemo(
    () => applyPickState(sortedRounds, picks, participants, editable),
    [sortedRounds, picks, participants, editable]
  );
  const allMainNodes = MAIN_ROUNDS.flatMap((stage) => displayRounds[stage]);
  const thirdPlace = displayRounds["3p"];
  const bracketHeight = BASE_SLOTS * SLOT_H;
  const bracketWidth = MAIN_ROUNDS.length * CARD_W + (MAIN_ROUNDS.length - 1) * ROUND_GAP;

  const positions = useMemo(() => {
    const byCode = new Map<string, PositionedNode>();
    const byId = new Map<string, PositionedNode>();

    MAIN_ROUNDS.forEach((stage, roundIndex) => {
      displayRounds[stage].forEach((node, matchIndex) => {
        const positioned = {
          node,
          roundIndex,
          matchIndex,
          left: roundIndex * (CARD_W + ROUND_GAP),
          top: topFor(roundIndex, matchIndex),
        };
        byCode.set(node.bracketCode, positioned);
        byId.set(node.matchId, positioned);
      });
    });

    return { byCode, byId };
  }, [displayRounds]);

  function toggleExpanded(matchId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  }

  function updateWinner(node: AdvancedBracketNode, teamId: string) {
    if (!editable) return;
    setSaveError("");
    setSaveSuccess(false);
    setPicks((current) => {
      const currentPick = current[node.matchId] ?? emptyPick();
      const next: PickState = {
        ...current,
        [node.matchId]: {
          ...currentPick,
          predictedWinnerTeamId: teamId,
          predictedHome:
            node.stage === "final" && currentPick.predictedHome === null
              ? 0
              : currentPick.predictedHome,
          predictedAway:
            node.stage === "final" && currentPick.predictedAway === null
              ? 0
              : currentPick.predictedAway,
        },
      };
      return sanitizePicks(sortedRounds, next);
    });
  }

  function updateFinalScore(matchId: string, side: "home" | "away", value: string) {
    if (!editable) return;
    setSaveError("");
    setSaveSuccess(false);
    const parsed = value === "" ? null : Math.max(0, Math.min(99, Number(value)));
    if (parsed !== null && !Number.isInteger(parsed)) return;

    setPicks((current) => {
      const currentPick = current[matchId] ?? emptyPick();
      return {
        ...current,
        [matchId]: {
          ...currentPick,
          predictedHome: side === "home" ? parsed : currentPick.predictedHome,
          predictedAway: side === "away" ? parsed : currentPick.predictedAway,
        },
      };
    });
  }

  async function saveBracket() {
    if (!canSave || !predictionMode?.groupId) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    const res = await fetch("/api/bracket/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId: predictionMode.groupId,
        predictions: PREDICTION_ROUNDS.flatMap((stage) => sortedRounds[stage]).map((node) => {
          const pick = picks[node.matchId] ?? emptyPick();
          return {
            matchId: node.matchId,
            predictedWinnerTeamId: pick.predictedWinnerTeamId,
            predictedHome: node.stage === "final" ? pick.predictedHome : null,
            predictedAway: node.stage === "final" ? pick.predictedAway : null,
          };
        }),
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setSaveError(data.error || "Det gick inte att spara slutspelstipset.");
      return;
    }

    setSaveSuccess(true);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-black/15 shadow-2xl">
        {predictionMode && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-white/70">
                {predictionMode.isOpen ? "Slutspelstips" : "Slutspelsträd"}
              </p>
              {predictionMode.isOpen ? (
                <p className="mt-0.5 text-xs text-white/35">
                  {completedPredictionNodes}/{totalPredictionNodes} klara
                  {predictionMode.firstKnockoutStartsAt
                    ? ` · Deadline ${formatWithTime(new Date(predictionMode.firstKnockoutStartsAt))}`
                    : ""}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-white/40">
                  {predictionMode.closedMessage}
                </p>
              )}
            </div>
            {predictionMode.isOpen && (
              <button
                type="button"
                disabled={!canSave}
                onClick={saveBracket}
                className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-45"
              >
                {saving ? "Sparar..." : "Spara hela trädet"}
              </button>
            )}
          </div>
        )}

        {(saveError || saveSuccess) && (
          <div className="border-b border-white/10 px-4 py-2">
            {saveError && (
              <p className="rounded-lg border border-red-500/30 bg-red-900/25 px-3 py-2 text-sm text-red-200">
                {saveError}
              </p>
            )}
            {saveSuccess && (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-200">
                Slutspelstipset är sparat.
              </p>
            )}
          </div>
        )}

        <div className="overflow-x-auto p-4">
          <div
            className="relative"
            style={{
              width: bracketWidth,
              height: bracketHeight + HEADER_H + 250,
              minWidth: bracketWidth,
            }}
          >
            <RoundHeaders width={bracketWidth} />
            <ConnectorLayer nodes={allMainNodes} positions={positions.byCode} />

            {MAIN_ROUNDS.map((stage, roundIndex) => (
            <div
              key={stage}
              className="absolute top-0"
              style={{
                left: roundIndex * (CARD_W + ROUND_GAP),
                width: CARD_W,
                height: bracketHeight + HEADER_H,
              }}
            >
              {sortedRounds[stage].map((node, matchIndex) => (
                <div
                  key={node.matchId}
                  className="absolute"
                  style={{
                    top: HEADER_H + topFor(roundIndex, matchIndex),
                    left: 0,
                    width: CARD_W,
                    zIndex: expandedIds.has(node.matchId) ? 30 : 10,
                  }}
                >
                  <TreeMatchCard
                    node={displayRounds[stage][matchIndex]}
                    expanded={expandedIds.has(node.matchId)}
                    onToggle={() => toggleExpanded(node.matchId)}
                    editable={editable}
                    pick={picks[node.matchId] ?? emptyPick()}
                    onPick={(teamId) => updateWinner(node, teamId)}
                    onFinalScore={(side, value) => updateFinalScore(node.matchId, side, value)}
                  />
                </div>
              ))}
            </div>
            ))}
          </div>
        </div>
      </div>

      {thirdPlace.length > 0 && (
        <section className="rounded-lg border border-white/10 bg-black/15 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-widest text-white/55">
              {stageLabel("3p")}
            </h2>
            <span className="text-xs font-semibold text-white/30">
              {thirdPlace.length} match
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {thirdPlace.map((node) => (
              <TreeMatchCard
                key={node.matchId}
                node={node}
                expanded={expandedIds.has(node.matchId)}
                onToggle={() => toggleExpanded(node.matchId)}
                editable={editable}
                pick={picks[node.matchId] ?? emptyPick()}
                onPick={(teamId) => updateWinner(node, teamId)}
                onFinalScore={(side, value) => updateFinalScore(node.matchId, side, value)}
                fluid
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RoundHeaders({ width }: { width: number }) {
  return (
    <div className="absolute left-0 top-0 h-8" style={{ width }}>
      {MAIN_ROUNDS.map((stage, index) => (
        <div
          key={stage}
          className="absolute top-0 flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2 py-1"
          style={{
            left: index * (CARD_W + ROUND_GAP),
            width: CARD_W,
          }}
        >
          <span
            className="text-[10px] font-black uppercase tracking-[0.18em]"
            style={{ color: stage === "final" ? "#f5c842" : "rgba(255,255,255,0.48)" }}
          >
            {stageLabel(stage)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ConnectorLayer({
  nodes,
  positions,
}: {
  nodes: AdvancedBracketNode[];
  positions: Map<string, PositionedNode>;
}) {
  const paths = nodes
    .map((node) => {
      if (!node.nextMatchCode) return null;
      const from = positions.get(node.bracketCode);
      const to = positions.get(node.nextMatchCode);
      if (!from || !to) return null;

      const x1 = from.left + CARD_W;
      const y1 = HEADER_H + from.top + CARD_H / 2;
      const x2 = to.left;
      const y2 = HEADER_H + to.top + CARD_H / 2;
      const midX = x1 + (x2 - x1) / 2;

      return {
        id: `${node.bracketCode}-${node.nextMatchCode}`,
        d: `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`,
        stroke: connectorColor(node),
        active: node.status === "completed" || !!node.userPrediction?.predictedWinnerTeamId,
      };
    })
    .filter((path): path is { id: string; d: string; stroke: string; active: boolean } => !!path);

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0"
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      {paths.map((path) => (
        <path
          key={path.id}
          d={path.d}
          fill="none"
          stroke={path.stroke}
          strokeWidth={path.active ? 2 : 1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

function TreeMatchCard({
  node,
  expanded,
  onToggle,
  editable = false,
  pick = emptyPick(),
  onPick,
  onFinalScore,
  fluid = false,
}: {
  node: AdvancedBracketNode;
  expanded: boolean;
  onToggle: () => void;
  editable?: boolean;
  pick?: PickValue;
  onPick?: (teamId: string) => void;
  onFinalScore?: (side: "home" | "away", value: string) => void;
  fluid?: boolean;
}) {
  const pred = node.userPrediction;
  const borderColor = matchBorderColor(node);
  const status = statusText(node.status);
  const pickedTeamId = editable ? pick.predictedWinnerTeamId : pred?.predictedWinnerTeamId ?? null;
  const actualWinnerId = node.winnerTeamId;
  const canPick = editable && !!node.homeTeam && !!node.awayTeam;

  return (
    <article
      className="overflow-hidden rounded-lg border bg-app-deep/95 shadow-xl transition-all"
      style={{
        width: fluid ? "100%" : CARD_W,
        borderColor,
        boxShadow: expanded ? "0 20px 50px rgba(0,0,0,0.45)" : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-app-accent/75">
              {node.bracketCode}
            </span>
            <span className="ml-2 truncate text-[10px] font-semibold uppercase tracking-widest text-white/30">
              {status}
            </span>
          </span>
        </button>
        <div className="flex items-center gap-2">
          <PredictionPill node={node} />
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Stäng matchdetaljer" : "Öppna matchdetaljer"}
            className="flex h-5 w-5 items-center justify-center rounded border border-white/15 bg-white/5 text-xs font-black text-white/45"
          >
            {expanded ? "-" : "+"}
          </button>
        </div>
      </div>

      <div className="space-y-1.5 px-3 py-2.5" style={{ minHeight: CARD_H - 34 }}>
        <TeamLine
          team={node.homeTeam}
          score={node.homeScore}
          won={node.knockoutWinner === "home"}
          picked={pickedTeamId === node.homeTeam?.id}
          actualWinner={actualWinnerId === node.homeTeam?.id}
          editable={canPick}
          onSelect={node.homeTeam ? () => onPick?.(node.homeTeam!.id) : undefined}
        />
        <TeamLine
          team={node.awayTeam}
          score={node.awayScore}
          won={node.knockoutWinner === "away"}
          picked={pickedTeamId === node.awayTeam?.id}
          actualWinner={actualWinnerId === node.awayTeam?.id}
          editable={canPick}
          onSelect={node.awayTeam ? () => onPick?.(node.awayTeam!.id) : undefined}
        />

        {editable && node.stage === "final" && (
          <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2">
            <p className="mb-1.5 text-[9px] font-black uppercase tracking-widest text-white/35">
              90 min
            </p>
            <div className="flex items-center gap-2">
              <FinalScoreInput
                value={pick.predictedHome}
                disabled={!pickedTeamId}
                onChange={(value) => onFinalScore?.("home", value)}
              />
              <span className="text-xs font-black text-white/30">-</span>
              <FinalScoreInput
                value={pick.predictedAway}
                disabled={!pickedTeamId}
                onChange={(value) => onFinalScore?.("away", value)}
              />
            </div>
          </div>
        )}
      </div>

      {expanded && <ExpandedMatchDetails node={node} />}
    </article>
  );
}

function ExpandedMatchDetails({ node }: { node: AdvancedBracketNode }) {
  const pred = node.userPrediction;
  const predictedTeamName = teamNameForPrediction(node, pred?.predictedWinnerTeamId ?? null);
  const actualWinnerName = teamNameForPrediction(node, node.winnerTeamId);

  return (
    <div className="space-y-3 border-t border-white/10 bg-black/25 px-3 py-3">
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <DetailStat label="Datum" value={format(new Date(node.scheduledAt))} />
        <DetailStat label="Poäng" value={maxPointsLabel(node.stage)} />
        <DetailStat label="Vinnare" value={actualWinnerName ?? "Ej avgjord"} />
      </div>

      <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
        <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/35">
          Ditt tips
        </p>
        {pred?.predictedWinnerTeamId ? (
          <div className="space-y-1">
            <p className="text-sm font-bold text-white/75">
              {predictedTeamName ?? pred.predictedWinnerTeamId}
              {pred.cascadeMiss && <span className="ml-1 text-red-300/80">(utslaget)</span>}
            </p>
            {node.stage === "final" && pred.predictedHome !== null && pred.predictedAway !== null && (
              <p className="text-xs text-white/40">
                {pred.predictedHome}-{pred.predictedAway} efter 90 min
              </p>
            )}
            {pred.score !== null && (
              <p className="text-xs font-bold text-app-ice">{pred.score} p tilldelade</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-white/35">Inget tips lagt</p>
        )}
      </div>

      <Link
        href={`/matcher/${node.matchId}`}
        className="block rounded-lg border border-app-accent/30 bg-app-accent/10 px-3 py-2 text-center text-xs font-black uppercase tracking-widest text-app-gold transition-colors hover:bg-app-accent/15"
      >
        Öppna match
      </Link>
    </div>
  );
}

function TeamLine({
  team,
  score,
  won,
  picked,
  actualWinner,
  editable = false,
  onSelect,
}: {
  team: { id: string; name: string } | null;
  score: number | null;
  won: boolean;
  picked: boolean;
  actualWinner: boolean;
  editable?: boolean;
  onSelect?: () => void;
}) {
  const style: CSSProperties = {
    background: won || actualWinner ? "rgba(52,211,153,0.12)" : picked ? "rgba(232,160,32,0.12)" : "rgba(255,255,255,0.045)",
    borderColor: won || actualWinner ? "rgba(52,211,153,0.28)" : picked ? "rgba(232,160,32,0.28)" : "rgba(255,255,255,0.07)",
  };

  if (!team) {
    return (
      <div
        className="flex h-8 items-center justify-between rounded-lg border px-2 text-sm italic text-white/30"
        style={style}
      >
        <span className="truncate">Vinnare från tidigare match</span>
        <span className="shrink-0 text-white/25">-</span>
      </div>
    );
  }

  const content = (
    <>
      <span className="min-w-0 truncate font-semibold text-app-frost">
        <span className="mr-1">{teamFlag(team.id)}</span>
        {team.name}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {picked && (
          <span className="rounded bg-app-accent/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-app-gold">
            Tips
          </span>
        )}
        <span className="min-w-4 text-right font-black tabular-nums text-white/70">
          {score !== null ? score : "-"}
        </span>
      </div>
    </>
  );

  if (editable) {
    return (
      <button
        type="button"
        onClick={onSelect}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border px-2 text-left text-sm transition-colors hover:border-app-accent/45"
        style={style}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className="flex h-8 items-center justify-between gap-2 rounded-lg border px-2 text-sm"
      style={style}
    >
      {content}
    </div>
  );
}

function FinalScoreInput({
  value,
  disabled,
  onChange,
}: {
  value: number | null;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="number"
      min={0}
      max={99}
      value={value ?? ""}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-md border border-white/10 bg-black/25 px-2 text-center text-sm font-black tabular-nums text-white outline-none focus:border-app-accent/60 disabled:opacity-40"
    />
  );
}

function PredictionPill({ node }: { node: AdvancedBracketNode }) {
  const pred = node.userPrediction;
  if (!pred?.predictedWinnerTeamId) {
    return (
      <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/30">
        Ej tip
      </span>
    );
  }
  if (node.status === "completed" && pred.score !== null) {
    const good = pred.score > 0;
    return (
      <span
        className="rounded border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
        style={{
          background: good ? "rgba(52,211,153,0.15)" : "rgba(239,68,68,0.16)",
          borderColor: good ? "rgba(52,211,153,0.30)" : "rgba(239,68,68,0.28)",
          color: good ? "rgb(110,231,183)" : "rgb(252,165,165)",
        }}
      >
        {pred.score} p
      </span>
    );
  }
  if (pred.cascadeMiss) {
    return (
      <span className="rounded border border-red-400/25 bg-red-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-200">
        Ute
      </span>
    );
  }
  return (
    <span className="rounded border border-app-accent/25 bg-app-accent/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-app-gold">
      Tippat
    </span>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
      <p className="text-[9px] font-black uppercase tracking-widest text-white/25">{label}</p>
      <p className="truncate text-xs font-semibold text-white/65">{value}</p>
    </div>
  );
}

function sortRounds(rounds: AdvancedBracketRounds): AdvancedBracketRounds {
  return {
    r32: [...rounds.r32].sort(byBracketCode),
    r16: [...rounds.r16].sort(byBracketCode),
    qf: [...rounds.qf].sort(byBracketCode),
    sf: [...rounds.sf].sort(byBracketCode),
    "3p": [...rounds["3p"]].sort(byBracketCode),
    final: [...rounds.final].sort(byBracketCode),
  };
}

function byBracketCode(a: AdvancedBracketNode, b: AdvancedBracketNode) {
  return bracketCodeOrder(a.bracketCode) - bracketCodeOrder(b.bracketCode);
}

function bracketCodeOrder(code: string) {
  const match = code.match(/-(\d+)$/);
  if (match) return Number(match[1]);
  if (code === "F") return 1;
  if (code === "3P") return 1;
  return 999;
}

function topFor(roundIndex: number, matchIndex: number) {
  return (SLOT_H * (Math.pow(2, roundIndex) * (2 * matchIndex + 1) - 1)) / 2;
}

function connectorColor(node: AdvancedBracketNode) {
  if (node.status === "completed" && node.winnerTeamId) return "rgba(52,211,153,0.58)";
  if (node.userPrediction?.predictedWinnerTeamId && !node.userPrediction.cascadeMiss) return "rgba(245,200,66,0.40)";
  if (node.userPrediction?.cascadeMiss) return "rgba(239,68,68,0.32)";
  return "rgba(255,255,255,0.13)";
}

function matchBorderColor(node: AdvancedBracketNode) {
  const pred = node.userPrediction;
  if (node.stage === "final") return "rgba(245,200,66,0.34)";
  if (!pred?.predictedWinnerTeamId) return "rgba(255,255,255,0.11)";
  if (pred.cascadeMiss) return "rgba(239,68,68,0.34)";
  if (node.status === "completed" && pred.score !== null) {
    return pred.score > 0 ? "rgba(52,211,153,0.40)" : "rgba(239,68,68,0.34)";
  }
  return "rgba(232,160,32,0.34)";
}

function statusText(status: AdvancedBracketNode["status"]) {
  if (status === "completed") return "Klar";
  if (status === "live") return "Live";
  return "Kommande";
}

function maxPointsLabel(stage: KnockoutStage) {
  return stage === "final" ? "5 p" : "2 p";
}

function teamNameForPrediction(node: AdvancedBracketNode, teamId: string | null) {
  if (!teamId) return null;
  if (node.homeTeam?.id === teamId) return node.homeTeam.name;
  if (node.awayTeam?.id === teamId) return node.awayTeam.name;
  return teamId;
}

function applyPickState(
  rounds: AdvancedBracketRounds,
  picks: PickState,
  participants: Map<string, MatchParticipants>,
  editable: boolean
): AdvancedBracketRounds {
  if (!editable) return rounds;

  const mapNode = (node: AdvancedBracketNode): AdvancedBracketNode => {
    const pick = picks[node.matchId] ?? emptyPick();
    const matchParticipants = participants.get(node.matchId);
    const hasPick =
      !!pick.predictedWinnerTeamId ||
      pick.predictedHome !== null ||
      pick.predictedAway !== null;

    return {
      ...node,
      homeTeam: matchParticipants?.home ?? node.homeTeam,
      awayTeam: matchParticipants?.away ?? node.awayTeam,
      userPrediction: hasPick
        ? {
            predictedWinnerTeamId: pick.predictedWinnerTeamId,
            predictedHome: pick.predictedHome,
            predictedAway: pick.predictedAway,
            score: node.userPrediction?.score ?? null,
            cascadeMiss: false,
          }
        : null,
    };
  };

  return {
    r32: rounds.r32.map(mapNode),
    r16: rounds.r16.map(mapNode),
    qf: rounds.qf.map(mapNode),
    sf: rounds.sf.map(mapNode),
    "3p": rounds["3p"].map(mapNode),
    final: rounds.final.map(mapNode),
  };
}

function initialPicks(rounds: AdvancedBracketRounds): PickState {
  const picks: PickState = {};
  for (const node of allRoundNodes(rounds)) {
    picks[node.matchId] = {
      predictedWinnerTeamId: node.userPrediction?.predictedWinnerTeamId ?? null,
      predictedHome: node.userPrediction?.predictedHome ?? null,
      predictedAway: node.userPrediction?.predictedAway ?? null,
    };
  }
  return picks;
}

function incompleteNodes(
  rounds: AdvancedBracketRounds,
  picks: PickState,
  participants: Map<string, MatchParticipants>
) {
  return allRoundNodes(rounds).filter((node) => {
    const pick = picks[node.matchId] ?? emptyPick();
    const matchParticipants = participants.get(node.matchId) ?? actualParticipants(node);
    if (!selectedTeam(pick.predictedWinnerTeamId, matchParticipants)) return true;
    if (node.stage === "final" && (pick.predictedHome === null || pick.predictedAway === null)) {
      return true;
    }
    return false;
  });
}

function sanitizePicks(rounds: AdvancedBracketRounds, picks: PickState): PickState {
  let next = clonePicks(picks);

  for (let pass = 0; pass < PREDICTION_ROUNDS.length; pass++) {
    let changed = false;
    const participants = computeParticipants(rounds, next);

    for (const node of allRoundNodes(rounds)) {
      const pick = next[node.matchId] ?? emptyPick();
      const matchParticipants = participants.get(node.matchId) ?? actualParticipants(node);
      if (pick.predictedWinnerTeamId && !selectedTeam(pick.predictedWinnerTeamId, matchParticipants)) {
        next = {
          ...next,
          [node.matchId]: {
            predictedWinnerTeamId: null,
            predictedHome: node.stage === "final" ? null : pick.predictedHome,
            predictedAway: node.stage === "final" ? null : pick.predictedAway,
          },
        };
        changed = true;
      }
    }

    if (!changed) break;
  }

  return next;
}

function computeParticipants(
  rounds: AdvancedBracketRounds,
  picks: PickState
): Map<string, MatchParticipants> {
  const participants = new Map<string, MatchParticipants>();
  const nodeByCode = new Map<string, AdvancedBracketNode>();

  for (const node of allRoundNodes(rounds)) {
    nodeByCode.set(node.bracketCode, node);
  }

  for (const node of rounds.r32) {
    participants.set(node.matchId, actualParticipants(node));
  }

  for (const stage of ["r32", "r16", "qf", "sf"] as KnockoutStage[]) {
    for (const node of rounds[stage]) {
      const matchParticipants = participants.get(node.matchId) ?? actualParticipants(node);
      const winner = selectedTeam(
        picks[node.matchId]?.predictedWinnerTeamId ?? null,
        matchParticipants
      );
      if (!winner) continue;

      if (node.nextMatchCode && node.nextMatchSlot) {
        const nextNode = nodeByCode.get(node.nextMatchCode);
        if (nextNode) setParticipant(participants, nextNode.matchId, node.nextMatchSlot, winner);
      }

      if (node.stage === "sf" && node.nextMatchSlot) {
        const thirdPlace = nodeByCode.get("3P");
        const loser =
          winner.id === matchParticipants.home?.id
            ? matchParticipants.away
            : matchParticipants.home;
        if (thirdPlace && loser) {
          setParticipant(participants, thirdPlace.matchId, node.nextMatchSlot, loser);
        }
      }
    }
  }

  return participants;
}

function setParticipant(
  participants: Map<string, MatchParticipants>,
  matchId: string,
  slot: "home" | "away",
  team: BracketTeam
) {
  const current = participants.get(matchId) ?? { home: null, away: null };
  participants.set(matchId, { ...current, [slot]: team });
}

function actualParticipants(node: AdvancedBracketNode): MatchParticipants {
  return {
    home: node.homeTeam,
    away: node.awayTeam,
  };
}

function selectedTeam(teamId: string | null, participants: MatchParticipants): BracketTeam | null {
  if (!teamId) return null;
  if (participants.home?.id === teamId) return participants.home;
  if (participants.away?.id === teamId) return participants.away;
  return null;
}

function allRoundNodes(rounds: AdvancedBracketRounds): AdvancedBracketNode[] {
  return PREDICTION_ROUNDS.flatMap((stage) => rounds[stage]);
}

function emptyPick(): PickValue {
  return { predictedWinnerTeamId: null, predictedHome: null, predictedAway: null };
}

function clonePicks(picks: PickState): PickState {
  return Object.fromEntries(
    Object.entries(picks).map(([matchId, pick]) => [matchId, { ...pick }])
  );
}
