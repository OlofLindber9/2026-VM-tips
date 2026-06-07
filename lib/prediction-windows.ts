import { prisma } from "@/lib/prisma";

export const KNOCKOUT_PREDICTION_STAGES = ["r32", "r16", "qf", "sf", "3p", "final"] as const;
export const DEV_OPEN_KNOCKOUT_PREDICTION_WINDOW_ENV =
  "DEV_OPEN_KNOCKOUT_PREDICTION_WINDOW";

export type KnockoutPredictionWindow = {
  isOpen: boolean;
  groupStageCompleted: boolean;
  knockoutStarted: boolean;
  groupMatchesTotal: number;
  incompleteGroupMatches: number;
  knockoutMatchesTotal: number;
  firstKnockoutStartsAt: Date | null;
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
      select: { scheduledAt: true },
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

  const firstKnockoutStartsAt = firstKnockout?.scheduledAt ?? null;
  const devWindowOverride = isDevKnockoutPredictionWindowOverrideEnabled();
  const groupStageCompleted =
    devWindowOverride || (groupMatchesTotal > 0 && incompleteGroupMatches === 0);
  const knockoutStarted = devWindowOverride
    ? false
    : startedKnockoutMatches > 0 ||
      (firstKnockoutStartsAt !== null && firstKnockoutStartsAt <= now);

  return {
    isOpen:
      groupStageCompleted &&
      knockoutMatchesTotal > 0 &&
      firstKnockoutStartsAt !== null &&
      !knockoutStarted,
    groupStageCompleted,
    knockoutStarted,
    groupMatchesTotal,
    incompleteGroupMatches,
    knockoutMatchesTotal,
    firstKnockoutStartsAt,
  };
}

function isDevKnockoutPredictionWindowOverrideEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env[DEV_OPEN_KNOCKOUT_PREDICTION_WINDOW_ENV] === "true"
  );
}

export function knockoutPredictionWindowError(
  window: KnockoutPredictionWindow
): string {
  if (window.knockoutMatchesTotal === 0) {
    return "Slutspelsträdet är inte tillgängligt ännu.";
  }
  if (!window.groupStageCompleted) {
    return "Slutspelstipsningen öppnar när alla gruppspelsmatcher är klara.";
  }
  if (window.knockoutStarted) {
    return "Slutspelstipsningen är stängd eftersom slutspelet har startat.";
  }
  return "Slutspelstipsningen är inte öppen just nu.";
}
