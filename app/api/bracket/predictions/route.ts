import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPlaceholderTeamId } from "@/lib/utils";
import {
  KNOCKOUT_PREDICTION_STAGES,
  getKnockoutPredictionWindow,
  knockoutPredictionWindowError,
} from "@/lib/prediction-windows";

type BracketSlot = "home" | "away";

type PredictionInput = {
  matchId: unknown;
  predictedWinnerTeamId: unknown;
  predictedHome?: unknown;
  predictedAway?: unknown;
};

type KnockoutMatch = {
  id: string;
  stage: string;
  bracketCode: string | null;
  nextMatchCode: string | null;
  nextMatchSlot: string | null;
  homeTeamId: string;
  awayTeamId: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
};

type BracketTeam = { id: string; name: string };
type MatchParticipants = { home: BracketTeam | null; away: BracketTeam | null };

const STAGE_ORDER = ["r32", "r16", "qf", "sf", "3p", "final"] as const;

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user!.id as string;
  const body = await request.json();
  const groupId = typeof body.groupId === "string" ? body.groupId : "";
  const predictions = Array.isArray(body.predictions)
    ? (body.predictions as PredictionInput[])
    : null;

  if (!groupId || !predictions) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { userId_groupId: { userId, groupId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Du är inte med i den här gruppen" }, { status: 403 });
  }

  const predictionWindow = await getKnockoutPredictionWindow();
  if (!predictionWindow.isOpen) {
    return NextResponse.json(
      { error: knockoutPredictionWindowError(predictionWindow) },
      { status: 403 }
    );
  }

  const matches = await prisma.match.findMany({
    where: { stage: { in: [...KNOCKOUT_PREDICTION_STAGES] } },
    include: { homeTeam: true, awayTeam: true },
  });
  const sortedMatches = sortMatches(matches);
  if (sortedMatches.length === 0) {
    return NextResponse.json({ error: "Slutspelsträdet är inte tillgängligt ännu." }, { status: 400 });
  }

  const predictionByMatchId = new Map<string, PredictionInput>();
  for (const prediction of predictions) {
    if (typeof prediction.matchId !== "string") {
      return NextResponse.json({ error: "Ogiltig match i slutspelstipset." }, { status: 400 });
    }
    if (predictionByMatchId.has(prediction.matchId)) {
      return NextResponse.json({ error: "Samma match finns flera gånger i tipset." }, { status: 400 });
    }
    predictionByMatchId.set(prediction.matchId, prediction);
  }

  const requiredMatchIds = new Set(sortedMatches.map((match) => match.id));
  for (const matchId of predictionByMatchId.keys()) {
    if (!requiredMatchIds.has(matchId)) {
      return NextResponse.json({ error: "Tipset innehåller en okänd slutspelsmatch." }, { status: 400 });
    }
  }
  if (predictionByMatchId.size !== sortedMatches.length) {
    return NextResponse.json(
      { error: "Du måste tippa hela slutspelsträdet innan det kan sparas." },
      { status: 400 }
    );
  }

  const validation = validateCompleteBracket(sortedMatches, predictionByMatchId);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const operations = validation.predictions.map((prediction) =>
    prisma.prediction.upsert({
      where: {
        userId_matchId_groupId: {
          userId,
          matchId: prediction.matchId,
          groupId,
        },
      },
      update: {
        predictedHome: prediction.predictedHome,
        predictedAway: prediction.predictedAway,
        predictedWinner: null,
        predictedWinnerTeamId: prediction.predictedWinnerTeamId,
        score: null,
      },
      create: {
        userId,
        matchId: prediction.matchId,
        groupId,
        predictedHome: prediction.predictedHome,
        predictedAway: prediction.predictedAway,
        predictedWinner: null,
        predictedWinnerTeamId: prediction.predictedWinnerTeamId,
      },
    })
  );

  await prisma.$transaction(operations);
  return NextResponse.json({ ok: true, count: operations.length });
}

