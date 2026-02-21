import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "@/lib/utils";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user!.id;

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: true,
    },
  });

  if (!group) notFound();

  // Verify membership
  const isMember = group.members.some((m) => m.userId === userId);
  if (!isMember) notFound();

  const isOwner = group.createdBy === userId;

  // All predictions for this group, with scores
  const predictions = await prisma.prediction.findMany({
    where: { groupId: id },
    include: {
      race: { select: { id: true, name: true, date: true, status: true, discipline: true, gender: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Compute leaderboard: sum of scores per user
  const scoresByUser: Record<string, number> = {};
  const predictionsByUser: Record<
    string,
    Array<{ race: typeof predictions[number]["race"]; score: number | null; first: string; second: string; third: string }>
  > = {};

  for (const pred of predictions) {
    scoresByUser[pred.userId] = (scoresByUser[pred.userId] || 0) + (pred.score ?? 0);
    if (!predictionsByUser[pred.userId]) predictionsByUser[pred.userId] = [];
    predictionsByUser[pred.userId].push({
      race: pred.race,
      score: pred.score,
      first: pred.first,
      second: pred.second,
      third: pred.third,
    });
  }

  // Get display names from profiles table
  const userIds = group.members.map((m) => m.userId);
  const profiles = await prisma.profile.findMany({
    where: { id: { in: userIds } },
  });
  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p.displayName]));

  function displayName(uid: string): string {
    return profileMap[uid] || "Member " + uid.slice(0, 6);
  }

  const leaderboard = group.members
    .map((m) => ({
      userId: m.userId,
      displayName: displayName(m.userId),
      totalScore: scoresByUser[m.userId] || 0,
      predictionsCount: predictionsByUser[m.userId]?.length || 0,
      scoredCount: predictionsByUser[m.userId]?.filter((p) => p.score !== null).length || 0,
    }))
    .sort((a, b) => b.totalScore - a.totalScore);

  // Upcoming races (so members can make predictions)
  const upcomingRaces = await prisma.race.findMany({
    where: { status: "upcoming", date: { gte: new Date() } },
    orderBy: { date: "asc" },
    take: 5,
  });

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="card">
        <div className="flex justify-between items-start">
          <div>
            <Link href="/groups" className="text-ski-light text-sm hover:underline">← My groups</Link>
            <h1 className="text-2xl font-bold text-ski-blue mt-1">{group.name}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {group.members.length} member{group.members.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 mb-1">Invite code</p>
            <span className="font-mono font-bold text-ski-blue bg-blue-50 px-3 py-1.5 rounded-lg text-sm tracking-widest">
              {group.inviteCode}
            </span>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="card">
        <h2 className="font-bold text-ski-blue mb-4">🏆 Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p className="text-gray-400 text-sm">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, i) => {
              const medals: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };
              const isCurrentUser = entry.userId === userId;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-4 px-4 py-3 rounded-xl ${
                    isCurrentUser
                      ? "bg-blue-50 border border-ski-light"
                      : i < 3
                      ? "bg-yellow-50"
                      : "bg-gray-50"
                  }`}
                >
                  <span className="text-xl w-8 text-center">
                    {medals[i] ?? <span className="text-gray-400 font-bold text-base">{i + 1}</span>}
                  </span>
                  <div className="flex-1">
                    <span className="font-semibold text-sm">
                      {entry.displayName}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-ski-light">(you)</span>
                      )}
                    </span>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {entry.scoredCount} race{entry.scoredCount !== 1 ? "s" : ""} scored
                    </div>
                  </div>
                  <span className="font-bold text-ski-accent text-lg">
                    {entry.totalScore} <span className="text-xs font-normal text-gray-400">pts</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upcoming races to predict */}
      {upcomingRaces.length > 0 && (
        <div className="card">
          <h2 className="font-bold text-ski-blue mb-4">Predict upcoming races</h2>
          <div className="space-y-2">
            {upcomingRaces.map((race) => {
              const myPrediction = predictionsByUser[userId]?.find(
                (p) => p.race.id === race.id
              );
              return (
                <Link
                  key={race.id}
                  href={`/races/${race.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-ski-light hover:bg-blue-50 transition-colors"
                >
                  <div>
                    <div className="font-medium text-sm">{race.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{format(race.date)}</div>
                  </div>
                  {myPrediction ? (
                    <span className="badge badge-green">Predicted</span>
                  ) : (
                    <span className="badge badge-yellow">Predict →</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
