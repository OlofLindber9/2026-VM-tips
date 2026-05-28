import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { Prisma } from "@prisma/client";
import * as nextEnv from "@next/env";
import { getBracket } from "../lib/bracket";
import { prisma } from "../lib/prisma";
import { scorePredictions } from "../lib/sync";
import { propagateBracketWinners } from "../lib/bracket";

nextEnv.loadEnvConfig(process.cwd());

type CreatedIds = {
  users: string[];
  groups: string[];
  matches: string[];
  teams: string[];
};

const created: CreatedIds = {
  users: [],
  groups: [],
  matches: [],
  teams: [],
};

describe("many-user database workflow", () => {
  it("seeds users, groups, predictions, bracket updates, scoring, and chat", async () => {
    const runId = `mut-${Date.now()}-${randomUUID().slice(0, 8)}`;

    try {
      const teams = await createTeams(runId, 40);
      const placeholders = await createPlaceholderTeams(runId);
      created.teams.push(...teams.map((t) => t.id), ...placeholders.map((t) => t.id));

      const groupMatch = await prisma.match.create({
        data: {
          homeTeamId: teams[0].id,
          awayTeamId: teams[1].id,
          scheduledAt: new Date("2026-06-12T18:00:00Z"),
          venue: "Integration Arena",
          city: "Test City",
          country: "USA",
          stage: "group",
          group: "A",
          matchNumber: 8001,
          status: "upcoming",
        },
      });
      created.matches.push(groupMatch.id);

      const bracketMatches = await createKnockoutBracket(runId, teams, placeholders);
      created.matches.push(...bracketMatches.map((m) => m.id));

      const users = await createUsers(runId, 12);
      created.users.push(...users.map((u) => u.id));

      const groups = await createGroups(runId, users[0].id, 3);
      created.groups.push(...groups.map((g) => g.id));

      await createMemberships(users, groups);
      const memberships = await prisma.groupMembership.findMany({
        where: { groupId: { in: groups.map((g) => g.id) } },
      });
      assert.equal(memberships.length, 22);

      await createPredictions({
        users,
        groups,
        memberships,
        groupMatchId: groupMatch.id,
        r32HomeWinMatchId: bracketMatches.find((m) => m.bracketCode === `${runId}-R32-1`)!.id,
        r32AwayWinMatchId: bracketMatches.find((m) => m.bracketCode === `${runId}-R32-2`)!.id,
        r16MatchId: bracketMatches.find((m) => m.bracketCode === `${runId}-R16-1`)!.id,
        r32HomeTeamId: teams[0].id,
        r32AwayTeamId: teams[3].id,
      });

      const predictionsBeforeScoring = await prisma.prediction.count({
        where: { groupId: { in: groups.map((g) => g.id) } },
      });
      assert.equal(predictionsBeforeScoring, 88);

      await completeAndScoreGroupMatch(groupMatch.id, teams[0].id, teams[1].id);

      const groupScores = await prisma.prediction.findMany({
        where: { matchId: groupMatch.id },
        select: { score: true },
      });
      assert.equal(groupScores.length, 22);
      assert.ok(groupScores.some((p) => p.score === 3));
      assert.ok(groupScores.some((p) => p.score === 1));
      assert.ok(groupScores.some((p) => p.score === 0));

      await completeAndScoreKnockout(`${runId}-R32-1`, "home");
      await completeAndScoreKnockout(`${runId}-R32-2`, "away");

      const r16 = await prisma.match.findUniqueOrThrow({
        where: { bracketCode: `${runId}-R16-1` },
      });
      assert.equal(r16.homeTeamId, teams[0].id);
      assert.equal(r16.awayTeamId, teams[3].id);

      const bracketForFirstUserFirstGroup = await getBracket(users[0].id, groups[0].id);
      const r32Node = bracketForFirstUserFirstGroup.rounds.r32.find(
        (node) => node.bracketCode === `${runId}-R32-1`
      );
      assert.equal(r32Node?.userPrediction?.predictedWinnerTeamId, teams[0].id);
      assert.equal(r32Node?.userPrediction?.score, 2);

      const r16Node = bracketForFirstUserFirstGroup.rounds.r16.find(
        (node) => node.bracketCode === `${runId}-R16-1`
      );
      assert.equal(r16Node?.homeTeam?.id, teams[0].id);
      assert.equal(r16Node?.awayTeam?.id, teams[3].id);

      await prepareAndCompleteSemifinals(runId, teams);
      const [final, thirdPlace] = await Promise.all([
        prisma.match.findUniqueOrThrow({ where: { bracketCode: `${runId}-F` } }),
        prisma.match.findUniqueOrThrow({ where: { bracketCode: `${runId}-3P` } }),
      ]);
      assert.equal(final.homeTeamId, teams[4].id);
      assert.equal(final.awayTeamId, teams[7].id);
      assert.equal(thirdPlace.homeTeamId, teams[5].id);
      assert.equal(thirdPlace.awayTeamId, teams[6].id);

      await createChatLoad(runId, groups[0].id, users);
      const newestMessages = await prisma.chatMessage.findMany({
        where: { groupId: groups[0].id },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      newestMessages.reverse();
      assert.equal(newestMessages.length, 200);
      assert.equal(newestMessages[0].content, `${runId}-message-051`);
      assert.equal(newestMessages.at(-1)?.content, `${runId}-message-250`);
    } finally {
      await cleanup(created);
      await prisma.$disconnect();
    }
  });
});

async function createTeams(runId: string, count: number) {
  const teams = Array.from({ length: count }, (_, i) => ({
    id: `${runId}-T${String(i + 1).padStart(2, "0")}`,
    name: `Testlag ${i + 1}`,
    group: null,
  }));

  await prisma.team.createMany({ data: teams });
  return teams;
}

async function createPlaceholderTeams(runId: string) {
  const placeholders: { id: string; name: string; group: null }[] = [];
  for (let i = 1; i <= 16; i++) {
    placeholders.push({ id: `TBD-${runId}-R32-${i}`, name: `Vinnare R32-${i}`, group: null });
  }
  for (let i = 1; i <= 8; i++) {
    placeholders.push({ id: `TBD-${runId}-R16-${i}`, name: `Vinnare R16-${i}`, group: null });
  }
  for (let i = 1; i <= 4; i++) {
    placeholders.push({ id: `TBD-${runId}-QF-${i}`, name: `Vinnare QF-${i}`, group: null });
  }
  for (let i = 1; i <= 2; i++) {
    placeholders.push({ id: `TBD-${runId}-SF-${i}`, name: `Vinnare SF-${i}`, group: null });
  }

  await prisma.team.createMany({ data: placeholders });
  return placeholders;
}

async function createKnockoutBracket(
  runId: string,
  teams: { id: string; name: string; group: null }[],
  placeholders: { id: string; name: string; group: null }[]
) {
  const placeholderIds = new Set(placeholders.map((p) => p.id));
  const placeholder = (round: string, num: number) => {
    const id = `TBD-${runId}-${round}-${num}`;
    if (!placeholderIds.has(id)) throw new Error(`Missing placeholder ${id}`);
    return id;
  };

  const data: Prisma.MatchCreateManyInput[] = [];
  let matchNumber = 8100;

  for (let n = 1; n <= 16; n++) {
    data.push(matchData({
      runId,
      stage: "r32",
      code: `${runId}-R32-${n}`,
      matchNumber: matchNumber++,
      homeTeamId: teams[(n - 1) * 2].id,
      awayTeamId: teams[(n - 1) * 2 + 1].id,
      nextMatchCode: `${runId}-R16-${Math.ceil(n / 2)}`,
      nextMatchSlot: n % 2 === 1 ? "home" : "away",
    }));
  }

  for (let n = 1; n <= 8; n++) {
    data.push(matchData({
      runId,
      stage: "r16",
      code: `${runId}-R16-${n}`,
      matchNumber: matchNumber++,
      homeTeamId: placeholder("R32", n * 2 - 1),
      awayTeamId: placeholder("R32", n * 2),
      nextMatchCode: `${runId}-QF-${Math.ceil(n / 2)}`,
      nextMatchSlot: n % 2 === 1 ? "home" : "away",
    }));
  }

  for (let n = 1; n <= 4; n++) {
    data.push(matchData({
      runId,
      stage: "qf",
      code: `${runId}-QF-${n}`,
      matchNumber: matchNumber++,
      homeTeamId: placeholder("R16", n * 2 - 1),
      awayTeamId: placeholder("R16", n * 2),
      nextMatchCode: `${runId}-SF-${Math.ceil(n / 2)}`,
      nextMatchSlot: n % 2 === 1 ? "home" : "away",
    }));
  }

  for (let n = 1; n <= 2; n++) {
    data.push(matchData({
      runId,
      stage: "sf",
      code: `${runId}-SF-${n}`,
      matchNumber: matchNumber++,
      homeTeamId: placeholder("QF", n * 2 - 1),
      awayTeamId: placeholder("QF", n * 2),
      nextMatchCode: `${runId}-F`,
      nextMatchSlot: n === 1 ? "home" : "away",
    }));
  }

  data.push(matchData({
    runId,
    stage: "3p",
    code: `${runId}-3P`,
    matchNumber: matchNumber++,
    homeTeamId: placeholder("SF", 1),
    awayTeamId: placeholder("SF", 2),
    nextMatchCode: null,
    nextMatchSlot: null,
  }));
  data.push(matchData({
    runId,
    stage: "final",
    code: `${runId}-F`,
    matchNumber,
    homeTeamId: placeholder("SF", 1),
    awayTeamId: placeholder("SF", 2),
    nextMatchCode: null,
    nextMatchSlot: null,
  }));

  await prisma.match.createMany({ data });
  return prisma.match.findMany({ where: { bracketCode: { startsWith: runId } } });
}

function matchData(input: {
  runId: string;
  stage: string;
  code: string;
  matchNumber: number;
  homeTeamId: string;
  awayTeamId: string;
  nextMatchCode: string | null;
  nextMatchSlot: "home" | "away" | null;
}) {
  return {
    homeTeamId: input.homeTeamId,
    awayTeamId: input.awayTeamId,
    scheduledAt: new Date("2026-07-01T18:00:00Z"),
    venue: "Integration Arena",
    city: "Test City",
    country: "USA",
    stage: input.stage,
    group: null,
    matchNumber: input.matchNumber,
    status: "upcoming",
    bracketCode: input.code,
    nextMatchCode: input.nextMatchCode,
    nextMatchSlot: input.nextMatchSlot,
  };
}

async function createUsers(runId: string, count: number) {
  const users = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      prisma.user.create({
        data: {
          email: `${runId}-user-${i + 1}@example.test`,
          displayName: `Many User ${i + 1}`,
          password: "integration-test",
        },
      })
    )
  );
  return users;
}

