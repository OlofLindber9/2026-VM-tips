import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format, isPlaceholderTeamId, liveMinuteLabel, teamFlag } from "@/lib/utils";
import TournamentCountdown from "@/components/TournamentCountdown";
import { applyMockIfEnabled } from "@/lib/mock-live";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id as string;
  const displayName = session!.user?.name || session!.user?.email?.split("@")[0] || "Spelare";

  const [
    upcomingMatchesRaw,
    memberships,
    groupMatchCount,
    knockoutMatchCount,
  ] = await Promise.all([
    prisma.match.findMany({
      where: {
        OR: [
          { status: "upcoming", scheduledAt: { gte: new Date() } },
          { status: "live" },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      take: 3,
      include: { homeTeam: true, awayTeam: true },
    }),
    prisma.groupMembership.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            members: true,
            _count: { select: { members: true } },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    }),
    prisma.match.count({ where: { stage: "group" } }),
    prisma.match.count({ where: { stage: { not: "group" } } }),
  ]);

  const upcomingMatches = applyMockIfEnabled(upcomingMatchesRaw);
  const isInGroup = memberships.length > 0;

  // ---------------------------------------------------------------------------
  // Standings data
  // ---------------------------------------------------------------------------

  const groupIds = memberships.map((m) => m.groupId);

  const [
    groupPredictionCounts,
    knockoutPredictionCounts,
    totalScores,
    groupStageScores,
    knockoutScores,
    memberUsers,
  ] = groupIds.length > 0
    ? await Promise.all([
        prisma.prediction.groupBy({
          by: ["groupId"],
          where: { userId, groupId: { in: groupIds }, match: { stage: "group" } },
          _count: { _all: true },
        }),
        prisma.prediction.groupBy({
          by: ["groupId"],
          where: { userId, groupId: { in: groupIds }, match: { stage: { not: "group" } } },
          _count: { _all: true },
        }),
        prisma.prediction.groupBy({
          by: ["userId", "groupId"],
          where: { groupId: { in: groupIds } },
          _sum: { score: true },
        }),
        prisma.prediction.groupBy({
          by: ["userId", "groupId"],
          where: { groupId: { in: groupIds }, match: { stage: "group" } },
          _sum: { score: true },
        }),
        prisma.prediction.groupBy({
          by: ["userId", "groupId"],
          where: { groupId: { in: groupIds }, match: { stage: { not: "group" } } },
          _sum: { score: true },
        }),
        prisma.user.findMany({
          where: {
            id: {
              in: [
                ...new Set(
                  memberships.flatMap((m) => m.group.members.map((gm) => gm.userId))
                ),
              ],
            },
          },
          select: { id: true, displayName: true },
        }),
      ])
    : [[], [], [], [], [], []];

  const groupPredictionCountByGroupId = new Map(
    groupPredictionCounts.map((row) => [row.groupId, row._count._all])
  );
  const knockoutPredictionCountByGroupId = new Map(
    knockoutPredictionCounts.map((row) => [row.groupId, row._count._all])
  );

  const tipStatusByGroup = memberships.map((membership) => {
    const groupPredictedCount = groupPredictionCountByGroupId.get(membership.groupId) ?? 0;
    const knockoutPredictedCount = knockoutPredictionCountByGroupId.get(membership.groupId) ?? 0;
    const groupPct = groupMatchCount > 0 ? Math.round((groupPredictedCount / groupMatchCount) * 100) : 0;
    const knockoutPct = knockoutMatchCount > 0 ? Math.round((knockoutPredictedCount / knockoutMatchCount) * 100) : 0;
    const groupDone = groupMatchCount > 0 && groupPredictedCount >= groupMatchCount;
    const knockoutDone = knockoutMatchCount > 0 && knockoutPredictedCount >= knockoutMatchCount;

    return {
      groupId: membership.groupId,
      groupName: membership.group.name,
      groupPredictedCount,
      knockoutPredictedCount,
      groupPct,
      knockoutPct,
      groupDone,
      knockoutDone,
      allDone: groupDone && (knockoutMatchCount === 0 || knockoutDone),
    };
  });

  const hasOpenPredictions = tipStatusByGroup.some(
    (status) => !status.groupDone || (knockoutMatchCount > 0 && !status.knockoutDone)
  );

  const userNameMap = Object.fromEntries(memberUsers.map((u) => [u.id, u.displayName]));

  function memberDisplayName(uid: string): string {
    if (uid === userId) return session!.user?.name || userNameMap[uid] || "Spelare";
    return userNameMap[uid] || "Deltagare";
  }

  function teamName(id: string, name: string): string {
    return isPlaceholderTeamId(id) ? "Okänt lag" : name;
  }

  function scoreMapFor(rows: typeof totalScores, groupId: string): Record<string, number> {
    return Object.fromEntries(
      rows
        .filter((s) => s.groupId === groupId)
        .map((s) => [s.userId, s._sum.score ?? 0])
    );
  }

  const standingsByGroup = memberships.map((membership) => {
    const group = membership.group;
    const totalScoreMap = scoreMapFor(totalScores, group.id);
    const groupStageScoreMap = scoreMapFor(groupStageScores, group.id);
    const knockoutScoreMap = scoreMapFor(knockoutScores, group.id);

    function buildLeaderboard(scoreMap: Record<string, number>) {
      return group.members
        .map((m) => ({
          userId: m.userId,
          name: memberDisplayName(m.userId),
          score: scoreMap[m.userId] ?? 0,
          isCurrentUser: m.userId === userId,
        }))
        .sort((a, b) => b.score - a.score);
    }

    const totalLeaderboard = buildLeaderboard(totalScoreMap);
    const userRank = totalLeaderboard.findIndex((e) => e.isCurrentUser);

    return {
      groupId: group.id,
      groupName: group.name,
      leaderboard: totalLeaderboard,
      leaderboards: {
        total: totalLeaderboard,
        groupStage: buildLeaderboard(groupStageScoreMap),
        knockout: buildLeaderboard(knockoutScoreMap),
      },
      userRank,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Välkommen, {displayName}!
        </h1>
        <p className="text-white/50 mt-1">Här är din översikt.</p>
      </div>

      <TournamentCountdown />

      {/* Prediction progress — only shown when user is in at least one group */}
      {isInGroup && groupMatchCount > 0 && (
        <div className="glass-card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-white">Din tipsstatus</h2>
            {tipStatusByGroup.length > 1 && (
              <span className="text-xs font-semibold uppercase tracking-widest text-white/35">
                {tipStatusByGroup.length} grupper
              </span>
            )}
          </div>

          <div className="divide-y divide-white/8">
            {tipStatusByGroup.map((status) => (
              <div key={status.groupId} className="py-4 first:pt-0 last:pb-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Link
                    href={`/groups/${status.groupId}`}
                    className="min-w-0 truncate text-sm font-bold text-white hover:text-app-ice transition-colors"
                  >
                    {status.groupName}
                  </Link>
                  {status.allDone && (
                    <span className="shrink-0 text-[11px] font-black uppercase tracking-widest text-app-ice">
                      Klart ✓
                    </span>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <PredictionStageProgress
                    label="Gruppspel"
                    predictedCount={status.groupPredictedCount}
                    totalCount={groupMatchCount}
                    pct={status.groupPct}
                    done={status.groupDone}
                    remainingSuffix="kvar att tippa i gruppspelet"
                  />

                  {knockoutMatchCount > 0 && (
                    <PredictionStageProgress
                      label="Slutspel"
                      predictedCount={status.knockoutPredictedCount}
                      totalCount={knockoutMatchCount}
                      pct={status.knockoutPct}
                      done={status.knockoutDone}
                      accent="gold"
                      remainingSuffix="kvar att tippa i slutspelet"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasOpenPredictions && (
            <Link
              href="/matcher"
              className="btn-primary block w-full text-center text-sm mt-4"
            >
              Tippa matcher →
            </Link>
          )}
        </div>
      )}

      {/* Standings */}
      {isInGroup ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Ställningar</h2>
            <Link href="/groups" className="text-sm text-app-ice hover:text-white transition-colors">
              Mina grupper →
            </Link>
          </div>
          <div className={`grid gap-4 ${standingsByGroup.length > 1 ? "sm:grid-cols-2" : ""}`}>
            {standingsByGroup.map(({ groupId, groupName, leaderboard, leaderboards, userRank }) => (
              <div key={groupId} className="glass-card">
                <div className="flex justify-between items-center mb-4">
                  <Link
                    href={`/groups/${groupId}`}
                    className="font-bold text-white hover:text-app-ice transition-colors"
                  >
                    {groupName}
                  </Link>
                  <Link
                    href={`/groups/${groupId}`}
                    className="text-xs text-app-ice hover:text-white transition-colors"
                  >
                    Fullständig tabell →
                  </Link>
                </div>

                {leaderboard.length === 0 ? (
                  <p className="text-white/40 text-sm">Inga deltagare ännu.</p>
                ) : (
                  <div className="space-y-1.5">
                    <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/35">
                      Totalt
                    </p>
                    {leaderboard.map((entry, i) => {
                      const medals: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };
                      return (
                        <div
                          key={entry.userId}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border"
                          style={{
                            background: entry.isCurrentUser
                              ? "rgba(184, 240, 200, 0.10)"
                              : i === 0
                              ? "rgba(245, 200, 66, 0.08)"
                              : i === 1
                              ? "rgba(255, 255, 255, 0.05)"
                              : i === 2
                              ? "rgba(232, 160, 32, 0.06)"
                              : "rgba(255, 255, 255, 0.03)",
                            borderColor: entry.isCurrentUser
                              ? "rgba(184, 240, 200, 0.25)"
                              : i < 3
                              ? "rgba(232, 160, 32, 0.18)"
                              : "rgba(255, 255, 255, 0.07)",
                          }}
                        >
                          <span className="w-6 text-center text-base shrink-0">
                            {medals[i] ?? (
                              <span className="text-white/35 font-bold text-sm">{i + 1}</span>
                            )}
                          </span>
                          <span
                            className={`flex-1 text-sm font-medium truncate ${
                              entry.isCurrentUser ? "text-app-ice" : "text-white/90"
                            }`}
                          >
                            {entry.name}
                            {entry.isCurrentUser && (
                              <span className="ml-1.5 text-xs text-app-ice/55">(du)</span>
                            )}
                          </span>
                          <span className="font-bold text-app-accent tabular-nums text-sm shrink-0">
                            {entry.score}
                            <span className="ml-1 text-xs font-normal text-white/35">pts</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {leaderboards && (
                  <div className="mt-4 grid gap-3">
                    <DashboardLeaderboard title="Gruppspel" entries={leaderboards.groupStage} compact />
                    <DashboardLeaderboard title="Slutspel" entries={leaderboards.knockout} compact accent="gold" />
                  </div>
                )}

                {/* Current user's position summary if outside top 3 */}
                {userRank >= 3 && (
                  <p className="mt-3 text-xs text-white/40 text-center">
                    Du är på plats {userRank + 1} av {leaderboard.length}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass-card text-center py-6">
          <p className="text-white/50 text-sm mb-4">
            Gå med i en grupp för att se ställningar och tävla med kompisar.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/groups/create" className="btn-primary text-sm">Skapa grupp</Link>
            <Link href="/groups/join" className="btn-secondary text-sm">Gå med</Link>
          </div>
        </div>
      )}

      {/* Upcoming matches */}
      <div className="glass-card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-white">
            {upcomingMatches.some((m) => m.status === "live") ? "Live & kommande" : "Kommande matcher"}
          </h2>
          <Link href="/matcher" className="text-sm text-app-ice hover:text-white transition-colors">
            Visa alla →
          </Link>
        </div>
        {upcomingMatches.length === 0 ? (
          <p className="text-white/40 text-sm">Inga kommande matcher — kom tillbaka snart.</p>
        ) : (
          <div className="space-y-3">
            {upcomingMatches.map((m) => {
              const isLive = m.status === "live";
              const hasScore = isLive && m.homeScore !== null && m.awayScore !== null;
              return (
                <Link
                  key={m.id}
                  href={`/matcher/${m.id}`}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all
                    ${isLive
                      ? "border-red-500/40 bg-red-500/5 hover:border-red-500/60 hover:bg-red-500/10"
                      : "border-white/10 hover:border-white/25 hover:bg-white/8"
                    }`}
                >
                  <div>
                    <div className="font-medium text-sm text-white/90">
                      {teamName(m.homeTeam.id, m.homeTeam.name)} {teamFlag(m.homeTeam.id)} vs {teamFlag(m.awayTeam.id)} {teamName(m.awayTeam.id, m.awayTeam.name)}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {format(m.scheduledAt)} · {m.city}
                    </div>
                  </div>
                  {isLive ? (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="flex items-center gap-1 text-[11px] font-bold tracking-[0.1em] uppercase text-red-400">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Live{m.minute && ` · ${liveMinuteLabel(m.minute)}`}
                      </span>
                      {hasScore && (
                        <span className="text-sm font-black tabular-nums text-white/80">
                          {m.homeScore} – {m.awayScore}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-app-accent/70 shrink-0">Tippa →</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

type DashboardLeaderboardEntry = {
  userId: string;
  name: string;
  score: number;
  isCurrentUser: boolean;
};

function DashboardLeaderboard({
  title,
  entries,
  compact = false,
  accent = "green",
}: {
  title: string;
  entries: DashboardLeaderboardEntry[];
  compact?: boolean;
  accent?: "green" | "gold";
}) {
  const scoreColor = accent === "gold" ? "text-app-gold" : "text-app-ice";

  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{ background: "rgba(255,255,255,0.035)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/35">
        {title}
      </p>
      <div className="space-y-1.5">
        {entries.map((entry, i) => (
          <div
            key={entry.userId}
            className={`flex items-center gap-2 rounded-lg ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}
            style={{
              background: entry.isCurrentUser
                ? "rgba(184, 240, 200, 0.08)"
                : "rgba(255, 255, 255, 0.03)",
            }}
          >
            <span className="w-5 shrink-0 text-center text-xs font-bold text-white/35">{i + 1}</span>
            <span
              className={`min-w-0 flex-1 truncate ${compact ? "text-xs" : "text-sm"} font-semibold ${
                entry.isCurrentUser ? "text-app-ice" : "text-white/75"
              }`}
            >
              {entry.name}
            </span>
            <span className={`shrink-0 text-sm font-black tabular-nums ${scoreColor}`}>
              {entry.score}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PredictionStageProgress({
  label,
  predictedCount,
  totalCount,
  pct,
  done,
  accent = "green",
  remainingSuffix,
}: {
  label: string;
  predictedCount: number;
  totalCount: number;
  pct: number;
  done: boolean;
  accent?: "green" | "gold";
  remainingSuffix: string;
}) {
  const remaining = Math.max(totalCount - predictedCount, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-white/60 font-medium">{label}</span>
        <span className={`font-bold tabular-nums ${done ? "text-app-ice" : "text-white/70"}`}>
          {predictedCount} / {totalCount}
        </span>
      </div>
      <ProgressBar pct={pct} done={done} accent={accent} />
      {done ? (
        <p className="text-xs font-semibold text-app-ice/75">Klart i den här gruppen</p>
      ) : (
        <p className="text-xs text-white/50">
          {remaining} match{remaining !== 1 ? "er" : ""} {remainingSuffix}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress bar component
// ---------------------------------------------------------------------------

function ProgressBar({ pct, done, accent = "green" }: { pct: number; done: boolean; accent?: "green" | "gold" }) {
  const fillColor =
    accent === "gold"
      ? "linear-gradient(90deg, #e8a020, #f5c842)"
      : "linear-gradient(90deg, #2d6a4f, #6ee7a0)";

  return (
    <div
      className="relative h-3 rounded-full overflow-hidden"
      style={{ background: "rgba(255,255,255,0.12)" }}
    >
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
        style={{
          width: `${pct}%`,
          background: fillColor,
          boxShadow: done
            ? accent === "gold"
              ? "0 0 10px rgba(245,200,66,0.5)"
              : "0 0 10px rgba(82,201,122,0.5)"
            : "none",
        }}
      />
    </div>
  );
}
