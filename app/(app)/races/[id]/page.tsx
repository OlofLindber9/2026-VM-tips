import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format, disciplineColor, genderLabel, genderColor } from "@/lib/utils";
import PredictionForm from "@/components/PredictionForm";
import ResultsPodium from "@/components/ResultsPodium";

export default async function RacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

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

  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    include: { group: true },
  });

  const existingPredictions = await prisma.prediction.findMany({
    where: { userId, raceId: id },
    include: { race: { select: { name: true } } },
  });

  let athletePool: { id: string; name: string; nationCode: string }[] = [];

  if (race.results.length > 0) {
    athletePool = race.results.map((r) => ({
      id: r.athlete.id,
      name: r.athlete.name,
      nationCode: r.athlete.nationCode,
    }));
  } else {
    athletePool = await prisma.athlete.findMany({
      where: { gender: race.gender },
      orderBy: { name: "asc" },
    });
  }

  const podium =
    race.results.length >= 3
      ? { first: race.results[0], second: race.results[1], third: race.results[2] }
      : null;

  const isCompleted = race.status === "completed";
  const isPast = isCompleted || race.date < new Date();

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Match header */}
      <div className="glass-card">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`badge ${disciplineColor(race.discipline)}`}>{race.discipline}</span>
          <span className={`badge ${genderColor(race.gender)}`}>
            {genderLabel(race.gender)}
          </span>
          {isCompleted && <span className="badge badge-green">Avslutad</span>}
          {!isCompleted && isPast && <span className="badge badge-gray">Passerad</span>}
          {!isPast && <span className="badge badge-blue">Kommande</span>}
        </div>
        <h1 className="text-2xl font-bold text-white">{race.name}</h1>
        <p className="text-white/50 mt-1">
          {format(race.date)} · {race.venue}, {race.country}
        </p>
      </div>

      {/* Officiellt resultat */}
      {podium && (
        <div className="glass-card">
          <h2 className="font-bold text-white mb-4">Officiellt resultat</h2>
          <ResultsPodium results={race.results.slice(0, 10)} />
        </div>
      )}

      {/* Tipssektion */}
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
          locked={isPast}
        />
      )}
    </div>
  );
}
