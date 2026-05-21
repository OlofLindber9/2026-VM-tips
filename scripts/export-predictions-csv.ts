/**
 * Export a human-readable CSV backup of every user and every prediction.
 *
 * Run:
 *   npm run db:backup:predictions
 *
 * Optional:
 *   npm run db:backup:predictions -- --out backups/my-file.csv
 *   npm run db:backup:predictions -- --predictions-only
 */

import * as nextEnv from "@next/env";
import { PrismaClient, type Prisma } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

nextEnv.loadEnvConfig(process.cwd());

const prisma = new PrismaClient();

type CsvValue = string | number | null | undefined;

type ExportPrediction = Prisma.PredictionGetPayload<{
  include: {
    group: { select: { id: true; name: true } };
    match: {
      include: {
        homeTeam: { select: { id: true; name: true } };
        awayTeam: { select: { id: true; name: true } };
      };
    };
  };
}>;

const HEADERS = [
  "user_name",
  "user_email",
  "user_groups",
  "prediction_group",
  "match_number",
  "match_stage",
  "match_group",
  "bracket_code",
  "kickoff_utc",
  "match",
  "match_status",
  "prediction",
  "actual_result",
  "points",
  "prediction_created_at",
  "prediction_updated_at",
  "user_id",
  "group_id",
  "match_id",
  "prediction_id",
];

