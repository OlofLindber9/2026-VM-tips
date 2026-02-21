import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format, disciplineColor, genderLabel } from "@/lib/utils";

export default async function RacesPage() {
  const races = await prisma.race.findMany({
    orderBy: { date: "asc" },
    include: { _count: { select: { predictions: true, results: true } } },
  });

  const upcoming = races.filter((r) => r.status === "upcoming");
  const completed = races.filter((r) => r.status === "completed");

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-ski-blue">Races</h1>
        <span className="text-gray-400 text-sm">{races.length} total this season</span>
      </div>

      {races.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-500 mb-4">No races loaded yet.</p>
          <p className="text-sm text-gray-400">
            An admin needs to sync the FIS calendar via the API first.
          </p>
        </div>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="font-bold text-lg text-gray-700 mb-3">Upcoming</h2>
          <div className="grid gap-3">
            {upcoming.map((race) => (
              <RaceCard key={race.id} race={race} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="font-bold text-lg text-gray-700 mb-3">Completed</h2>
          <div className="grid gap-3">
            {completed.map((race) => (
              <RaceCard key={race.id} race={race} completed />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RaceCard({
  race,
  completed,
}: {
  race: {
    id: string;
    name: string;
    venue: string;
    country: string;
    date: Date;
    discipline: string;
    gender: string;
    _count: { predictions: number; results: number };
  };
  completed?: boolean;
}) {
  return (
    <Link
      href={`/races/${race.id}`}
      className="card hover:border-ski-light hover:shadow-md transition-all flex items-center justify-between gap-4"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`badge ${disciplineColor(race.discipline)}`}>
            {race.discipline}
          </span>
          <span className={`badge ${race.gender === "W" ? "badge-yellow" : "badge-blue"}`}>
            {genderLabel(race.gender)}
          </span>
          {completed && <span className="badge badge-green">Completed</span>}
        </div>
        <div className="font-semibold text-ski-blue truncate">{race.name}</div>
        <div className="text-sm text-gray-400 mt-0.5">
          {format(race.date)} · {race.venue}, {race.country}
        </div>
      </div>
      <div className="text-right text-xs text-gray-400 shrink-0">
        <div>{race._count.predictions} predictions</div>
        {completed && <div>{race._count.results} results</div>}
      </div>
    </Link>
  );
}
