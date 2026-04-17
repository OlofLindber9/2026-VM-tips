import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format, teamFlag } from "@/lib/utils";
import GroupChat from "@/components/GroupChat";

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user!.id as string;

  const group = await prisma.group.findUnique({
    where: { id },
    include: { members: true },
  });

  if (!group) notFound();

  const isMember = group.members.some((m) => m.userId === userId);
  if (!isMember) notFound();

  const predictions = await prisma.prediction.findMany({
    where: { groupId: id },
    include: {
      match: {
        include: { homeTeam: true, awayTeam: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const scoresByUser: Record<string, number> = {};
  type PredEntry = {
    match: (typeof predictions)[number]["match"];
    score: number | null;
    predictedHome: number | null;
    predictedAway: number | null;
    predictedWinner: string | null;
  };
  const predictionsByUser: Record<string, PredEntry[]> = {};

  for (const pred of predictions) {
    scoresByUser[pred.userId] = (scoresByUser[pred.userId] || 0) + (pred.score ?? 0);
    if (!predictionsByUser[pred.userId]) predictionsByUser[pred.userId] = [];
    predictionsByUser[pred.userId].push({
      match: pred.match,
      score: pred.score,
      predictedHome: pred.predictedHome,
      predictedAway: pred.predictedAway,
      predictedWinner: pred.predictedWinner,
    });
  }

  const userIds = group.members.map((m) => m.userId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.displayName]));

  function displayName(uid: string): string {
    if (uid === userId) return session!.user?.name || userMap[uid] || "Spelare";
    return userMap[uid] || "Deltagare " + uid.slice(0, 6);
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

  const upcomingMatches = await prisma.match.findMany({
    where: { status: "upcoming", scheduledAt: { gte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    take: 5,
    include: { homeTeam: true, awayTeam: true },
  });

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="glass-card">
        <div className="flex justify-between items-start">
          <div>
            <Link href="/groups" className="text-app-ice text-sm hover:text-white transition-colors">← Mina grupper</Link>
            <h1 className="text-2xl font-bold text-white mt-1">{group.name}</h1>
            <p className="text-white/50 text-sm mt-1">
              {group.members.length} deltagare
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/40 mb-1">Inbjudningskod</p>
            <span
              className="font-mono font-bold text-app-ice px-3 py-1.5 rounded-lg text-sm tracking-widest"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              {group.inviteCode}
            </span>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="glass-card">
        <h2 className="font-bold text-white mb-4">🏆 Topplista</h2>
        {leaderboard.length === 0 ? (
          <p className="text-white/40 text-sm">Inga deltagare ännu.</p>
        ) : (
          <div className="space-y-2">
            {leaderboard.map((entry, i) => {
              const medals: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };
              const isCurrentUser = entry.userId === userId;
              return (
                <div
                  key={entry.userId}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl border transition-all"
                  style={{
                    background: isCurrentUser
                      ? "rgba(184, 240, 200, 0.10)"
                      : i === 0
                      ? "rgba(245, 200, 66, 0.12)"
                      : i === 1
                      ? "rgba(255, 255, 255, 0.06)"
                      : i === 2
                      ? "rgba(232, 160, 32, 0.08)"
                      : "rgba(255, 255, 255, 0.04)",
                    borderColor: isCurrentUser
                      ? "rgba(184, 240, 200, 0.25)"
                      : i < 3
                      ? "rgba(232, 160, 32, 0.2)"
                      : "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <span className="text-xl w-8 text-center">
                    {medals[i] ?? <span className="text-white/40 font-bold text-base">{i + 1}</span>}
                  </span>
                  <div className="flex-1">
                    <span className="font-semibold text-sm text-white">
                      {entry.displayName}
                      {isCurrentUser && (
                        <span className="ml-2 text-xs text-app-ice">(du)</span>
                      )}
                    </span>
                    <div className="text-xs text-white/40 mt-0.5">
                      {entry.scoredCount} {entry.scoredCount !== 1 ? "matcher" : "match"} poängsatta
                    </div>
                  </div>
                  <span className="font-bold text-app-accent text-lg">
                    {entry.totalScore} <span className="text-xs font-normal text-white/40">pts</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Chat */}
      <GroupChat groupId={id} currentUserId={userId} />
    </div>
  );
}