async function main() {
  const outPath = outputPathFromArgs();
  const predictionsOnly = process.argv.includes("--predictions-only");

  const [users, memberships, teams, predictions] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ displayName: "asc" }, { email: "asc" }],
      select: { id: true, displayName: true, email: true },
    }),
    prisma.groupMembership.findMany({
      include: { group: { select: { id: true, name: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    prisma.team.findMany({ select: { id: true, name: true } }),
    prisma.prediction.findMany({
      include: {
        group: { select: { id: true, name: true } },
        match: {
          include: {
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [
        { userId: "asc" },
        { groupId: "asc" },
        { match: { scheduledAt: "asc" } },
        { createdAt: "asc" },
      ],
    }),
  ]);

  const teamsById = new Map(teams.map((team) => [team.id, team.name]));
  const userGroupsByUserId = new Map<string, string[]>();

  for (const membership of memberships) {
    const current = userGroupsByUserId.get(membership.userId) ?? [];
    current.push(membership.group.name);
    userGroupsByUserId.set(membership.userId, current);
  }

  const usersById = new Map(users.map((user) => [user.id, user]));
  const predictionsByUserId = new Map<string, typeof predictions>();

  for (const prediction of predictions) {
    const current = predictionsByUserId.get(prediction.userId) ?? [];
    current.push(prediction);
    predictionsByUserId.set(prediction.userId, current);
  }

  const rows: CsvValue[][] = [HEADERS];

  for (const user of users) {
    const userPredictions = predictionsByUserId.get(user.id) ?? [];

    if (userPredictions.length === 0) {
      if (!predictionsOnly) rows.push(emptyPredictionRow(user, userGroupsByUserId));
      continue;
    }

    for (const prediction of userPredictions) {
      const match = prediction.match;
      rows.push([
        user.displayName,
        user.email,
        userGroupsByUserId.get(user.id)?.join(" | ") ?? "",
        prediction.group.name,
        match.matchNumber ?? "",
        stageLabel(match.stage),
        match.group ?? "",
        match.bracketCode ?? "",
        formatUtc(match.scheduledAt),
        `${match.homeTeam.name} vs ${match.awayTeam.name}`,
        match.status,
        predictionText(prediction, teamsById),
        actualResultText(prediction, teamsById),
        prediction.score ?? "",
        formatUtc(prediction.createdAt),
        formatUtc(prediction.updatedAt),
        user.id,
        prediction.groupId,
        prediction.matchId,
        prediction.id,
      ]);
    }
  }

  // Predictions for users that no longer exist should still be recoverable.
  const orphanPredictions = predictions.filter((prediction) => !usersById.has(prediction.userId));
  for (const prediction of orphanPredictions) {
    rows.push([
      "(missing user)",
      "",
      "",
      prediction.group.name,
      prediction.match.matchNumber ?? "",
      stageLabel(prediction.match.stage),
      prediction.match.group ?? "",
      prediction.match.bracketCode ?? "",
      formatUtc(prediction.match.scheduledAt),
      `${prediction.match.homeTeam.name} vs ${prediction.match.awayTeam.name}`,
      prediction.match.status,
      predictionText(prediction, teamsById),
      actualResultText(prediction, teamsById),
      prediction.score ?? "",
      formatUtc(prediction.createdAt),
      formatUtc(prediction.updatedAt),
      prediction.userId,
      prediction.groupId,
      prediction.matchId,
      prediction.id,
    ]);
  }

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, toCsv(rows), "utf8");

  console.log(`Exported ${rows.length - 1} CSV rows`);
  console.log(`Saved to ${outPath}`);
}

function outputPathFromArgs(): string {
  const outIndex = process.argv.indexOf("--out");
  if (outIndex >= 0) {
    const explicitPath = process.argv[outIndex + 1];
    if (!explicitPath) throw new Error("Missing value after --out");
    return path.resolve(explicitPath);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.resolve("backups", `predictions-${stamp}.csv`);
}

function emptyPredictionRow(
  user: { id: string; displayName: string; email: string },
  userGroupsByUserId: Map<string, string[]>
): CsvValue[] {
  return [
    user.displayName,
    user.email,
    userGroupsByUserId.get(user.id)?.join(" | ") ?? "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "No predictions",
    "",
    "",
    "",
    "",
    user.id,
    "",
    "",
    "",
  ];
}

function predictionText(
  prediction: ExportPrediction,
  teamsById: Map<string, string>
): string {
  const match = prediction.match;

  if (match.stage === "group") {
    if (prediction.predictedHome === null || prediction.predictedAway === null) {
      return "No score prediction";
    }
    return `${match.homeTeam.name} ${prediction.predictedHome}-${prediction.predictedAway} ${match.awayTeam.name}`;
  }

  const winnerTeamId =
    prediction.predictedWinnerTeamId ??
    legacyWinnerTeamId(prediction.predictedWinner, match.homeTeam.id, match.awayTeam.id);
  const winnerName = winnerTeamId ? teamsById.get(winnerTeamId) ?? winnerTeamId : "No winner prediction";

  if (match.stage === "final" && prediction.predictedHome !== null && prediction.predictedAway !== null) {
    return `${winnerName} wins, 90 min ${match.homeTeam.name} ${prediction.predictedHome}-${prediction.predictedAway} ${match.awayTeam.name}`;
  }

  return `${winnerName} wins`;
}

function actualResultText(
  prediction: ExportPrediction,
  teamsById: Map<string, string>
): string {
  const match = prediction.match;
  if (match.homeScore === null || match.awayScore === null) return "Not played";

  const score = `${match.homeTeam.name} ${match.homeScore}-${match.awayScore} ${match.awayTeam.name}`;
  if (match.stage === "group") return score;

  const winnerTeamId = legacyWinnerTeamId(match.knockoutWinner, match.homeTeam.id, match.awayTeam.id);
  const winner = winnerTeamId ? teamsById.get(winnerTeamId) ?? winnerTeamId : "Unknown winner";
  return `${score}, winner ${winner}`;
}

function legacyWinnerTeamId(
  side: string | null,
  homeTeamId: string,
  awayTeamId: string
): string | null {
  if (side === "home") return homeTeamId;
  if (side === "away") return awayTeamId;
  return null;
}

function stageLabel(stage: string): string {
  switch (stage) {
    case "group": return "Group stage";
    case "r32": return "Round of 32";
    case "r16": return "Round of 16";
    case "qf": return "Quarter-final";
    case "sf": return "Semi-final";
    case "3p": return "Third-place match";
    case "final": return "Final";
    default: return stage;
  }
}

function formatUtc(date: Date): string {
  return date.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function toCsv(rows: CsvValue[][]): string {
  return `${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}\n`;
}

function csvEscape(value: CsvValue): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
