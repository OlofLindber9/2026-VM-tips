import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format, teamFlag } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user!.id as string;
  const displayName = session!.user?.name || session!.user?.email?.split("@")[0] || "Spelare";

  const [
    upcomingMatches,
    memberships,
    recentPredictions,
    groupMatchCount,
    groupPredictedMatches,
    knockoutMatchCount,
    knockoutPredictedRaw,
  ] = await Promise.all([
    prisma.match.findMany({
      where: { status: "upcoming", scheduledAt: { gte: new Date() } },
      orderBy: { scheduledAt: "asc" },
      take: 3,
      include: { homeTeam: true, awayTeam: true },
    }),
    prisma.groupMembership.findMany({
      where: { userId },
      include: { group: { include: { _count: { select: { members: true } } } } },
      take: 5,
      orderBy: { joinedAt: "desc" },
    }),
    prisma.prediction.findMany({
      where: { userId, score: { not: null } },
      include: { match: { include: { homeTeam: true, awayTeam: true } } },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    // Total group-stage matches in DB
    prisma.match.count({ where: { stage: "group" } }),
    // Distinct group-stage matches the user has predicted in any group
    prisma.prediction.findMany({
      where: { userId, match: { stage: "group" } },
      select: { matchId: true },
      distinct: ["matchId"],
    }),
    // Total upcoming knockout matches (shows only once the bracket exists)
    prisma.match.count({ where: { stage: { not: "group" }, status: "upcoming" } }),
    // Distinct knockout matches the user has predicted
    prisma.prediction.findMany({
      where: { userId, match: { stage: { not: "group" } } },
      select: { matchId: true },
      distinct: ["matchId"],
    }),
  ]);

  const groupPredictedCount = groupPredictedMatches.length;
  const knockoutPredictedCount = knockoutPredictedRaw.length;
  const groupPct = groupMatchCount > 0 ? Math.round((groupPredictedCount / groupMatchCount) * 100) : 0;
  const knockoutPct = knockoutMatchCount > 0 ? Math.round((knockoutPredictedCount / knockoutMatchCount) * 100) : 0;
  const groupDone = groupMatchCount > 0 && groupPredictedCount >= groupMatchCount;
  const knockoutDone = knockoutMatchCount > 0 && knockoutPredictedCount >= knockoutMatchCount;

  const isInGroup = memberships.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Välkommen, {displayName}!
        </h1>
        <p className="text-white/50 mt-1">Här är din översikt.</p>
      </div>

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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Upcoming matches */}
        <div className="glass-card col-span-full lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-white">Kommande matcher</h2>
            <Link href="/matcher" className="text-sm text-app-ice hover:text-white transition-colors">
              Visa alla →
            </Link>
          </div>
          {upcomingMatches.length === 0 ? (
            <p className="text-white/40 text-sm">Inga kommande matcher — kom tillbaka snart.</p>
          ) : (
            <div className="space-y-3">
              {upcomingMatches.map((m) => (
                <Link
                  key={m.id}
                  href={`/matcher/${m.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/10 hover:border-white/25 hover:bg-white/8 transition-all"
                >
                  <div>
                    <div className="font-medium text-sm text-white/90">
                      {m.homeTeam.name} {teamFlag(m.homeTeam.id)} vs {teamFlag(m.awayTeam.id)} {m.awayTeam.name}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {format(m.scheduledAt)} · {m.city}
                    </div>
                  </div>
                  <span className="text-[11px] font-bold tracking-[0.1em] uppercase text-app-accent/70 shrink-0">Tippa →</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My groups */}
        <div className="glass-card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-white">Mina grupper</h2>
            <Link href="/groups" className="text-sm text-app-ice hover:text-white transition-colors">
              Visa alla →
            </Link>
          </div>
          {memberships.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-white/40 text-sm mb-3">Inga grupper ännu.</p>
              <Link href="/groups/create" className="btn-primary text-sm">
                Skapa en
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {memberships.map((m) => (
                <Link
                  key={m.groupId}
                  href={`/groups/${m.groupId}`}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-white/8 transition-colors"
                >
                  <span className="font-medium text-sm text-white/90">{m.group.name}</span>
                  <span className="text-xs text-white/40">
                    {m.group._count.members} deltagare
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
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
