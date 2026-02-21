import { prisma } from "@/lib/prisma";
import { syncCalendar, syncCompletedRaces } from "@/lib/fis/sync";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { format, disciplineColor, genderLabel } from "@/lib/utils";

async function refreshCalendarAction() {
  "use server";
  await syncCalendar();
  revalidatePath("/races");
}

async function syncResultsAction() {
  "use server";
  await syncCompletedRaces();
  revalidatePath("/races");
}

export default async function RacesPage() {
  // Only hit FIS when the DB has no races yet. After that, data comes
  // straight from the DB so the page stays fast.
  const raceCount = await prisma.race.count();
  if (raceCount === 0) {
    await syncCalendar().catch(() => {});
  }

  const races = await prisma.race.findMany({
    orderBy: { date: "asc" },
    include: { _count: { select: { predictions: true, results: true } } },
  });

  const now = new Date();
  const upcoming = races.filter((r) => r.status === "upcoming" && r.date >= now);
  const past = races.filter((r) => r.status === "completed" || r.date < now);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-ski-blue">2025/26 Season</h1>
        <div className="flex gap-2">
          <form action={syncResultsAction}>
            <button type="submit" className="btn-primary text-sm">
              Sync results
            </button>
          </form>
          <form action={refreshCalendarAction}>
            <button type="submit" className="btn-secondary text-sm">
              Refresh calendar
            </button>
          </form>
        </div>
      </div>

      {races.length === 0 && (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-500 mb-4">Could not load races from FIS.</p>
          <p className="text-sm text-gray-400">
            Check your internet connection and try refreshing.
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

      {past.length > 0 && (
        <section>
          <h2 className="font-bold text-lg text-gray-700 mb-3">Past</h2>
          <div className="grid gap-3">
            {past.map((race) => (
              <RaceCard key={race.id} race={race} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RaceCard({
  race,
}: {
  race: {
    id: string;
    name: string;
    venue: string;
    country: string;
    date: Date;
    discipline: string;
    gender: string;
    status: string;
    _count: { predictions: number; results: number };
  };
}) {
  const isCompleted = race.status === "completed";
  const isPast = isCompleted || race.date < new Date();

  return (
    <Link
      href={`/races/${race.id}`}
      className={`card hover:border-ski-light hover:shadow-md transition-all flex items-center justify-between gap-4 ${isPast ? "opacity-70" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`badge ${disciplineColor(race.discipline)}`}>
            {race.discipline}
          </span>
          <span className={`badge ${race.gender === "W" ? "badge-yellow" : "badge-blue"}`}>
            {genderLabel(race.gender)}
          </span>
          {isCompleted && <span className="badge badge-green">Completed</span>}
          {!isCompleted && isPast && <span className="badge badge-gray">Past</span>}
        </div>
        <div className="font-semibold text-ski-blue truncate">{race.name}</div>
        <div className="text-sm text-gray-400 mt-0.5">
          {format(race.date)} · {race.venue}, {race.country}
        </div>
      </div>
      <div className="text-right text-xs text-gray-400 shrink-0">
        <div>{race._count.predictions} predictions</div>
        {isCompleted && <div>{race._count.results} results</div>}
      </div>
    </Link>
  );
}
