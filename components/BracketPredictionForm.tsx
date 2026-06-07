"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AdvancedBracketNode,
  AdvancedBracketRounds,
} from "@/components/AdvancedBracketTree";
import { formatWithTime, stageLabel, teamFlag } from "@/lib/utils";
import type { KnockoutStage } from "@/lib/bracket";

type BracketTeam = { id: string; name: string };
type MatchParticipants = { home: BracketTeam | null; away: BracketTeam | null };
type PickValue = {
  predictedWinnerTeamId: string | null;
  predictedHome: number | null;
  predictedAway: number | null;
};
type PickState = Record<string, PickValue>;

type Props = {
  rounds: AdvancedBracketRounds;
  groupId: string;
  firstKnockoutStartsAt: string | null;
};

const STAGE_ORDER: KnockoutStage[] = ["r32", "r16", "qf", "sf", "3p", "final"];
const DISPLAY_ORDER: KnockoutStage[] = ["r32", "r16", "qf", "sf", "final", "3p"];

export default function BracketPredictionForm({
  rounds,
  groupId,
  firstKnockoutStartsAt,
}: Props) {
  const router = useRouter();
  const sortedRounds = useMemo(() => sortRounds(rounds), [rounds]);
  const allNodes = useMemo(
    () => DISPLAY_ORDER.flatMap((stage) => sortedRounds[stage]),
    [sortedRounds]
  );
  const [picks, setPicks] = useState<PickState>(() =>
    sanitizePicks(sortedRounds, initialPicks(sortedRounds))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const participants = useMemo(
    () => computeParticipants(sortedRounds, picks),
    [sortedRounds, picks]
  );
  const missingNodes = useMemo(
    () => incompleteNodes(sortedRounds, picks, participants),
    [sortedRounds, picks, participants]
  );
  const canSave = missingNodes.length === 0 && !saving;
  const completedCount = allNodes.length - missingNodes.length;

  function updateWinner(node: AdvancedBracketNode, teamId: string) {
    setError("");
    setSaved(false);
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
    setError("");
    setSaved(false);
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
    if (!canSave) return;
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch("/api/bracket/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        groupId,
        predictions: STAGE_ORDER.flatMap((stage) => sortedRounds[stage]).map((node) => {
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
      setError(data.error || "Det gick inte att spara slutspelstipset.");
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <div className="glass-card space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-white">Lägg slutspelstips</h2>
          {firstKnockoutStartsAt && (
            <p className="mt-1 text-xs text-white/40">
              Deadline: {formatWithTime(new Date(firstKnockoutStartsAt))}
            </p>
          )}
        </div>
        <span
          className="rounded-lg border px-3 py-1.5 text-xs font-black uppercase tracking-widest"
          style={{
            background: "rgba(232,160,32,0.12)",
            borderColor: "rgba(232,160,32,0.28)",
            color: "#f5c842",
          }}
        >
          {completedCount}/{allNodes.length}
        </span>
      </div>

      <div className="space-y-6">
        {DISPLAY_ORDER.map((stage) => {
          const nodes = sortedRounds[stage];
          if (nodes.length === 0) return null;
          return (
            <section key={stage} className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-white/45">
                  {stageLabel(stage)}
                </h3>
                <span className="text-xs font-semibold text-white/25">
                  {nodes.length} {nodes.length === 1 ? "match" : "matcher"}
                </span>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {nodes.map((node) => (
                  <PredictionCard
                    key={node.matchId}
                    node={node}
                    participants={participants.get(node.matchId) ?? { home: null, away: null }}
                    pick={picks[node.matchId] ?? emptyPick()}
                    onPick={(teamId) => updateWinner(node, teamId)}
                    onFinalScore={(side, value) => updateFinalScore(node.matchId, side, value)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-900/25 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-200">
          Slutspelstipset är sparat.
        </div>
      )}

      <button
        type="button"
        disabled={!canSave}
        onClick={saveBracket}
        className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-45"
      >
        {saving ? "Sparar..." : "Spara hela slutspelsträdet"}
      </button>
    </div>
  );
}

function PredictionCard({
  node,
  participants,
  pick,
  onPick,
  onFinalScore,
}: {
  node: AdvancedBracketNode;
  participants: MatchParticipants;
  pick: PickValue;
  onPick: (teamId: string) => void;
  onFinalScore: (side: "home" | "away", value: string) => void;
}) {
  const missingTeams = !participants.home || !participants.away;
  return (
    <article className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-widest text-app-accent/70">
          {node.bracketCode}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">
          {node.stage === "final" ? "5 p" : "2 p"}
        </span>
      </div>

      <div className="space-y-2">
        <TeamPickButton
          team={participants.home}
          selected={pick.predictedWinnerTeamId === participants.home?.id}
          disabled={missingTeams}
          onClick={onPick}
        />
        <TeamPickButton
          team={participants.away}
          selected={pick.predictedWinnerTeamId === participants.away?.id}
          disabled={missingTeams}
          onClick={onPick}
        />
      </div>

      {missingTeams && (
        <p className="mt-2 text-xs text-white/30">
          Väntar på tidigare val
        </p>
      )}

      {node.stage === "final" && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/5 p-2.5">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/35">
            90 min
          </p>
          <div className="flex items-center gap-2">
            <ScoreInput
              value={pick.predictedHome}
              disabled={missingTeams || !pick.predictedWinnerTeamId}
              onChange={(value) => onFinalScore("home", value)}
            />
            <span className="text-sm font-black text-white/30">-</span>
            <ScoreInput
              value={pick.predictedAway}
              disabled={missingTeams || !pick.predictedWinnerTeamId}
              onChange={(value) => onFinalScore("away", value)}
            />
          </div>
        </div>
      )}
    </article>
  );
}

function TeamPickButton({
  team,
  selected,
  disabled,
  onClick,
}: {
  team: BracketTeam | null;
  selected: boolean;
  disabled: boolean;
  onClick: (teamId: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || !team}
      onClick={() => team && onClick(team.id)}
      className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border px-2 text-left text-sm font-semibold transition-colors disabled:cursor-not-allowed"
      style={
        selected
          ? {
              background: "rgba(232,160,32,0.16)",
              borderColor: "rgba(232,160,32,0.42)",
              color: "#f5c842",
            }
          : {
              background: "rgba(255,255,255,0.045)",
              borderColor: "rgba(255,255,255,0.09)",
              color: team ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.24)",
            }
      }
    >
      <span className="min-w-0 truncate">
        {team ? (
          <>
            <span className="mr-1">{teamFlag(team.id)}</span>
            {team.name}
          </>
        ) : (
          "Ej klart"
        )}
      </span>
      {selected && (
        <span className="shrink-0 rounded bg-app-accent/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
          Tips
        </span>
      )}
    </button>
  );
}

function ScoreInput({
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
      className="h-10 w-full rounded-lg border border-white/10 bg-black/25 px-2 text-center text-lg font-black tabular-nums text-white outline-none focus:border-app-accent/60 disabled:opacity-40"
    />
  );
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
    const matchParticipants = participants.get(node.matchId) ?? { home: null, away: null };
    if (!selectedTeam(pick.predictedWinnerTeamId, matchParticipants)) return true;
    if (node.stage === "final" && (pick.predictedHome === null || pick.predictedAway === null)) {
      return true;
    }
    return false;
  });
}

function sanitizePicks(rounds: AdvancedBracketRounds, picks: PickState): PickState {
  let next = clonePicks(picks);
  for (let pass = 0; pass < STAGE_ORDER.length; pass++) {
    let changed = false;
    const participants = computeParticipants(rounds, next);
    for (const node of allRoundNodes(rounds)) {
      const pick = next[node.matchId] ?? emptyPick();
      if (
        pick.predictedWinnerTeamId &&
        !selectedTeam(pick.predictedWinnerTeamId, participants.get(node.matchId) ?? { home: null, away: null })
      ) {
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
      const matchParticipants =
        participants.get(node.matchId) ?? actualParticipants(node);
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

function allRoundNodes(rounds: AdvancedBracketRounds): AdvancedBracketNode[] {
  return STAGE_ORDER.flatMap((stage) => rounds[stage]);
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

function emptyPick(): PickValue {
  return { predictedWinnerTeamId: null, predictedHome: null, predictedAway: null };
}

function clonePicks(picks: PickState): PickState {
  return Object.fromEntries(
    Object.entries(picks).map(([matchId, pick]) => [matchId, { ...pick }])
  );
}
