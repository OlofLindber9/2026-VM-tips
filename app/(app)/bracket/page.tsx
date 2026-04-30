import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getBracket, type BracketNode, type KnockoutStage } from "@/lib/bracket";
import { stageLabel, teamFlag, format } from "@/lib/utils";

export const revalidate = 60;

const ROUND_ORDER: KnockoutStage[] = ["r32", "r16", "qf", "sf", "final", "3p"];

export default async function BracketPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const userId = session!.user!.id as string;

  // The user's groups — to scope the bracket to one group's predictions
  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    include: { group: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const selectedGroupId = params.group ?? memberships[0]?.group.id;
  const bracket = await getBracket(userId, selectedGroupId);

  const totalKnockoutMatches =
    bracket.rounds.r32.length +
    bracket.rounds.r16.length +
    bracket.rounds.qf.length +
    bracket.rounds.sf.length +
    bracket.rounds["3p"].length +
    bracket.rounds.final.length;

  if (totalKnockoutMatches === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Slutspelsträd</h1>
        <div className="glass-card text-center py-12">
          <div className="text-4xl mb-3">🏆</div>
          <p className="text-white/50 mb-2">Slutspelsträdet är inte tillgängligt ännu.</p>
          <p className="text-sm text-white/40">
            Det skapas när gruppspelet är klart.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Slutspelsträd</h1>
          <p className="text-white/50 text-sm mt-1">
            Tippa hela vägen till finalen. Kaskadbestraffning gäller — om ditt lag åker ut tidigt får du 0 p på de matcher du tippat dem att vinna.
          </p>
        </div>
      </div>

      {/* Group selector */}
      {memberships.length > 1 && (
        <div className="glass-card flex flex-wrap gap-2">
          {memberships.map((m) => {
            const active = m.group.id === selectedGroupId;
            return (
              <Link
                key={m.group.id}
                href={`/bracket?group=${m.group.id}`}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                style={
                  active
                    ? { background: "rgba(232,160,32,0.15)", color: "#f5c842", border: "1px solid rgba(232,160,32,0.35)" }
                    : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.10)" }
                }
              >
                {m.group.name}
              </Link>
            );
          })}
        </div>
      )}

      {/* Points summary */}
      <div className="glass-card grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-1">Poäng</p>
          <p className="text-2xl font-black text-app-ice tabular-nums">{bracket.userPointsAwarded}</p>
          <p className="text-[10px] text-white/35 uppercase tracking-wider">Tilldelade</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-1">Möjliga</p>
          <p className="text-2xl font-black text-app-accent tabular-nums">{bracket.userPointsAtRisk}</p>
          <p className="text-[10px] text-white/35 uppercase tracking-wider">Lag fortfarande kvar</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-1">Förlorade</p>
          <p className="text-2xl font-black text-red-400/80 tabular-nums">{bracket.userPointsLost}</p>
          <p className="text-[10px] text-white/35 uppercase tracking-wider">Kaskad / fel</p>
        </div>
      </div>

      {/* Tree */}
      <div className="space-y-6">
        {ROUND_ORDER.map((stage) => {
          const matches = bracket.rounds[stage];
          if (matches.length === 0) return null;
          return (
            <section key={stage}>
              <h2 className="font-bold text-white mb-3">
                {stageLabel(stage)}{" "}
                <span className="text-white/35 font-normal text-sm">
                  · {matches.length} match{matches.length > 1 ? "er" : ""}
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {matches.map((m) => (
                  <BracketMatchCard key={m.matchId} node={m} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-match card
// ---------------------------------------------------------------------------

function BracketMatchCard({ node }: { node: BracketNode }) {
  const home = node.homeTeam;
  const away = node.awayTeam;
  const pred = node.userPrediction;

  const homeWon = node.knockoutWinner === "home";
  const awayWon = node.knockoutWinner === "away";

  // Determine card border style based on prediction state
  let borderColor = "rgba(255,255,255,0.10)";
  let cornerLabel: string | null = null;
  let cornerColor = "rgba(255,255,255,0.6)";
  let cornerBg = "rgba(255,255,255,0.06)";

  if (pred) {
    if (node.status === "completed" && pred.score !== null) {
      if (pred.score > 0) {
        borderColor = "rgba(52,211,153,0.40)";
        cornerLabel = `+${pred.score} p`;
        cornerBg = "rgba(52,211,153,0.18)";
        cornerColor = "rgb(110,231,183)";
      } else {
        borderColor = "rgba(239,68,68,0.30)";
        cornerLabel = "0 p";
        cornerBg = "rgba(239,68,68,0.18)";
        cornerColor = "rgb(252,165,165)";
      }
    } else if (pred.cascadeMiss) {
      borderColor = "rgba(239,68,68,0.30)";
      cornerLabel = "Utslaget ✗";
      cornerBg = "rgba(239,68,68,0.18)";
      cornerColor = "rgb(252,165,165)";
    } else if (pred.predictedWinnerTeamId) {
      borderColor = "rgba(232,160,32,0.30)";
      cornerLabel = "Tippat";
      cornerBg = "rgba(232,160,32,0.15)";
      cornerColor = "rgb(245,200,66)";
    }
  }

  return (
    <Link
      href={`/matcher/${node.matchId}`}
      className="glass-card hover:border-white/25 transition-all"
      style={{ borderColor }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold tracking-widest uppercase text-app-accent/70">
          {node.bracketCode}
        </span>
        {cornerLabel && (
          <span
            className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
            style={{ background: cornerBg, color: cornerColor }}
          >
            {cornerLabel}
          </span>
        )}
      </div>

      {/* Teams */}
      <div className="space-y-1.5">
        <TeamRow team={home} score={node.homeScore} won={homeWon} />
        <TeamRow team={away} score={node.awayScore} won={awayWon} />
      </div>

      {/* Footer: prediction + meta */}
      <div className="mt-3 pt-3 border-t border-white/8 flex items-center justify-between text-[11px]">
        {pred?.predictedWinnerTeamId ? (
          <span className="text-white/55">
            Du tippar:{" "}
            <span className="font-bold text-white">
              {pred.predictedWinnerTeamId}
            </span>
            {pred.cascadeMiss && (
              <span className="text-red-400/80 ml-1">(utslaget)</span>
            )}
            {node.stage === "final" && pred.predictedHome !== null && pred.predictedAway !== null && (
              <span className="text-white/45 ml-1">
                · {pred.predictedHome}–{pred.predictedAway} efter 90 min
              </span>
            )}
          </span>
        ) : (
          <span className="text-white/35">Inget tips lagt</span>
        )}
        <span className="text-white/30 shrink-0 ml-2">{format(node.scheduledAt)}</span>
      </div>
    </Link>
  );
}

function TeamRow({
  team,
  score,
  won,
}: {
  team: { id: string; name: string } | null;
  score: number | null;
  won: boolean;
}) {
  if (!team) {
    return (
      <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/4 text-white/30 text-sm italic">
        <span>Vinnare kommande...</span>
        <span>—</span>
      </div>
    );
  }
  return (
    <div
      className="flex items-center justify-between px-2 py-1.5 rounded-lg text-sm"
      style={{
        background: won ? "rgba(52,211,153,0.10)" : "rgba(255,255,255,0.03)",
        color: won ? "white" : "rgba(255,255,255,0.75)",
      }}
    >
      <span className="font-medium truncate">
        {teamFlag(team.id)} {team.name}
      </span>
      <span className="font-bold tabular-nums shrink-0">
        {score !== null ? score : "—"}
      </span>
    </div>
  );
}
