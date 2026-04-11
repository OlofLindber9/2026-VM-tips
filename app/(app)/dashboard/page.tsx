import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const displayName = session!.user?.name || session!.user?.email?.split("@")[0] || "Spelare";

  const upcomingMatches = await prisma.match.findMany({
    where: { status: "upcoming", scheduledAt: { gte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: 3,
    include: { homeTeam: true, awayTeam: true },
  });

  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    include: {
      group: {
        include: { _count: { select: { members: true } } },
      },
    },
    take: 5,
    orderBy: { joinedAt: "desc" },
  });

  const recentPredictions = await prisma.prediction.findMany({
    where: { userId, score: { not: null } },
    include: { match: { include: { homeTeam: true, awayTeam: true } } },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Välkommen, {displayName}!
        </h1>
        <p className="text-white/50 mt-1">Här är din översikt.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Upcoming matches */}
        <div className="glass-card col-span-full lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-white">Kommande matcher</h2>
            <Link href="/races" className="text-sm text-app-ice hover:text-white transition-colors">
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
                  href={`/races/${m.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/10 hover:border-white/25 hover:bg-white/8 transition-all"
                >
                  <div>
                    <div className="font-medium text-sm text-white/90">
                      {m.homeTeam.name} vs {m.awayTeam.name}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {format(m.scheduledAt)} · {m.city}
                    </div>
                  </div>
                  <span className="badge badge-blue shrink-0">Tippa →</span>
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
                  {p.match.homeTeam.name} vs {p.match.awayTeam.name}
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
