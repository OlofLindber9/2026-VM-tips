import { prisma } from "@/lib/prisma";

export const KNOCKOUT_PREDICTION_STAGES = ["r32", "r16", "qf", "sf", "3p", "final"] as const;

export type KnockoutPredictionWindow = {
  isOpen: boolean;
  groupStageCompleted: boolean;
  knockoutStarted: boolean;
  knockoutBracketReady: boolean;
  groupMatchesTotal: number;
  incompleteGroupMatches: number;
  knockoutMatchesTotal: number;
  initialKnockoutStage: string | null;
  initialKnockoutMatchesTotal: number;
  incompleteInitialKnockoutMatches: number;
  firstKnockoutStartsAt: Date | null;
};

export type KnockoutPredictionWindowInput = {
  now: Date;
  groupMatchesTotal: number;
  incompleteGroupMatches: number;
  knockoutMatchesTotal: number;
  initialKnockoutStage: string | null;
  initialKnockoutMatchesTotal: number;
  incompleteInitialKnockoutMatches: number;
  firstKnockoutStartsAt: Date | null;
  startedKnockoutMatches: number;
};

export async function getKnockoutPredictionWindow(
  now = new Date()
): Promise<KnockoutPredictionWindow> {
  const [
    groupMatchesTotal,
    incompleteGroupMatches,
    knockoutMatchesTotal,
    firstKnockout,
    startedKnockoutMatches,
  ] = await Promise.all([
    prisma.match.count({ where: { stage: "group" } }),
    prisma.match.count({ where: { stage: "group", status: { not: "completed" } } }),
    prisma.match.count({ where: { stage: { in: [...KNOCKOUT_PREDICTION_STAGES] } } }),
    prisma.match.findFirst({
      where: { stage: { in: [...KNOCKOUT_PREDICTION_STAGES] } },
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true, stage: true },
    }),
    prisma.match.count({
      where: {
        stage: { in: [...KNOCKOUT_PREDICTION_STAGES] },
        OR: [
          { status: { in: ["live", "completed"] } },
          { scheduledAt: { lte: now } },
        ],
      },
    }),
  ]);

  const initialKnockoutStage = firstKnockout?.stage ?? null;
  const [initialKnockoutMatchesTotal, incompleteInitialKnockoutMatches] =
    initialKnockoutStage
      ? await Promise.all([
          prisma.match.count({ where: { stage: initialKnockoutStage } }),
          prisma.match.count({
            where: {
              stage: initialKnockoutStage,
              OR: [
                { homeTeamId: "TBD" },
                { awayTeamId: "TBD" },
                { homeTeamId: { startsWith: "TBD-" } },
                { awayTeamId: { startsWith: "TBD-" } },
              ],
            },
          }),
        ])
      : [0, 0];

  return evaluateKnockoutPredictionWindow({
    now,
    groupMatchesTotal,
    incompleteGroupMatches,
    knockoutMatchesTotal,
    initialKnockoutStage,
    initialKnockoutMatchesTotal,
    incompleteInitialKnockoutMatches,
    firstKnockoutStartsAt: firstKnockout?.scheduledAt ?? null,
    startedKnockoutMatches,
  });
}

export function evaluateKnockoutPredictionWindow(
  input: KnockoutPredictionWindowInput
): KnockoutPredictionWindow {
  const firstKnockoutStartsAt = input.firstKnockoutStartsAt;
  const groupStageCompleted =
    input.groupMatchesTotal > 0 && input.incompleteGroupMatches === 0;
  const knockoutBracketReady =
    input.initialKnockoutMatchesTotal > 0 &&
    input.incompleteInitialKnockoutMatches === 0;
  const knockoutStarted =
    input.startedKnockoutMatches > 0 ||
    (firstKnockoutStartsAt !== null && firstKnockoutStartsAt <= input.now);

  return {
    isOpen:
      groupStageCompleted &&
      input.knockoutMatchesTotal > 0 &&
      knockoutBracketReady &&
      firstKnockoutStartsAt !== null &&
      !knockoutStarted,
    groupStageCompleted,
    knockoutStarted,
    knockoutBracketReady,
    groupMatchesTotal: input.groupMatchesTotal,
    incompleteGroupMatches: input.incompleteGroupMatches,
    knockoutMatchesTotal: input.knockoutMatchesTotal,
    initialKnockoutStage: input.initialKnockoutStage,
    initialKnockoutMatchesTotal: input.initialKnockoutMatchesTotal,
    incompleteInitialKnockoutMatches: input.incompleteInitialKnockoutMatches,
    firstKnockoutStartsAt,
  };
}

export function knockoutPredictionWindowError(
  window: KnockoutPredictionWindow
): string {
  if (window.knockoutMatchesTotal === 0) {
    return "Slutspelstr\u00e4det \u00e4r inte tillg\u00e4ngligt \u00e4nnu.";
  }
  if (window.knockoutStarted) {
    return "Slutspelstipsningen \u00e4r st\u00e4ngd eftersom slutspelet har startat.";
  }
  if (!window.groupStageCompleted) {
    return "Slutspelstipsningen \u00f6ppnar n\u00e4r alla gruppspelsmatcher \u00e4r klara.";
  }
  if (!window.knockoutBracketReady) {
    return "Slutspelstipsningen \u00f6ppnar n\u00e4r alla lag i f\u00f6rsta slutspelsrundan \u00e4r klara.";
  }
  return "Slutspelstipsningen \u00e4r inte \u00f6ppen just nu.";
}
