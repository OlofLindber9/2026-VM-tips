import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format, teamFlag } from "@/lib/utils";
import TournamentCountdown from "@/components/TournamentCountdown";
import { applyMockIfEnabled } from "@/lib/mock-live";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id as string;
  const displayName = session!.user?.name || session!.user?.email?.split("@")[0] || "Spelare";

  const [
    upcomingMatchesRaw,
    memberships,
    recentPredictions,
    groupMatchCount,
    groupPredictedMatches,
    knockoutMatchCount,
    knockoutPredictedRaw,
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
      take: 5,
      orderBy: { joinedAt: "desc" },
    }),
    prisma.prediction.findMany({
      where: { userId, score: { not: null } },
      include: { match: { include: { homeTeam: true, awayTeam: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.match.count({ where: { stage: "group" } }),
    prisma.prediction.findMany({
      where: { userId, match: { stage: "group" } },
      select: { matchId: true },
      distinct: ["matchId"],
    }),
    prisma.match.count({ where: { stage: { not: "group" }, status: "upcoming" } }),
    prisma.prediction.findMany({
      where: { userId, match: { stage: { not: "group" } } },
      select: { matchId: true },
      distinct: ["matchId"],
    }),
  ]);

  const upcomingMatches = applyMockIfEnabled(upcomingMatchesRaw);

  const groupPredictedCount = groupPredictedMatches.length;
  const knockoutPredictedCount = knockoutPredictedRaw.length;
  const groupPct = groupMatchCount > 0 ? Math.round((groupPredictedCount / groupMatchCount) * 100) : 0;
  const knockoutPct = knockoutMatchCount > 0 ? Math.round((knockoutPredictedCount / knockoutMatchCount) * 100) : 0;
  const groupDone = groupMatchCount > 0 && groupPredictedCount >= groupMatchCount;
  const knockoutDone = knockoutMatchCount > 0 && knockoutPredictedCount >= knockoutMatchCount;

  const isInGroup = memberships.length > 0;

  // ---------------------------------------------------------------------------
  // Standings data
  // ---------------------------------------------------------------------------

  const groupIds = memberships.map((m) => m.groupId);

  const [groupScores, memberUsers] = groupIds.length > 0
    ? await Promise.all([
        prisma.prediction.groupBy({
          by: ["userId", "groupId"],
          where: { groupId: { in: groupIds } },
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
    : [[], []];

  const userNameMap = Object.fromEntries(memberUsers.map((u) => [u.id, u.displayName]));

  function memberDisplayName(uid: string): string {
    if (uid === userId) return session!.user?.name || userNameMap[uid] || "Spelare";
    return userNameMap[uid] || "Deltagare";
  }

  const standingsByGroup = memberships.map((membership) => {
    const group = membership.group;
    const scoresForGroup = groupScores.filter((s) => s.groupId === group.id);
    const scoreMap = Object.fromEntries(
      scoresForGroup.map((s) => [s.userId, s._sum.score ?? 0])
    );

    const leaderboard = group.members
      .map((m) => ({
        userId: m.userId,
        name: memberDisplayName(m.userId),
        score: scoreMap[m.userId] ?? 0,
        isCurrentUser: m.userId === userId,
      }))
      .sort((a, b) => b.score - a.score);

    // Find current user's rank (0-indexed)
    const userRank = leaderboard.findIndex((e) => e.isCurrentUser);

    return { groupId: group.id, groupName: group.name, leaderboard, userRank };
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
          <h2 className="font-bold text-white">Din tipsstatus</h2>

          {/* Group stage progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60 font-medium">Gruppspel</span>
              <span className={`font-bold tabular-nums ${groupDone ? "text-app-ice" : "text-white/70"}`}>
                {groupPredictedCount} / {groupMatchCount}
                {groupDone && <span className="ml-1.5 text-[11px] font-black uppercase tracking-widest">Klart ✓</span>}
              </span>
            </div>
            <ProgressBar pct={groupPct} done={groupDone} />
            {!groupDone && (
              <p className="text-xs text-white/50">
                {groupMatchCount - groupPredictedCount} match{groupMatchCount - groupPredictedCount !== 1 ? "er" : ""} kvar att tippa innan VM startar
              </p>
            )}
          </div>

          {/* Knockout progress — only shown when knockout matches exist */}
          {knockoutMatchCount > 0 && (
            <div className="space-y-2 pt-3 border-t border-white/8">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/60 font-medium">Slutspel</span>
                <span className={`font-bold tabular-nums ${knockoutDone ? "text-app-ice" : "text-white/70"}`}>
                  {knockoutPredictedCount} / {knockoutMatchCount}
                  {knockoutDone && <span className="ml-1.5 text-[11px] font-black uppercase tracking-widest">Klart ✓</span>}
                </span>
              </div>
              <ProgressBar pct={knockoutPct} done={knockoutDone} accent="gold" />
              {!knockoutDone && (
                <p className="text-xs text-white/50">
                  {knockoutMatchCount - knockoutPredictedCount} match{knockoutMatchCount - knockoutPredictedCount !== 1 ? "er" : ""} kvar — tippa innan slutspelet startar
                </p>
              )}
            </div>
          )}

          {/* CTA if not done */}
          {(!groupDone || (knockoutMatchCount > 0 && !knockoutDone)) && (
            <Link
              href="/matcher"
              className="btn-primary block w-full text-center text-sm mt-4"
            >
              {!groupDone ? "Tippa gruppspel →" : "Tippa slutspel →"}
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
            {standingsByGroup.map(({ groupId, groupName, leaderboard, userRank }) => (
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
                      {m.homeTeam.name} {teamFlag(m.homeTeam.id)} vs {teamFlag(m.awayTeam.id)} {m.awayTeam.name}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {format(m.scheduledAt)} · {m.city}
                    </div>
                  </div>
                  {isLive ? (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="flex items-center gap-1 text-[11px] font-bold tracking-[0.1em] uppercase text-red-400">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Live{m.minute && ` · ${m.minute}'`}
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

      {/* Recent scored predictions */}
      {recentPredictions.length > 0 && (
        <div className="glass-card">
          <h2 className="font-bold text-white mb-4">Senaste poäng</h2>
          <div className="space-y-2">
            {recentPredictions.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-white/70">
                  {p.match.homeTeam.name} {teamFlag(p.match.homeTeam.id)} vs {teamFlag(p.match.awayTeam.id)} {p.match.awayTeam.name}
                </span>
                <span className="font-bold text-app-accent">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>
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