function validateCompleteBracket(
  matches: KnockoutMatch[],
  predictionByMatchId: Map<string, PredictionInput>
):
  | {
      ok: true;
      predictions: {
        matchId: string;
        predictedWinnerTeamId: string;
        predictedHome: number | null;
        predictedAway: number | null;
      }[];
    }
  | { ok: false; error: string } {
  const matchByCode = new Map<string, KnockoutMatch>();
  for (const match of matches) {
    if (!match.bracketCode) {
      return { ok: false, error: "Slutspelsträdet saknar matchkoder." };
    }
    matchByCode.set(match.bracketCode, match);
  }

  const participantsByMatchId = new Map<string, MatchParticipants>();
  for (const match of matches.filter((match) => match.stage === "r32")) {
    const participants = actualParticipants(match);
    if (!participants.home || !participants.away) {
      return {
        ok: false,
        error: `${match.bracketCode ?? "En match"} saknar fastställda lag.`,
      };
    }
    participantsByMatchId.set(match.id, participants);
  }

  const validated: {
    matchId: string;
    predictedWinnerTeamId: string;
    predictedHome: number | null;
    predictedAway: number | null;
  }[] = [];

  for (const stage of STAGE_ORDER) {
    for (const match of matches.filter((item) => item.stage === stage)) {
      const input = predictionByMatchId.get(match.id);
      if (!input) {
        return { ok: false, error: `${match.bracketCode ?? "En match"} saknar tips.` };
      }

      const participants = participantsByMatchId.get(match.id) ?? actualParticipants(match);
      if (!participants.home || !participants.away) {
        return {
          ok: false,
          error: `${match.bracketCode ?? "En match"} saknar lag från tidigare tips.`,
        };
      }

      if (typeof input.predictedWinnerTeamId !== "string" || input.predictedWinnerTeamId.length === 0) {
        return { ok: false, error: `${match.bracketCode ?? "En match"} saknar vinnare.` };
      }

      const winner = selectedTeam(input.predictedWinnerTeamId, participants);
      if (!winner) {
        return {
          ok: false,
          error: `${match.bracketCode ?? "En match"} har en vinnare som inte kan spela matchen.`,
        };
      }

      let predictedHome: number | null = null;
      let predictedAway: number | null = null;
      if (match.stage === "final") {
        const scores = parseFinalScores(input);
        if (!scores) {
          return {
            ok: false,
            error: "Finalen måste ha både 90-minutersresultat och vinnare.",
          };
        }
        predictedHome = scores.home;
        predictedAway = scores.away;
      }

      validated.push({
        matchId: match.id,
        predictedWinnerTeamId: winner.id,
        predictedHome,
        predictedAway,
      });

      propagateWinner(match, participants, winner, matchByCode, participantsByMatchId);
    }
  }

  return { ok: true, predictions: validated };
}

function propagateWinner(
  match: KnockoutMatch,
  participants: MatchParticipants,
  winner: BracketTeam,
  matchByCode: Map<string, KnockoutMatch>,
  participantsByMatchId: Map<string, MatchParticipants>
) {
  const nextSlot = normalizeSlot(match.nextMatchSlot);
  if (match.nextMatchCode && nextSlot) {
    const nextMatch = matchByCode.get(match.nextMatchCode);
    if (nextMatch) setParticipant(nextMatch.id, nextSlot, winner, participantsByMatchId);
  }

  if (match.stage === "sf" && nextSlot) {
    const thirdPlace = matchByCode.get("3P");
    const loser = winner.id === participants.home?.id ? participants.away : participants.home;
    if (thirdPlace && loser) setParticipant(thirdPlace.id, nextSlot, loser, participantsByMatchId);
  }
}

function setParticipant(
  matchId: string,
  slot: BracketSlot,
  team: BracketTeam,
  participantsByMatchId: Map<string, MatchParticipants>
) {
  const current = participantsByMatchId.get(matchId) ?? { home: null, away: null };
  participantsByMatchId.set(matchId, { ...current, [slot]: team });
}

function actualParticipants(match: KnockoutMatch): MatchParticipants {
  return {
    home: isPlaceholderTeamId(match.homeTeamId) ? null : match.homeTeam,
    away: isPlaceholderTeamId(match.awayTeamId) ? null : match.awayTeam,
  };
}

function selectedTeam(teamId: string, participants: MatchParticipants): BracketTeam | null {
  if (participants.home?.id === teamId) return participants.home;
  if (participants.away?.id === teamId) return participants.away;
  return null;
}

function parseFinalScores(input: PredictionInput): { home: number; away: number } | null {
  const home = parseScore(input.predictedHome);
  const away = parseScore(input.predictedAway);
  if (home === null || away === null) return null;
  return { home, away };
}

function parseScore(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const score = Number(value);
  if (!Number.isInteger(score)) return null;
  if (score < 0 || score > 99) return null;
  return score;
}

function normalizeSlot(slot: string | null): BracketSlot | null {
  return slot === "home" || slot === "away" ? slot : null;
}

function sortMatches<T extends KnockoutMatch>(matches: T[]): T[] {
  return [...matches].sort((a, b) => {
    const stageDiff = stageOrder(a.stage) - stageOrder(b.stage);
    if (stageDiff !== 0) return stageDiff;
    return bracketCodeOrder(a.bracketCode) - bracketCodeOrder(b.bracketCode);
  });
}

function stageOrder(stage: string): number {
  const index = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  return index === -1 ? 999 : index;
}

function bracketCodeOrder(code: string | null): number {
  if (!code) return 999;
  const match = code.match(/-(\d+)$/);
  if (match) return Number(match[1]);
  if (code === "3P") return 1;
  if (code === "F") return 1;
  return 999;
}
