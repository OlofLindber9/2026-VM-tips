import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatWithTime, stageLabel, teamFlag } from "@/lib/utils";
import PredictionForm from "@/components/PredictionForm";
import MatchResult from "@/components/ResultsPodium";
import LiveRefresh from "@/components/LiveRefresh";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user!.id as string;

  const match = await prisma.match.findUnique({
    where: { id },
    include: { homeTeam: true, awayTeam: true },
  });

  if (!match) notFound();

  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    include: { group: true },
  });

  const existingPredictions = await prisma.prediction.findMany({
    where: { userId, matchId: id },
  });

  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";
  const isPast = isCompleted || isLive || match.scheduledAt < new Date();
  const hasScore = (isLive || isCompleted) && match.homeScore !== null && match.awayScore !== null;
  const isKnockout = match.stage !== "group";

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Auto-refresh every 30s while live */}
      {isLive && <LiveRefresh intervalMs={30_000} />}

      {/* Match header */}
      <div className={`glass-card ${isLive ? "border-red-500/40" : ""}`}>
        <div className="flex items-center gap-4 mb-3">
          <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-app-accent/75">
            {match.stage === "group" && match.group
              ? `Grupp ${match.group}`
              : stageLabel(match.stage)}
          </span>
          {isLive && (
            <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] uppercase text-red-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              Live {match.minute && `· ${match.minute}'`}
            </span>
          )}
          {isCompleted && (
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-app-ice/60">
              Avslutad
            </span>
          )}
          {!isCompleted && !isLive && isPast && (
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-white/30">
              Passerad
            </span>
          )}
          {!isPast && (
            <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-app-pitch/80">
              Kommande
            </span>
          )}
        </div>

        {/* Teams vs display */}
        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="flex-1 text-right">
            <p className="text-xl font-bold text-white">{match.homeTeam.name} {teamFlag(match.homeTeam.id)}</p>
            <p className="text-xs text-white/40 mt-0.5">Hemmalag</p>
          </div>
          <div className="text-center shrink-0">
            {hasScore ? (
              <p className={`text-3xl font-black tabular-nums ${isLive ? "text-red-300" : "text-white"}`}>
                {match.homeScore} – {match.awayScore}
              </p>
            ) : (
              <p className="text-2xl font-black text-white/30">vs</p>
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-xl font-bold text-white">{teamFlag(match.awayTeam.id)} {match.awayTeam.name}</p>
            <p className="text-xs text-white/40 mt-0.5">Bortalag</p>
          </div>
        </div>

        {/* Knockout winner badge */}
        {isCompleted && isKnockout && match.knockoutWinner && (
          <div className="mt-4 text-center">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold"
              style={{ background: "rgba(52,211,153,0.15)", color: "rgb(110,231,183)" }}
            >
              Vinnare: {match.knockoutWinner === "home" ? match.homeTeam.name : match.awayTeam.name}
            </span>
          </div>
        )}

        <p className="text-white/40 text-sm text-center mt-4">
          {formatWithTime(match.scheduledAt)} · {match.venue}, {match.city}
        </p>
      </div>

      {/* Official result */}
      {isCompleted && hasScore && (
        <div className="glass-card">
          <h2 className="font-bold text-white mb-4">Officiellt resultat</h2>
          <MatchResult
            homeTeam={match.homeTeam}
            awayTeam={match.awayTeam}
            homeScore={match.homeScore!}
            awayScore={match.awayScore!}
          />
        </div>
      )}

      {/* Prediction section */}
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
          match={{
            id: match.id,
            homeTeam: { id: match.homeTeam.id, name: match.homeTeam.name },
            awayTeam: { id: match.awayTeam.id, name: match.awayTeam.name },
            status: match.status,
            stage: match.stage,
          }}
          groups={memberships.map((m) => m.group)}
          existingPredictions={existingPredictions.map((p) => ({
            groupId: p.groupId,
            predictedHome: p.predictedHome,
            predictedAway: p.predictedAway,
            predictedWinner: p.predictedWinner,
            score: p.score,
          }))}
          locked={isLive || isPast}
        />
      )}

    </div>
  );
}