async function createGroups(runId: string, createdBy: string, count: number) {
  return Promise.all(
    Array.from({ length: count }, (_, i) =>
      prisma.group.create({
        data: {
          name: `${runId} Group ${i + 1}`,
          inviteCode: `${runId.slice(0, 8)}${i + 1}`.toUpperCase(),
          createdBy,
        },
      })
    )
  );
}

async function createMemberships(
  users: { id: string }[],
  groups: { id: string }[]
) {
  const groupOne = users.slice(0, 8).map((u) => ({ userId: u.id, groupId: groups[0].id }));
  const groupTwo = users.slice(4, 12).map((u) => ({ userId: u.id, groupId: groups[1].id }));
  const groupThree = users.filter((_, i) => i % 2 === 0).map((u) => ({ userId: u.id, groupId: groups[2].id }));
  await prisma.groupMembership.createMany({ data: [...groupOne, ...groupTwo, ...groupThree] });
}

async function createPredictions(input: {
  users: { id: string }[];
  groups: { id: string }[];
  memberships: { userId: string; groupId: string }[];
  groupMatchId: string;
  r32HomeWinMatchId: string;
  r32AwayWinMatchId: string;
  r16MatchId: string;
  r32HomeTeamId: string;
  r32AwayTeamId: string;
}) {
  const userIndex = new Map(input.users.map((u, i) => [u.id, i]));

  const data = input.memberships.flatMap((membership) => {
    const idx = userIndex.get(membership.userId) ?? 0;
    const groupScore =
      idx % 3 === 0 ? { predictedHome: 2, predictedAway: 1 }
      : idx % 3 === 1 ? { predictedHome: 1, predictedAway: 0 }
      : { predictedHome: 0, predictedAway: 2 };

    return [
      {
        userId: membership.userId,
        groupId: membership.groupId,
        matchId: input.groupMatchId,
        predictedHome: groupScore.predictedHome,
        predictedAway: groupScore.predictedAway,
      },
      {
        userId: membership.userId,
        groupId: membership.groupId,
        matchId: input.r32HomeWinMatchId,
        predictedWinnerTeamId: idx % 2 === 0 ? input.r32HomeTeamId : input.r32AwayTeamId,
      },
      {
        userId: membership.userId,
        groupId: membership.groupId,
        matchId: input.r32AwayWinMatchId,
        predictedWinnerTeamId: input.r32AwayTeamId,
      },
      {
        userId: membership.userId,
        groupId: membership.groupId,
        matchId: input.r16MatchId,
        predictedWinnerTeamId: idx % 2 === 0 ? input.r32HomeTeamId : input.r32AwayTeamId,
      },
    ];
  });

  await prisma.prediction.createMany({ data });
}

