import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { format, disciplineColor, genderLabel } from "@/lib/utils";
import PredictionForm from "@/components/PredictionForm";
import ResultsPodium from "@/components/ResultsPodium";

export default async function RacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user!.id;

  const race = await prisma.race.findUnique({
    where: { id },
    include: {
      results: {
        orderBy: { rank: "asc" },
        include: { athlete: true },
      },
    },
  });

  if (!race) notFound();

  // Get user's groups for the prediction form
  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    include: { group: true },
  });

  // Get user's existing predictions for this race (keyed by groupId)
  const existingPredictions = await prisma.prediction.findMany({
    where: { userId, raceId: id },
    include: {
      race: { select: { name: true } },
    },
  });

  // Get athletes for the prediction picker (top athletes from FIS for this discipline/gender)
  // If the race is completed, use its actual result athletes; otherwise use a broader list
  let athletePool: { id: string; name: string; nationCode: string }[] = [];

  if (race.results.length > 0) {
    athletePool = race.results.map((r) => ({
      id: r.athlete.id,
      name: r.athlete.name,
      nationCode: r.athlete.nationCode,
    }));
  } else {
    // Show athletes who have appeared in recent completed races of the same gender
    const recentResults = await prisma.result.findMany({
      where: {
        race: { gender: race.gender, status: "completed" },
        rank: { lte: 30 },
      },
      include: { athlete: true },
      orderBy: { rank: "asc" },
      take: 200,
    });
    const seen = new Set<string>();
    for (const r of recentResults) {
      if (!seen.has(r.athlete.id)) {
        seen.add(r.athlete.id);
        athletePool.push({
          id: r.athlete.id,
          name: r.athlete.name,
          nationCode: r.athlete.nationCode,
        });
      }
    }
  }

  const podium =
    race.results.length >= 3
      ? {
          first: race.results[0],
          second: race.results[1],
          third: race.results[2],
        }
      : null;

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Race header */}
      <div className="card">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`badge ${disciplineColor(race.discipline)}`}>{race.discipline}</span>
          <span className={`badge ${race.gender === "W" ? "badge-yellow" : "badge-blue"}`}>
            {genderLabel(race.gender)}
          </span>
          <span className={`badge ${race.status === "completed" ? "badge-green" : "badge-blue"}`}>
            {race.status === "completed" ? "Completed" : "Upcoming"}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-ski-blue">{race.name}</h1>
        <p className="text-gray-500 mt-1">
          {format(race.date)} · {race.venue}, {race.country}
        </p>
      </div>

      {/* Official results (if completed) */}
      {podium && (
        <div className="card">
          <h2 className="font-bold text-ski-blue mb-4">Official results</h2>
          <ResultsPodium results={race.results.slice(0, 10)} />
        </div>
      )}

      {/* Predictions section */}
      {memberships.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500 mb-3">Join or create a group to make predictions.</p>
          <div className="flex gap-3 justify-center">
            <a href="/groups/create" className="btn-primary text-sm">Create group</a>
            <a href="/groups/join" className="btn-secondary text-sm">Join group</a>
          </div>
        </div>
      ) : (
        <PredictionForm
          race={{ id: race.id, name: race.name, status: race.status }}
          groups={memberships.map((m) => m.group)}
          existingPredictions={existingPredictions.map((p) => ({
            groupId: p.groupId,
            first: p.first,
            second: p.second,
            third: p.third,
            score: p.score,
          }))}
          athletePool={athletePool}
        />
      )}
    </div>
  );
}
