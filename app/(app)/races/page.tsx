import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format, genderLabel, genderColor, disciplineColor } from "@/lib/utils";

export default async function RacesPage() {
  const races = await prisma.race.findMany({
    orderBy: { date: "asc" },
    include: {
      _count: { select: { predictions: true, results: true } },
      results: {
        where: { rank: 1 },
        include: { athlete: true },
        take: 1,
      },
    },
  });

  const now = new Date();
  const upcoming = races.filter((r) => r.status === "upcoming" && r.date >= now);
  const past = races.filter((r) => r.status === "completed" || r.date < now);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">VM 2026 — Matcher</h1>

      {races.length === 0 && (
        <div className="glass-card text-center py-12">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-white/50 mb-2">Inga matcher tillagda ännu.</p>
          <p className="text-sm text-white/40">Matcher visas här när de läggs till.</p>
        </div>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="font-bold text-lg text-white/70 mb-3">Kommande</h2>
          <div className="grid gap-3">
            {upcoming.map((race) => (
              <RaceCard key={race.id} race={race} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="font-bold text-lg text-white/70 mb-3">Avslutade</h2>
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
    results: { rank: number | null; athlete: { name: string; nationCode: string } }[];
  };
}) {
  const isCompleted = race.status === "completed";
  const isPast = isCompleted || race.date < new Date();
  const winner = race.results[0]?.athlete;

  return (
    <Link
      href={`/races/${race.id}`}
      className={`glass-card hover:border-white/30 hover:shadow-xl transition-all flex items-center justify-between gap-4 overflow-hidden ${isPast && !isCompleted ? "opacity-50" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className={`badge ${disciplineColor(race.discipline)}`}>{race.discipline}</span>
          <span className={`badge ${genderColor(race.gender)}`}>{genderLabel(race.gender)}</span>
          {isCompleted && <span className="badge badge-green">Avslutad</span>}
        </div>
        <div className="font-semibold text-white truncate">{race.name}</div>
        <div className="text-sm text-white/40 mt-0.5 truncate">
          {format(race.date)} · {race.venue}, {race.country}
        </div>
        {winner && (
          <div className="text-sm text-white/50 mt-1 truncate">
            🥇 {winner.name} ({winner.nationCode})
          </div>
        )}
      </div>
      <div className="text-right text-xs text-white/40 shrink-0">
        <div>{race._count.predictions} tips</div>
      </div>
    </Link>
  );
}
