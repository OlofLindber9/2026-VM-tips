import { auth } from "@/auth";
import AdvancedBracketTree, {
  type AdvancedBracketNode,
  type AdvancedBracketRounds,
} from "@/components/AdvancedBracketTree";
import { getBracket, type BracketNode } from "@/lib/bracket";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const revalidate = 60;

export default async function BracketPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();
  const userId = session!.user!.id as string;

  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    include: { group: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });

  const selectedGroupId = params.group ?? memberships[0]?.group.id;
  const bracket = await getBracket(userId, selectedGroupId);
  const clientRounds = serializeRounds(bracket.rounds);

  const totalKnockoutMatches =
    bracket.rounds.r32.length +
    bracket.rounds.r16.length +
    bracket.rounds.qf.length +
    bracket.rounds.sf.length +
    bracket.rounds["3p"].length +
    bracket.rounds.final.length;

  if (totalKnockoutMatches === 0) {
    return (
      <div className="gyokeres-background-page space-y-6">
        <h1 className="text-2xl font-bold text-white">Slutspelsträd</h1>
        <div className="glass-card text-center py-12">
          <div className="text-4xl mb-3">🏆</div>
          <p className="mb-2 text-white/50">Slutspelsträdet är inte tillgängligt ännu.</p>
          <p className="text-sm text-white/40">Det skapas när gruppspelet är klart.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="gyokeres-background-page space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Slutspelsträd</h1>
          <p className="mt-1 text-sm text-white/50">
            Tippa hela vägen till finalen. Kaskadbestraffning gäller om ditt lag åker ut tidigt.
          </p>
        </div>
      </div>

      {memberships.length > 1 && (
        <div className="glass-card flex flex-wrap gap-2">
          {memberships.map((m) => {
            const active = m.group.id === selectedGroupId;
            return (
              <Link
                key={m.group.id}
                href={`/bracket?group=${m.group.id}`}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors"
                style={
                  active
                    ? {
                        background: "rgba(232,160,32,0.15)",
                        color: "#f5c842",
                        border: "1px solid rgba(232,160,32,0.35)",
                      }
                    : {
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.6)",
                        border: "1px solid rgba(255,255,255,0.10)",
                      }
                }
              >
                {m.group.name}
              </Link>
            );
          })}
        </div>
      )}

      <div className="glass-card grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-white/40">Poäng</p>
          <p className="text-2xl font-black tabular-nums text-app-ice">{bracket.userPointsAwarded}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/35">Tilldelade</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-white/40">Möjliga</p>
          <p className="text-2xl font-black tabular-nums text-app-accent">{bracket.userPointsAtRisk}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/35">Lag fortfarande kvar</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-white/40">Förlorade</p>
          <p className="text-2xl font-black tabular-nums text-red-400/80">{bracket.userPointsLost}</p>
          <p className="text-[10px] uppercase tracking-wider text-white/35">Kaskad / fel</p>
        </div>
      </div>

      <AdvancedBracketTree rounds={clientRounds} />
    </div>
  );
}

function serializeRounds(rounds: Record<string, BracketNode[]>): AdvancedBracketRounds {
  return {
    r32: rounds.r32.map(serializeNode),
    r16: rounds.r16.map(serializeNode),
    qf: rounds.qf.map(serializeNode),
    sf: rounds.sf.map(serializeNode),
    "3p": rounds["3p"].map(serializeNode),
    final: rounds.final.map(serializeNode),
  };
}

function serializeNode(node: BracketNode): AdvancedBracketNode {
  return {
    ...node,
    scheduledAt: node.scheduledAt.toISOString(),
  };
}
