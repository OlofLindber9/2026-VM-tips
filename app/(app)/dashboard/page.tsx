import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format, genderLabel, genderColor } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const displayName = session!.user?.name || session!.user?.email?.split("@")[0] || "Player";

  // Upcoming races
  const upcomingRaces = await prisma.race.findMany({
    where: { status: "upcoming", date: { gte: new Date() } },
    orderBy: { date: "asc" },
    take: 3,
  });

  // User's groups
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

  // Recent scored predictions
  const recentPredictions = await prisma.prediction.findMany({
    where: { userId, score: { not: null } },
    include: { race: true },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {displayName}!
        </h1>
        <p className="text-white/50 mt-1">Here is your overview.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Upcoming events */}
        <div className="glass-card col-span-full lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-white">Upcoming events</h2>
            <Link href="/races" className="text-sm text-app-ice hover:text-white transition-colors">
              View all →
            </Link>
          </div>
          {upcomingRaces.length === 0 ? (
            <p className="text-white/40 text-sm">No upcoming events — check back soon.</p>
          ) : (
            <div className="space-y-3">
              {upcomingRaces.map((race) => (
                <Link
                  key={race.id}
                  href={`/races/${race.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border border-white/10 hover:border-white/25 hover:bg-white/8 transition-all"
                >
                  <div>
                    <div className="font-medium text-sm text-white/90">{race.name}</div>
                    <div className="text-xs text-white/40 mt-0.5">
                      {format(race.date)} · {race.country}
                    </div>
                  </div>
                  <span className={`badge ${genderColor(race.gender)}`}>
                    {genderLabel(race.gender)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My groups */}
        <div className="glass-card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-white">My groups</h2>
            <Link href="/groups" className="text-sm text-app-ice hover:text-white transition-colors">
              View all →
            </Link>
          </div>
          {memberships.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-white/40 text-sm mb-3">No groups yet.</p>
              <Link href="/groups/create" className="btn-primary text-sm">
                Create one
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
                    {m.group._count.members} member{m.group._count.members !== 1 ? "s" : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent scores */}
      {recentPredictions.length > 0 && (
        <div className="glass-card">
          <h2 className="font-bold text-white mb-4">Recent scores</h2>
          <div className="space-y-2">
            {recentPredictions.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-white/70">{p.race.name}</span>
                <span className="font-bold text-app-accent">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
