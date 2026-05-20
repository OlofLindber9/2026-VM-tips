/**
 * Test-data seed for the playoff bracket.
 *
 * Creates a complete end-to-end scenario you can log into and inspect:
 *
 *   - Test user "test@test.se" (password "test1234")
 *   - Test group "Test-gänget"
 *   - The user predicts the entire bracket — including a "Spain wins it all" line
 *     where Spain is picked to advance from R32 all the way to lifting the trophy
 *   - R32, R16, QF results are pre-completed.  Spain WINS R32 + R16, then LOSES
 *     QF-2 — demonstrating the cascade penalty: the user's SF-1 ("ESP") and
 *     Final ("ESP") predictions can't earn points because Spain isn't in those
 *     matches anymore.
 *   - SF, 3P and Final remain upcoming so the cascade-miss UI hint is visible.
 *
 * Bracket pairing flow (set in seed-knockout.ts):
 *   R32-(2k-1) + R32-(2k) → R16-k
 *   R16-(2k-1) + R16-(2k) → QF-k
 *   QF-(2k-1)  + QF-(2k)  → SF-k
 *   SF-1 + SF-2           → Final
 *
 * Spain is in R32-5, so the path is: R32-5 → R16-3 → QF-2 → SF-1 → F.
 *
 * Run AFTER `npm run db:seed` (group stage) and `npx prisma db push`:
 *   npx tsx prisma/seed-test-bracket.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedKnockoutBracket } from "./seed-knockout";
import { propagateBracketWinners } from "../lib/bracket";

const prisma = new PrismaClient();

const TEST_USER_EMAIL = "test@test.se";
const TEST_USER_PASSWORD = "test1234";
const TEST_USER_NAME = "Test Testsson";
const TEST_GROUP_NAME = "Test-gänget";

// ---------------------------------------------------------------------------
// The user's complete bracket prediction. The lineage is internally consistent:
// each later-round pick is one of the teams the user predicted to advance from
// the previous round. The user's overall champion = ESP.
// ---------------------------------------------------------------------------

const USER_PREDICTIONS: Record<string, string> = {
  // R32 — favourites advance
  "R32-1":  "BRA",
  "R32-2":  "ARG",
  "R32-3":  "FRA",
  "R32-4":  "ENG",
  "R32-5":  "ESP",  // ★ Spain
  "R32-6":  "GER",
  "R32-7":  "POR",
  "R32-8":  "NED",
  "R32-9":  "BEL",
  "R32-10": "CRO",
  "R32-11": "URU",
  "R32-12": "COL",
  "R32-13": "MAR",
  "R32-14": "SUI",
  "R32-15": "USA",
  "R32-16": "SEN",

  // R16 — pick winners between predicted-R32-winner pairs
  "R16-1":  "BRA",  // BRA vs ARG
  "R16-2":  "FRA",  // FRA vs ENG
  "R16-3":  "ESP",  // ★ ESP vs GER
  "R16-4":  "NED",  // POR vs NED
  "R16-5":  "BEL",  // BEL vs CRO
  "R16-6":  "URU",  // URU vs COL
  "R16-7":  "MAR",  // MAR vs SUI
  "R16-8":  "SEN",  // USA vs SEN

  // QF
  "QF-1":   "BRA",  // BRA vs FRA
  "QF-2":   "ESP",  // ★ ESP vs NED — but the SIM has ESP losing here
  "QF-3":   "URU",  // BEL vs URU
  "QF-4":   "MAR",  // MAR vs SEN

  // SF
  "SF-1":   "ESP",  // ★ user expected BRA vs ESP — but ESP is out, so cascade miss
  "SF-2":   "MAR",  // URU vs MAR

  // Bronze
  "3P":     "BRA",  // user expects loser of SF-1 (BRA in their tree) to win bronze

  // Final — user picks ESP to lift the trophy, with 90-min score 1-2 (away)
  "F":      "ESP",  // ★ cascade miss
};

const USER_FINAL_SCORE = { home: 1, away: 2 };

// ---------------------------------------------------------------------------
// Simulated actual results — completes R32 / R16 / QF; SF, 3P, Final stay upcoming.
//
// Key cascade event: QF-2 is set to away-wins, which means ESP (in the home
// slot from their R16-3 victory) is ELIMINATED.
// ---------------------------------------------------------------------------

type Sim = { code: string; homeWins: boolean; homeScore: number; awayScore: number };

const SIMS: Sim[] = [
  // R32: 16 results — most favourites advance, two upsets (POR loses, USA loses)
  { code: "R32-1",  homeWins: true,  homeScore: 3, awayScore: 0 }, // BRA
  { code: "R32-2",  homeWins: true,  homeScore: 2, awayScore: 0 }, // ARG
  { code: "R32-3",  homeWins: true,  homeScore: 2, awayScore: 1 }, // FRA
  { code: "R32-4",  homeWins: true,  homeScore: 1, awayScore: 0 }, // ENG
  { code: "R32-5",  homeWins: true,  homeScore: 4, awayScore: 0 }, // ESP ★
  { code: "R32-6",  homeWins: true,  homeScore: 2, awayScore: 1 }, // GER
  { code: "R32-7",  homeWins: false, homeScore: 1, awayScore: 2 }, // ★ TUR upsets POR
  { code: "R32-8",  homeWins: true,  homeScore: 1, awayScore: 0 }, // NED
  { code: "R32-9",  homeWins: true,  homeScore: 2, awayScore: 1 }, // BEL
  { code: "R32-10", homeWins: true,  homeScore: 1, awayScore: 0 }, // CRO
  { code: "R32-11", homeWins: true,  homeScore: 2, awayScore: 0 }, // URU
  { code: "R32-12", homeWins: true,  homeScore: 1, awayScore: 0 }, // COL
  { code: "R32-13", homeWins: true,  homeScore: 2, awayScore: 1 }, // MAR
  { code: "R32-14", homeWins: true,  homeScore: 3, awayScore: 1 }, // SUI
  { code: "R32-15", homeWins: false, homeScore: 1, awayScore: 2 }, // ★ MEX upsets USA
  { code: "R32-16", homeWins: true,  homeScore: 1, awayScore: 0 }, // SEN

  // R16
  { code: "R16-1",  homeWins: true,  homeScore: 2, awayScore: 1 }, // BRA over ARG
  { code: "R16-2",  homeWins: true,  homeScore: 1, awayScore: 0 }, // FRA over ENG
  { code: "R16-3",  homeWins: true,  homeScore: 2, awayScore: 1 }, // ESP over GER ★
  { code: "R16-4",  homeWins: false, homeScore: 0, awayScore: 1 }, // NED over TUR
  { code: "R16-5",  homeWins: true,  homeScore: 2, awayScore: 0 }, // BEL over CRO
  { code: "R16-6",  homeWins: true,  homeScore: 1, awayScore: 0 }, // URU over COL
  { code: "R16-7",  homeWins: true,  homeScore: 2, awayScore: 1 }, // MAR over SUI
  { code: "R16-8",  homeWins: false, homeScore: 1, awayScore: 2 }, // SEN over MEX

  // QF — ★ ESP eliminated
  { code: "QF-1",   homeWins: true,  homeScore: 2, awayScore: 1 }, // BRA over FRA
  { code: "QF-2",   homeWins: false, homeScore: 1, awayScore: 2 }, // ★ NED over ESP
  { code: "QF-3",   homeWins: false, homeScore: 0, awayScore: 1 }, // URU over BEL
  { code: "QF-4",   homeWins: true,  homeScore: 2, awayScore: 0 }, // MAR over SEN
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function ensureTestUser(): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: TEST_USER_EMAIL } });
  if (existing) return existing.id;
  const hash = await bcrypt.hash(TEST_USER_PASSWORD, 10);
  const u = await prisma.user.create({
    data: { email: TEST_USER_EMAIL, password: hash, displayName: TEST_USER_NAME },
  });
  return u.id;
}

async function ensureTestGroup(creatorUserId: string): Promise<string> {
  const existing = await prisma.group.findFirst({ where: { name: TEST_GROUP_NAME } });
  if (existing) {
    await prisma.groupMembership.upsert({
      where: { userId_groupId: { userId: creatorUserId, groupId: existing.id } },
      update: {},
      create: { userId: creatorUserId, groupId: existing.id },
    });
    return existing.id;
  }
  const g = await prisma.group.create({
    data: { name: TEST_GROUP_NAME, createdBy: creatorUserId },
  });
  await prisma.groupMembership.create({
    data: { userId: creatorUserId, groupId: g.id },
  });
  return g.id;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Test bracket seed ===\n");

  console.log("Step 1: Re-seeding knockout bracket structure …");
  await seedKnockoutBracket({ useDemoPairings: true });
  console.log("");

  console.log("Step 2: Ensuring test user and group …");
  const userId = await ensureTestUser();
  const groupId = await ensureTestGroup(userId);
  console.log(`  ✓ User: ${TEST_USER_EMAIL} / ${TEST_USER_PASSWORD}  (id ${userId.slice(0, 8)}…)`);
  console.log(`  ✓ Group: ${TEST_GROUP_NAME}  (id ${groupId.slice(0, 8)}…)`);
  console.log("");

  console.log("Step 3: Wiping previous test predictions for this user/group …");
  await prisma.prediction.deleteMany({ where: { userId, groupId } });
  console.log("");

  console.log("Step 4: Writing user's bracket predictions …");
  const matches = await prisma.match.findMany({
    where: { bracketCode: { in: Object.keys(USER_PREDICTIONS) } },
  });
  const matchByCode = new Map(matches.map((m) => [m.bracketCode!, m]));

  let predCount = 0;
  for (const [bracketCode, teamId] of Object.entries(USER_PREDICTIONS)) {
    const m = matchByCode.get(bracketCode);
    if (!m) {
      console.warn(`  ⚠ No match for ${bracketCode}`);
      continue;
    }
    const isFinal = m.stage === "final";
    await prisma.prediction.create({
      data: {
        userId,
        groupId,
        matchId: m.id,
        predictedHome: isFinal ? USER_FINAL_SCORE.home : null,
        predictedAway: isFinal ? USER_FINAL_SCORE.away : null,
        predictedWinnerTeamId: teamId,
      },
    });
    predCount++;
  }
  console.log(`  ✓ ${predCount} predictions written`);
  console.log("");

  console.log("Step 5: Simulating R32 → R16 → QF results (ESP eliminated in QF-2) …");

  // Apply each round in order — propagateBracketWinners fills the next-round
  // slots before we try to set that next round's results.
  const stages: ("R32" | "R16" | "QF")[] = ["R32", "R16", "QF"];

  for (const stage of stages) {
    const stageSims = SIMS.filter((s) => s.code.startsWith(stage + "-"));
    for (const s of stageSims) {
      const m = await prisma.match.findUnique({ where: { bracketCode: s.code } });
      if (!m) {
        console.warn(`  ⚠ No match ${s.code}`);
        continue;
      }
      const updated = await prisma.match.update({
        where: { id: m.id },
        data: {
          status: "completed",
          homeScore: s.homeScore,
          awayScore: s.awayScore,
          knockoutWinner: s.homeWins ? "home" : "away",
        },
      });
      await propagateBracketWinners(updated.id);
    }
    console.log(`  ✓ ${stage}: ${stageSims.length} matches simulated and winners propagated`);
  }
  console.log("");

  console.log("Step 6: Scoring all completed-match predictions …");
  const { scorePredictions } = await import("../lib/sync");

  const completed = await prisma.match.findMany({
    where: {
      status: "completed",
      stage: { in: ["r32", "r16", "qf", "sf", "3p", "final"] },
    },
  });
  let scored = 0;
  for (const m of completed) {
    // Reset to null so scorePredictions re-runs (it skips score=null only)
    await prisma.prediction.updateMany({
      where: { matchId: m.id },
      data: { score: null },
    });
    scored += await scorePredictions(
      m.id,
      m.stage,
      m.homeTeamId,
      m.awayTeamId,
      m.homeScore!,
      m.awayScore!,
      m.knockoutWinner
    );
  }
  console.log(`  ✓ ${scored} predictions scored`);
  console.log("");

  // ---------------------------------------------------------------------------
  // Summary report
  // ---------------------------------------------------------------------------
  console.log("=== Summary ===");
  const allPredictions = await prisma.prediction.findMany({
    where: { userId, groupId },
    include: { match: { include: { homeTeam: true, awayTeam: true } } },
  });

  const stageOrderLabel: Record<string, number> = {
    r32: 0, r16: 1, qf: 2, sf: 3, "3p": 4, final: 5,
  };
  allPredictions.sort(
    (a, b) =>
      (stageOrderLabel[a.match.stage] ?? 99) - (stageOrderLabel[b.match.stage] ?? 99) ||
      (a.match.matchNumber ?? 0) - (b.match.matchNumber ?? 0)
  );

  let total = 0;
  for (const p of allPredictions) {
    const code = p.match.bracketCode ?? p.match.stage;
    const status = p.match.status === "completed" ? "✓" : "·";
    const score = p.score === null ? "—" : `${p.score} p`;
    if (typeof p.score === "number") total += p.score;
    const teams = `${p.match.homeTeam.id} vs ${p.match.awayTeam.id}`;
    console.log(
      `  ${status} ${code.padEnd(7)} ${teams.padEnd(22)} pick=${(p.predictedWinnerTeamId ?? "—").padEnd(8)} → ${score}`
    );
  }
  console.log(`\n  TOTAL: ${total} pts (locked in)\n`);
  console.log("Login as test@test.se / test1234 to inspect the /bracket page.\n");
  console.log("Cascade highlights:");
  console.log("  - SF-1, F:  user picked ESP — Spain is eliminated, so these will score 0");
  console.log("  - 3P:       user picked BRA, expecting BRA to lose SF-1 to ESP — depends on actual SF results");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
