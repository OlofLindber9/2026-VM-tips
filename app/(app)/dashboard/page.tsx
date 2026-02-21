import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format } from "@/lib/utils";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user!.id;
  const displayName =
    (user!.user_metadata?.username as string) || user!.email?.split("@")[0] || "Skier";

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
        <h1 className="text-2xl font-bold text-ski-blue">
          Welcome back, {displayName}!
        </h1>
        <p className="text-gray-500 mt-1">Here is your season overview.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Upcoming races */}
        <div className="card col-span-full lg:col-span-2">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-ski-blue">Upcoming races</h2>
            <Link href="/races" className="text-sm text-ski-light hover:underline">
              View all →
            </Link>
          </div>
          {upcomingRaces.length === 0 ? (
            <p className="text-gray-400 text-sm">No upcoming races — check back soon.</p>
          ) : (
            <div className="space-y-3">
              {upcomingRaces.map((race) => (
                <Link
                  key={race.id}
                  href={`/races/${race.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-ski-light hover:bg-blue-50 transition-colors"
                >
                  <div>
                    <div className="font-medium text-sm">{race.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {format(race.date)} · {race.country}
                    </div>
                  </div>
                  <span className={`badge ${race.gender === "W" ? "badge-yellow" : "badge-blue"}`}>
                    {race.gender === "W" ? "Women" : "Men"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* My groups */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-bold text-ski-blue">My groups</h2>
            <Link href="/groups" className="text-sm text-ski-light hover:underline">
              View all →
            </Link>
          </div>
          {memberships.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-gray-400 text-sm mb-3">No groups yet.</p>
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
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-sm">{m.group.name}</span>
                  <span className="text-xs text-gray-400">
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
        <div className="card">
          <h2 className="font-bold text-ski-blue mb-4">Recent scores</h2>
          <div className="space-y-2">
            {recentPredictions.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{p.race.name}</span>
                <span className="font-bold text-ski-accent">{p.score} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
