import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatWithTime, stageLabel, teamFlag, TOURNAMENT_START } from "@/lib/utils";
import {
  MOCK_EVENTS,
  MOCK_STATS,
  MOCK_MATCH_OVERRIDE,
  MOCK_HALFTIME,
  type MockEvent,
  type MockStats,
} from "@/lib/mock-live";
import { calculateGroupScore } from "@/lib/scoring";
import PredictionForm from "@/components/PredictionForm";
import MatchResult from "@/components/ResultsPodium";
import LiveRefresh from "@/components/LiveRefresh";
import LiveMatchDetails from "@/components/LiveMatchDetails";

const USE_MOCK = process.env.USE_MOCK_LIVE === "true";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user!.id as string;

  const dbMatch = await prisma.match.findUnique({
    where: { id },
    include: { homeTeam: true, awayTeam: true },
  });

  if (!dbMatch) notFound();

  // Round 1: memberships (with group members + this match's predictions), own predictions
  const [memberships, existingPredictions] = await Promise.all([
    prisma.groupMembership.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            members: { orderBy: { joinedAt: "asc" } },
            predictions: {
              where: { matchId: id },
              select: { userId: true, groupId: true, predictedHome: true, predictedAway: true, predictedWinner: true, score: true },
            },
          },
        },
      },
    }),
    prisma.prediction.findMany({ where: { userId, matchId: id } }),
  ]);

  // Round 2: User display names for all group members (no FK relation exists on GroupMembership)
  const allMemberUserIds = [
    ...new Set(memberships.flatMap((m) => m.group.members.map((gm) => gm.userId))),
  ];
  const memberUsers = await prisma.user.findMany({
    where: { id: { in: allMemberUserIds } },
    select: { id: true, displayName: true, email: true },
  });

  const now = new Date();

  // ---------------------------------------------------------------------------
  // Mock override — inject fake "live" state for UI development
  // ---------------------------------------------------------------------------
  const match = USE_MOCK
    ? {
        ...dbMatch,
        status: MOCK_MATCH_OVERRIDE.status,
        homeScore: MOCK_MATCH_OVERRIDE.homeScore,
        awayScore: MOCK_MATCH_OVERRIDE.awayScore,
        minute: MOCK_MATCH_OVERRIDE.minute,
      }
    : dbMatch;

  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";
  const isPast = isCompleted || isLive || match.scheduledAt < now;
  const hasScore = (isLive || isCompleted) && match.homeScore !== null && match.awayScore !== null;
  const isKnockout = match.stage !== "group";
  const groupStageLocked = match.stage === "group" && now >= TOURNAMENT_START;
  const isTeamTBD = match.homeTeam.id === "TBD" || match.awayTeam.id === "TBD";

  function teamName(id: string, name: string) {
    return id === "TBD" ? "Okänt lag" : name;
  }

  // ---------------------------------------------------------------------------
  // Fetch live events + statistics (real API or mock)
  // ---------------------------------------------------------------------------
  let liveEvents: MockEvent[] | null = null;
  let liveStats: MockStats | null = null;
  let halftime: { home: number; away: number } | null = null;

  if (isLive || isCompleted) {
    if (USE_MOCK) {
      liveEvents = MOCK_EVENTS;
      liveStats = MOCK_STATS;
      halftime = MOCK_HALFTIME;
    }
    // TheSportsDB free tier does not provide live events or statistics.
  }

  const showLiveDetails = (liveEvents !== null) && (liveEvents.length > 0 || liveStats !== null);

  // ---------------------------------------------------------------------------
  // Live prediction status
  // ---------------------------------------------------------------------------
  // Use the first existing prediction (score is same regardless of group)
  const firstPred = existingPredictions[0] ?? null;
  const showPredStatus =
    (isLive || isCompleted) &&
    firstPred &&
    hasScore &&
    match.stage === "group" &&
    firstPred.predictedHome !== null &&
    firstPred.predictedAway !== null;

  const currentPts = showPredStatus
    ? calculateGroupScore(
        firstPred.predictedHome!,
        firstPred.predictedAway!,
        match.homeScore!,
        match.awayScore!
      )
    : null;

  // ---------------------------------------------------------------------------
  // Group tips — everyone's predictions for this match
  // ---------------------------------------------------------------------------
  const groupTipsData = memberships.map((membership) => ({
    groupId: membership.groupId,
    groupName: membership.group.name,
    members: membership.group.members.map((gm) => {
      const user = memberUsers.find((u) => u.id === gm.userId);
      const pred = membership.group.predictions.find((p) => p.userId === gm.userId) ?? null;

      let currentPoints: number | null = null;
      if (pred && hasScore) {
        if (isCompleted && pred.score !== null) {
          currentPoints = pred.score;
        } else if (isLive && match.stage === "group" && pred.predictedHome !== null && pred.predictedAway !== null) {
          currentPoints = calculateGroupScore(pred.predictedHome, pred.predictedAway, match.homeScore!, match.awayScore!);
        }
      }

      return {
        userId: gm.userId,
        name: user?.displayName || user?.email?.split("@")[0] || "Spelare",
        isCurrentUser: gm.userId === userId,
        prediction: pred,
        currentPoints,
      };
    }),
  }));

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Auto-refresh every 30s while live */}
      {isLive && <LiveRefresh intervalMs={30_000} />}

      {/* Match header */}
      <div
        className="glass-card"
        style={isLive ? { borderColor: "rgba(239,68,68,0.35)" } : undefined}
      >
        <div className="flex items-center gap-4 mb-3">
          <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-app-accent/75">
            {match.stage === "group" && match.group
              ? `Grupp ${match.group}`
              : stageLabel(match.stage)}
          </span>
          {isLive && (
            <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase text-red-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Live {match.minute && `· ${match.minute}'`}
            </span>
          )}
          {isCompleted && (
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-app-ice/60">
              Avslutad
            </span>
          )}
          {!isCompleted && !isLive && isPast && (
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-white/30">
              Passerad
            </span>
          )}
          {!isPast && (
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-app-pitch/80">
              Kommande
            </span>
          )}
        </div>

        {/* Teams + score */}
        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="flex-1 text-right">
            <p className={`text-xl font-bold leading-tight ${isTeamTBD ? "text-white/35 italic" : "text-white"}`}>
              {teamName(match.homeTeam.id, match.homeTeam.name)} {teamFlag(match.homeTeam.id)}
            </p>
            <p className="text-xs text-white/40 mt-0.5">Hemmalag</p>
          </div>
          <div className="text-center shrink-0 px-2">
            {hasScore ? (
              <p
                className="text-4xl font-black tabular-nums tracking-tight"
                style={{ color: isLive ? "#fca5a5" : "white" }}
              >
                {match.homeScore} – {match.awayScore}
              </p>
            ) : (
              <p className="text-2xl font-black text-white/30">vs</p>
            )}
          </div>
          <div className="flex-1 text-left">
            <p className={`text-xl font-bold leading-tight ${isTeamTBD ? "text-white/35 italic" : "text-white"}`}>
              {teamFlag(match.awayTeam.id)} {teamName(match.awayTeam.id, match.awayTeam.name)}
            </p>
            <p className="text-xs text-white/40 mt-0.5">Bortalag</p>
          </div>
        </div>

        {/* Knockout winner badge */}
        {isCompleted && isKnockout && match.knockoutWinner && (
          <div className="mt-4 text-center">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: "rgba(52,211,153,0.15)", color: "rgb(110,231,183)" }}
            >
              Vinnare:{" "}
              {match.knockoutWinner === "home" ? match.homeTeam.name : match.awayTeam.name}
            </span>
          </div>
        )}

        <p className="text-white/40 text-sm text-center mt-4">
          {formatWithTime(match.scheduledAt)} · {match.venue}, {match.city}
        </p>
      </div>

      {/* Live prediction status card */}
      {showPredStatus && currentPts !== null && (
        <LivePredictionStatus
          predHome={firstPred.predictedHome!}
          predAway={firstPred.predictedAway!}
          liveHome={match.homeScore!}
          liveAway={match.awayScore!}
          currentPts={currentPts}
          isLive={isLive}
          groupCount={existingPredictions.length}
        />
      )}

      {/* Group tips */}
      {memberships.length > 0 && (
        <GroupTipsSection
          groups={groupTipsData}
          isLive={isLive}
          isCompleted={isCompleted}
          isKnockout={isKnockout}
          hasScore={hasScore}
          homeTeamName={teamName(match.homeTeam.id, match.homeTeam.name)}
          awayTeamName={teamName(match.awayTeam.id, match.awayTeam.name)}
        />
      )}

      {/* Official result */}
      {isCompleted && hasScore && (
        <div className="glass-card">
          <h2 className="font-bold text-white mb-4">Officiellt resultat</h2>
          <MatchResult
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
            homeScore={match.homeScore!}
            awayScore={match.awayScore!}
          />
        </div>
      )}

      {/* Live events + statistics */}
      {showLiveDetails && (
        <LiveMatchDetails
          homeTeam={{ id: match.homeTeam.id, name: match.homeTeam.name }}
          awayTeam={{ id: match.awayTeam.id, name: match.awayTeam.name }}
          homeScore={match.homeScore ?? 0}
          awayScore={match.awayScore ?? 0}
          halftime={halftime}
          events={liveEvents!}
          stats={liveStats}
          isMock={USE_MOCK}
        />
      )}

      {/* Prediction form / locked prediction */}
      {memberships.length === 0 ? (
        <div className="glass-card text-center py-8">
          <p className="text-white/50 mb-3">Gå med i eller skapa en grupp för att tippa.</p>
          <div className="flex gap-3 justify-center">
            <Link href="/groups/create" className="btn-primary text-sm">Skapa grupp</Link>
            <Link href="/groups/join" className="btn-secondary text-sm">Gå med i grupp</Link>
          </div>
        </div>
      ) : (
        <PredictionForm
          match={{
            id: match.id,
            homeTeam: { id: match.homeTeam.id, name: teamName(match.homeTeam.id, match.homeTeam.name) },
            awayTeam: { id: match.awayTeam.id, name: teamName(match.awayTeam.id, match.awayTeam.name) },
            status: match.status,
            stage: match.stage,
          }}
          groups={memberships.map((m) => m.group)}
          existingPredictions={existingPredictions.map((p) => ({
            groupId: p.groupId,
            predictedHome: p.predictedHome,
            predictedAway: p.predictedAway,
            predictedWinner: p.predictedWinner,
            score: p.score,
          }))}
          locked={isLive || isPast || groupStageLocked}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Live prediction status — how is your tip holding up?
// ---------------------------------------------------------------------------

function LivePredictionStatus({
  predHome,
  predAway,
  liveHome,
  liveAway,
  currentPts,
  isLive,
  groupCount,
}: {
  predHome: number;
  predAway: number;
  liveHome: number;
  liveAway: number;
  currentPts: 0 | 1 | 3;
  isLive: boolean;
  groupCount: number;
}) {
  const ptsMeta: Record<
    number,
    { label: string; bg: string; border: string; color: string }
  > = {
    3: {
      label: "Exakt rätt!",
      bg: "rgba(52,211,153,0.12)",
      border: "rgba(52,211,153,0.35)",
      color: "rgb(110,231,183)",
    },
    1: {
      label: "Rätt resultat",
      bg: "rgba(251,191,36,0.10)",
      border: "rgba(251,191,36,0.35)",
      color: "rgb(253,224,71)",
    },
    0: {
      label: "Fel resultat",
      bg: "rgba(239,68,68,0.08)",
      border: "rgba(239,68,68,0.30)",
      color: "rgb(252,165,165)",
    },
  };

  const meta = ptsMeta[currentPts];

  return (
    <div
      className="glass-card"
      style={{ borderColor: meta.border, background: meta.bg }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: meta.color }}>
          {isLive ? "Ditt tip just nu" : "Ditt tip"}
        </p>
        <span
          className="text-lg font-black tabular-nums"
          style={{ color: meta.color }}
        >
          {currentPts} <span className="text-xs font-normal opacity-60">/ 3 p</span>
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Prediction */}
        <div className="flex-1 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Ditt tips</p>
          <p className="text-2xl font-black tabular-nums text-white/70">
            {predHome} – {predAway}
          </p>
        </div>

        {/* Status badge */}
        <div className="shrink-0 text-center px-2">
          <span
            className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
            style={{ background: meta.border, color: meta.color }}
          >
            {meta.label}
          </span>
        </div>

        {/* Live score */}
        <div className="flex-1 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">
            {isLive ? "Just nu" : "Slutresultat"}
          </p>
          <p
            className="text-2xl font-black tabular-nums"
            style={{ color: isLive ? "#fca5a5" : "white" }}
          >
            {liveHome} – {liveAway}
          </p>
        </div>
      </div>

      {groupCount > 1 && (
        <p className="text-xs text-white/30 text-center mt-3">
          Gäller för alla dina {groupCount} grupper
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group tips section — everyone's predictions for this match
// ---------------------------------------------------------------------------

type MemberTip = {
  userId: string;
  name: string;
  isCurrentUser: boolean;
  prediction: {
    predictedHome: number | null;
    predictedAway: number | null;
    predictedWinner: string | null;
    score: number | null;
  } | null;
  currentPoints: number | null;
};

type GroupTips = {
  groupId: string;
  groupName: string;
  members: MemberTip[];
};

function GroupTipsSection({
  groups,
  isLive,
  isCompleted,
  isKnockout,
  hasScore,
  homeTeamName,
  awayTeamName,
}: {
  groups: GroupTips[];
  isLive: boolean;
  isCompleted: boolean;
  isKnockout: boolean;
  hasScore: boolean;
  homeTeamName: string;
  awayTeamName: string;
}) {
  const showPoints = (isLive || isCompleted) && hasScore;
  const multipleGroups = groups.length > 1;

  const sortedGroups = groups.map((g) => ({
    ...g,
    members: showPoints
      ? [...g.members].sort((a, b) => (b.currentPoints ?? -1) - (a.currentPoints ?? -1))
      : g.members,
  }));

  function ptsBadgeStyle(pts: number): { bg: string; color: string } {
    if (pts >= 3) return { bg: "rgba(52,211,153,0.15)", color: "rgb(52,211,153)" };
    if (pts === 2) return { bg: "rgba(52,211,153,0.10)", color: "rgb(110,231,183)" };
    if (pts === 1) return { bg: "rgba(251,191,36,0.15)", color: "rgb(253,224,71)" };
    return { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.30)" };
  }

  return (
    <div className="glass-card">
      <h2 className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-4">
        {isLive ? "Gruppen tippar — live" : isCompleted ? "Gruppen tippade" : "Gruppen tippar"}
      </h2>

      <div className="space-y-5">
        {sortedGroups.map((group) => (
          <div key={group.groupId}>
            {multipleGroups && (
              <p className="text-[10px] font-bold uppercase tracking-widest text-app-accent/60 mb-2">
                {group.groupName}
              </p>
            )}

            <div className="space-y-1.5">
              {group.members.map((member) => {
                const pred = member.prediction;
                const badge = member.currentPoints !== null ? ptsBadgeStyle(member.currentPoints) : null;

                let tipLabel: string | null = null;
                if (pred) {
                  if (isKnockout) {
                    if (pred.predictedWinner === "home") tipLabel = homeTeamName;
                    else if (pred.predictedWinner === "away") tipLabel = awayTeamName;
                  } else if (pred.predictedHome !== null && pred.predictedAway !== null) {
                    tipLabel = `${pred.predictedHome} – ${pred.predictedAway}`;
                  }
                }

                return (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={
                      member.isCurrentUser
                        ? { background: "rgba(184,240,200,0.07)", border: "1px solid rgba(184,240,200,0.14)" }
                        : { background: "rgba(255,255,255,0.03)" }
                    }
                  >
                    {/* Initials avatar */}
                    <span
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0"
                      style={
                        member.isCurrentUser
                          ? { background: "rgba(184,240,200,0.18)", color: "rgb(184,240,200)" }
                          : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)" }
                      }
                    >
                      {member.name[0].toUpperCase()}
                    </span>

                    {/* Name */}
                    <span
                      className="flex-1 text-sm font-medium truncate"
                      style={{ color: member.isCurrentUser ? "rgb(184,240,200)" : "rgba(255,255,255,0.65)" }}
                    >
                      {member.name}
                      {member.isCurrentUser && (
                        <span className="ml-1.5 text-[10px] font-bold opacity-50">(du)</span>
                      )}
                    </span>

                    {/* Tip */}
                    <span className="text-sm font-bold tabular-nums shrink-0"
                      style={{ color: tipLabel ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.18)" }}>
                      {tipLabel ?? "–"}
                    </span>

                    {/* Points badge */}
                    {showPoints && (
                      <span
                        className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full shrink-0 min-w-[36px] text-center"
                        style={
                          badge && pred
                            ? { background: badge.bg, color: badge.color }
                            : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.20)" }
                        }
                      >
                        {pred ? `${member.currentPoints ?? "–"} p` : "–"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
