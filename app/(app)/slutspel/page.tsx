import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import KnockoutBracket from "@/components/KnockoutBracket";
import { getMockKnockoutByStage } from "@/lib/mock-knockout";

export default async function SlutspelPage() {
  const session = await auth();
  const userId = session!.user!.id as string;

  const useMock = process.env.USE_MOCK_KNOCKOUT === "true";

  const [knockoutMatches, memberships] = await Promise.all([
    useMock
      ? Promise.resolve([])
      : prisma.match.findMany({
          where: { stage: { not: "group" } },
          orderBy: [{ matchNumber: "asc" }, { scheduledAt: "asc" }],
          include: { homeTeam: true, awayTeam: true },
        }),
    prisma.groupMembership.findMany({
      where: { userId },
      include: { group: { select: { id: true, name: true } } },
    }),
  ]);

  const groupIds = memberships.map((m) => m.groupId);

  // When using mock data, skip predictions query (mock match IDs aren't in the DB)
  const predictions =
    !useMock && groupIds.length > 0 && knockoutMatches.length > 0
      ? await prisma.prediction.findMany({
          where: {
            userId,
            matchId: { in: knockoutMatches.map((m) => m.id) },
            groupId: { in: groupIds },
          },
          select: {
            matchId: true,
            groupId: true,
            predictedHome: true,
            predictedAway: true,
            predictedWinner: true,
            score: true,
          },
        })
      : [];

  const groups = memberships.map((m) => m.group);

  // Mock mode: bypass DB matches entirely
  if (useMock) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <h1 className="text-2xl font-bold text-white gradient-text">Slutspel 2026</h1>
          <div className="flex flex-wrap gap-3 text-xs text-white/40">
            <span>Omgång 32–SF: <strong className="text-app-ice">2 p</strong> rätt vinnare</span>
            <span>Final: <strong className="text-app-gold">5 p</strong> rätt vinnare + exakt 90-min</span>
          </div>
        </div>
        <div className="rounded-lg border border-app-accent/30 bg-app-accent/10 px-3 py-2 text-xs text-app-accent">
          Mock-läge aktivt (USE_MOCK_KNOCKOUT=true) — inga riktiga data
        </div>
        <KnockoutBracket
          matchesByStage={getMockKnockoutByStage()}
          initialPreds={[]}
          groups={groups.length > 0 ? groups : [{ id: "mock-group", name: "Testgrupp" }]}
          mockMode
        />
      </div>
    );
  }

  // Group matches by stage, preserving sort order from DB
  const matchesByStage: Record<
    string,
    {
      id: string;
      stage: string;
      status: string;
      homeTeam: { id: string; name: string };
      awayTeam: { id: string; name: string };
      homeScore: number | null;
      awayScore: number | null;
      knockoutWinner: string | null;
      scheduledAt: string;
    }[]
  > = {};

  for (const m of knockoutMatches) {
    if (!matchesByStage[m.stage]) matchesByStage[m.stage] = [];
    matchesByStage[m.stage].push({
      id: m.id,
      stage: m.stage,
      status: m.status,
      homeTeam: { id: m.homeTeam.id, name: m.homeTeam.name },
      awayTeam: { id: m.awayTeam.id, name: m.awayTeam.name },
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      knockoutWinner: m.knockoutWinner,
      scheduledAt: m.scheduledAt.toISOString(),
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-2xl font-bold text-white gradient-text">Slutspel 2026</h1>
        <div className="flex flex-wrap gap-3 text-xs text-white/40">
          <span>
            Omgång 32–SF:{" "}
            <strong className="text-app-ice">2 p</strong> rätt vinnare
          </span>
          <span>
            Final:{" "}
            <strong className="text-app-gold">5 p</strong> rätt vinnare + exakt 90-min
          </span>
        </div>
      </div>

      {memberships.length === 0 ? (
        <div className="glass-card text-center py-12">
          <p className="text-white/50 mb-3">
            Gå med i eller skapa en grupp för att tippa slutspelet.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/groups/create" className="btn-primary text-sm">
              Skapa grupp
            </Link>
            <Link href="/groups/join" className="btn-secondary text-sm">
              Gå med i grupp
            </Link>
          </div>
        </div>
      ) : knockoutMatches.length === 0 ? (
        <div className="glass-card text-center py-12">
          <div className="text-4xl mb-3">🏆</div>
          <p className="text-white/50 mb-1">Slutspelsmatcherna är inte inlagda än.</p>
          <p className="text-sm text-white/30">
            De läggs in efter att gruppspelet är färdigt (ca juli 2026).
          </p>
        </div>
      ) : (
        <KnockoutBracket
          matchesByStage={matchesByStage}
          initialPreds={predictions}
          groups={groups}
        />
      )}
    </div>
  );
}
