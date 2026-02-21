import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchCalendar, fetchResults } from "@/lib/fis/fetcher";
import { calculateScore, getPodiumFromResults } from "@/lib/scoring";

// POST /api/fis/sync  — syncs calendar races for current season
// POST /api/fis/sync?action=results&raceId=46737  — syncs results for a race and scores predictions
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const raceId = searchParams.get("raceId");

  try {
    if (action === "results" && raceId) {
      return await syncResults(raceId);
    }
    return await syncCalendar();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function syncCalendar() {
  // Current season — FIS season code is the ending year (e.g. 2026 = 2025-26)
  const currentYear = new Date().getFullYear();
  const month = new Date().getMonth(); // 0-indexed
  // FIS season starts in October/November; if we're past July, use next year code
  const seasonCode = month >= 7 ? String(currentYear + 1) : String(currentYear);

  const races = await fetchCalendar(seasonCode);

  let created = 0;
  let updated = 0;

  for (const race of races) {
    const existing = await prisma.race.findUnique({ where: { id: race.id } });
    if (existing) {
      await prisma.race.update({
        where: { id: race.id },
        data: {
          name: race.name,
          venue: race.venue,
          country: race.country,
          date: race.date,
          discipline: race.discipline,
          gender: race.gender,
        },
      });
      updated++;
    } else {
      await prisma.race.create({ data: race });
      created++;
    }
  }

  return NextResponse.json({ ok: true, created, updated, total: races.length });
}

async function syncResults(raceId: string) {
  const fisResults = await fetchResults(raceId);
  if (fisResults.length === 0) {
    return NextResponse.json({ error: "No results found" }, { status: 404 });
  }

  // Upsert athletes
  for (const r of fisResults) {
    await prisma.athlete.upsert({
      where: { id: r.athleteId },
      update: { name: r.athleteName, nationCode: r.nationCode },
      create: { id: r.athleteId, name: r.athleteName, nationCode: r.nationCode },
    });
  }

  // Upsert results
  for (const r of fisResults) {
    await prisma.result.upsert({
      where: { raceId_athleteId: { raceId, athleteId: r.athleteId } },
      update: { rank: r.rank },
      create: { raceId, athleteId: r.athleteId, rank: r.rank },
    });
  }

  // Mark race as completed
  await prisma.race.update({
    where: { id: raceId },
    data: { status: "completed" },
  });

  // Score all predictions for this race
  const podium = getPodiumFromResults(
    fisResults.map((r) => ({ athleteId: r.athleteId, rank: r.rank }))
  );

  let scored = 0;
  if (podium) {
    const predictions = await prisma.prediction.findMany({
      where: { raceId },
    });

    for (const pred of predictions) {
      const score = calculateScore(
        { first: pred.first, second: pred.second, third: pred.third },
        podium
      );
      await prisma.prediction.update({
        where: { id: pred.id },
        data: { score },
      });
      scored++;
    }
  }

  return NextResponse.json({
    ok: true,
    results: fisResults.length,
    scored,
    podium,
  });
}