async function completeAndScoreGroupMatch(
  matchId: string,
  homeTeamId: string,
  awayTeamId: string
) {
  await prisma.match.update({
    where: { id: matchId },
    data: { status: "completed", homeScore: 2, awayScore: 1 },
  });
  await scorePredictions(matchId, "group", homeTeamId, awayTeamId, 2, 1, null);
}

async function completeAndScoreKnockout(bracketCode: string, winner: "home" | "away") {
  const match = await prisma.match.update({
    where: { bracketCode },
    data: {
      status: "completed",
      homeScore: winner === "home" ? 2 : 0,
      awayScore: winner === "away" ? 2 : 0,
      knockoutWinner: winner,
    },
  });
  await scorePredictions(
    match.id,
    match.stage,
    match.homeTeamId,
    match.awayTeamId,
    match.homeScore ?? 0,
    match.awayScore ?? 0,
    winner
  );
  await propagateBracketWinners(match.id);
}

async function prepareAndCompleteSemifinals(runId: string, teams: { id: string }[]) {
  const sf1 = await prisma.match.update({
    where: { bracketCode: `${runId}-SF-1` },
    data: {
      homeTeamId: teams[4].id,
      awayTeamId: teams[5].id,
      status: "completed",
      homeScore: 1,
      awayScore: 0,
      knockoutWinner: "home",
    },
  });
  await propagateBracketWinners(sf1.id);

  const sf2 = await prisma.match.update({
    where: { bracketCode: `${runId}-SF-2` },
    data: {
      homeTeamId: teams[6].id,
      awayTeamId: teams[7].id,
      status: "completed",
      homeScore: 0,
      awayScore: 1,
      knockoutWinner: "away",
    },
  });
  await propagateBracketWinners(sf2.id);
}

async function createChatLoad(runId: string, groupId: string, users: { id: string }[]) {
  for (let i = 1; i <= 250; i++) {
    await prisma.chatMessage.create({
      data: {
        groupId,
        userId: users[i % users.length].id,
        content: `${runId}-message-${String(i).padStart(3, "0")}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
      },
    });
  }
}

async function cleanup(ids: CreatedIds) {
  await prisma.prediction.deleteMany({
    where: {
      OR: [
        { userId: { in: ids.users } },
        { groupId: { in: ids.groups } },
        { matchId: { in: ids.matches } },
      ],
    },
  });
  await prisma.chatMessage.deleteMany({ where: { groupId: { in: ids.groups } } });
  await prisma.groupMembership.deleteMany({
    where: {
      OR: [{ groupId: { in: ids.groups } }, { userId: { in: ids.users } }],
    },
  });
  await prisma.group.deleteMany({ where: { id: { in: ids.groups } } });
  await prisma.match.deleteMany({
    where: {
      OR: [
        { id: { in: ids.matches } },
        { homeTeamId: { in: ids.teams } },
        { awayTeamId: { in: ids.teams } },
      ],
    },
  });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  await prisma.team.deleteMany({ where: { id: { in: ids.teams } } });
}
