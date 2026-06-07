import { prisma } from "@/lib/prisma";

export const KNOCKOUT_PREDICTION_STAGES = ["r32", "r16", "qf", "sf", "3p", "final"] as const;

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
  const groupStageCompleted = groupMatchesTotal > 0 && incompleteGroupMatches === 0;
  const knockoutStarted =
    startedKnockoutMatches > 0 ||
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

export function knockoutPredictionWindowError(
  window: KnockoutPredictionWindow
): string {
  if (window.knockoutMatchesTotal === 0) {
    return "Slutspelstr\u00e4det \u00e4r inte tillg\u00e4ngligt \u00e4nnu.";
  }
  if (!window.groupStageCompleted) {
    return "Slutspelstipsningen \u00f6ppnar n\u00e4r alla gruppspelsmatcher \u00e4r klara.";
  }
  if (window.knockoutStarted) {
    return "Slutspelstipsningen \u00e4r st\u00e4ngd eftersom slutspelet har startat.";
  }
  return "Slutspelstipsningen \u00e4r inte \u00f6ppen just nu.";
}
