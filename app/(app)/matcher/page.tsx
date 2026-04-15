import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { format, stageLabel, stageColor, teamFlag } from "@/lib/utils";
import { getResult } from "@/lib/scoring";

// Revalidate every 60 seconds so live scores refresh server-side
export const revalidate = 60;

export default async function RacesPage() {
  const matches = await prisma.match.findMany({
    orderBy: { scheduledAt: "asc" },
    include: {
      homeTeam: true,
      awayTeam: true,
      _count: { select: { predictions: true } },
    },
  });

  const now = new Date();
  const live = matches.filter((m) => m.status === "live");
  const upcoming = matches.filter((m) => m.status === "upcoming" && m.scheduledAt >= now);
  const past = matches.filter((m) => m.status === "completed" || (m.status === "upcoming" && m.scheduledAt < now));

  const hasKnockout = matches.some((m) => m.stage !== "group");

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">VM 2026 — Matcher</h1>
      </div>

      {matches.length === 0 && (
        <div className="glass-card text-center py-12">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-white/50 mb-2">Inga matcher tillagda ännu.</p>
          <p className="text-sm text-white/40">Matcher visas här när de läggs till.</p>
        </div>
      )}

      {/* Knockout tip deadline notice — shown when knockout matches exist but haven't started */}
      {hasKnockout && upcoming.some((m) => m.stage !== "group") && (
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-3 text-sm"
          style={{ background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.2)" }}
        >
          <span className="text-lg shrink-0">⚠️</span>
          <p className="text-white/70">
            <strong className="text-app-gold">Slutspelet börjar snart!</strong>{" "}
            Lämna in dina slutspelstips innan den första slutspelsmatchen startar.
            I slutspelet tippar du bara vem som vinner — inga mål.
          </p>
        </div>
      )}

      {/* Group stage deadline notice — shown when all upcoming matches are group stage */}
      {!hasKnockout && upcoming.length > 0 && (
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-3 text-sm"
          style={{ background: "rgba(184,240,200,0.06)", border: "1px solid rgba(184,240,200,0.15)" }}
        >
          <span className="text-lg shrink-0">💡</span>
          <p className="text-white/60">
            Tippa alla 72 gruppspelets matcher innan VM börjar.
            Du tjänar <strong className="text-app-ice">3 poäng</strong> på exakt rätt resultat och{" "}
            <strong className="text-app-ice">1 poäng</strong> på rätt utfall.
          </p>
        </div>
      )}

      {live.length > 0 && (
        <section>
          <h2 className="font-bold text-lg text-red-400 mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Live nu
          </h2>
          <div className="grid gap-3">
            {live.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="font-bold text-lg text-white/70 mb-3">Kommande</h2>
          <div className="grid gap-3">
            {upcoming.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="font-bold text-lg text-white/70 mb-3">Avslutade</h2>
          <div className="grid gap-3">
            {past.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

type MatchCardMatch = {
  id: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  scheduledAt: Date;
  venue: string;
  city: string;
  country: string;
  stage: string;
  group: string | null;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  minute: string | null;
  knockoutWinner: string | null;
  _count: { predictions: number };
};


function MatchCard({ match }: { match: MatchCardMatch }) {
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";
  const isPast = isCompleted || match.scheduledAt < new Date();
  const hasScore = (isLive || isCompleted) && match.homeScore !== null && match.awayScore !== null;
  const result = hasScore ? getResult(match.homeScore!, match.awayScore!) : null;
  const isKnockout = match.stage !== "group";

  const homeWon = isKnockout
    ? match.knockoutWinner === "home"
    : result === "home";
  const awayWon = isKnockout
    ? match.knockoutWinner === "away"
    : result === "away";

  return (
    <Link
      href={`/matcher/${match.id}`}
      className={`glass-card border-l-[3px] hover:shadow-xl transition-all overflow-hidden
        ${isPast && !isCompleted && !isLive ? "opacity-50" : ""}
        ${isLive ? "border-l-red-500" : "border-l-app-pitch/50"}`}
    >
      <div className="flex items-center justify-between mb-3">
        {/* Stage / group label */}
        {match.stage === "group" ? (
          match.group ? (
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-app-accent/75">
              Grupp {match.group}
            </span>
          ) : null
        ) : (
          <span className={`badge ${stageColor(match.stage)}`}>{stageLabel(match.stage)}</span>
        )}

        {/* LIVE indicator */}
        {isLive && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase text-red-400">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Live {match.minute && `· ${match.minute}'`}
          </span>
        )}

        {/* Knockout tip hint */}
        {isKnockout && !isLive && !isCompleted && (
          <span className="text-[10px] font-bold tracking-widest uppercase text-app-gold/60">
            Tippa vinnare
          </span>
        )}
      </div>

      {/* Teams + score row */}
      <div className="flex items-center gap-3">
        {/* Home team */}
        <span
          className={`flex-1 text-right font-semibold truncate ${homeWon ? "text-white" : "text-white/70"}`}
        >
          {match.homeTeam.name}{" "}
          <span className="not-italic">{teamFlag(match.homeTeam.id)}</span>
        </span>

        {/* Score / vs */}
        {hasScore ? (
          <span
            className="shrink-0 text-xl font-black tabular-nums px-3 py-1 rounded-lg"
            style={{
              background: isLive ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.08)",
              color:
                result === "draw"
                  ? "rgb(253, 224, 71)"
                  : result === "home"
                  ? "rgb(110, 231, 183)"
                  : "rgb(253, 164, 175)",
            }}
          >
            {match.homeScore} – {match.awayScore}
          </span>
        ) : (
          <span className="shrink-0 text-sm font-bold text-app-pitch px-2">vs</span>
        )}

        {/* Away team */}
        <span
          className={`flex-1 text-left font-semibold truncate ${awayWon ? "text-white" : "text-white/70"}`}
        >
          <span className="not-italic">{teamFlag(match.awayTeam.id)}</span>{" "}
          {match.awayTeam.name}
        </span>
      </div>

      {/* Knockout winner badge */}
      {isCompleted && isKnockout && match.knockoutWinner && (
        <div className="mt-2 text-center">
          <span
            className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
            style={{ background: "rgba(52,211,153,0.12)", color: "rgb(110,231,183)" }}
          >
            {match.knockoutWinner === "home" ? match.homeTeam.name : match.awayTeam.name} vinner
          </span>
        </div>
      )}

      <div className="text-xs text-white/35 mt-2 text-center">
        {format(match.scheduledAt)} · {match.city} · {match._count.predictions} tippningar
      </div>
    </Link>
  );
}
