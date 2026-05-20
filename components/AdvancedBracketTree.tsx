"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import type { BracketNode, KnockoutStage } from "@/lib/bracket";
import { format, stageLabel, teamFlag } from "@/lib/utils";

export type AdvancedBracketNode = Omit<BracketNode, "scheduledAt"> & {
  scheduledAt: string;
};

export type AdvancedBracketRounds = Record<KnockoutStage, AdvancedBracketNode[]>;

type Props = {
  rounds: AdvancedBracketRounds;
};

const MAIN_ROUNDS: KnockoutStage[] = ["r32", "r16", "qf", "sf", "final"];
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

export default function AdvancedBracketTree({ rounds }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const sortedRounds = useMemo(() => sortRounds(rounds), [rounds]);
  const allMainNodes = MAIN_ROUNDS.flatMap((stage) => sortedRounds[stage]);
  const thirdPlace = sortedRounds["3p"];
  const bracketHeight = BASE_SLOTS * SLOT_H;
  const bracketWidth = MAIN_ROUNDS.length * CARD_W + (MAIN_ROUNDS.length - 1) * ROUND_GAP;

  const positions = useMemo(() => {
    const byCode = new Map<string, PositionedNode>();
    const byId = new Map<string, PositionedNode>();

    MAIN_ROUNDS.forEach((stage, roundIndex) => {
      sortedRounds[stage].forEach((node, matchIndex) => {
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
  }, [sortedRounds]);

  function toggleExpanded(matchId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(matchId)) next.delete(matchId);
      else next.add(matchId);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-black/15 p-4 shadow-2xl">
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
                    node={node}
                    expanded={expandedIds.has(node.matchId)}
                    onToggle={() => toggleExpanded(node.matchId)}
                  />
                </div>
              ))}
            </div>
          ))}
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
  fluid = false,
}: {
  node: AdvancedBracketNode;
  expanded: boolean;
  onToggle: () => void;
  fluid?: boolean;
}) {
  const pred = node.userPrediction;
  const borderColor = matchBorderColor(node);
  const status = statusText(node.status);
  const pickedTeamId = pred?.predictedWinnerTeamId ?? null;
  const actualWinnerId = node.winnerTeamId;

  return (
    <article
      className="overflow-hidden rounded-lg border bg-app-deep/95 shadow-xl transition-all"
      style={{
        width: fluid ? "100%" : CARD_W,
        borderColor,
        boxShadow: expanded ? "0 20px 50px rgba(0,0,0,0.45)" : undefined,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="block w-full text-left"
        style={{ minHeight: CARD_H }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-app-accent/75">
              {node.bracketCode}
            </span>
            <span className="truncate text-[10px] font-semibold uppercase tracking-widest text-white/30">
              {status}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <PredictionPill node={node} />
            <span className="flex h-5 w-5 items-center justify-center rounded border border-white/15 bg-white/5 text-xs font-black text-white/45">
              {expanded ? "-" : "+"}
            </span>
          </div>
        </div>

        <div className="space-y-1.5 px-3 py-2.5">
          <TeamLine
            team={node.homeTeam}
            score={node.homeScore}
            won={node.knockoutWinner === "home"}
            picked={pickedTeamId === node.homeTeam?.id}
            actualWinner={actualWinnerId === node.homeTeam?.id}
          />
          <TeamLine
            team={node.awayTeam}
            score={node.awayScore}
            won={node.knockoutWinner === "away"}
            picked={pickedTeamId === node.awayTeam?.id}
            actualWinner={actualWinnerId === node.awayTeam?.id}
          />
        </div>
      </button>

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
}: {
  team: { id: string; name: string } | null;
  score: number | null;
  won: boolean;
  picked: boolean;
  actualWinner: boolean;
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

  return (
    <div
      className="flex h-8 items-center justify-between gap-2 rounded-lg border px-2 text-sm"
      style={style}
    >
      <span className="min-w-0 truncate font-semibold text-white/78">
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
    </div>
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
