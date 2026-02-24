import { NextResponse } from "next/server";
import { syncCalendar, syncRaceResults, syncCompletedRaces, syncWcStandings } from "@/lib/fis/sync";
import { prisma } from "@/lib/prisma";

// POST /api/fis/sync                                     — sync calendar
// POST /api/fis/sync?action=results&raceId=X&fisRaceId=Y — sync one race
// POST /api/fis/sync?action=auto                         — sync all past races + standings
// POST /api/fis/sync?action=standings                    — sync WC standings only
// POST /api/fis/sync?action=reset                        — wipe all races/results/predictions, then re-sync
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const raceId = searchParams.get("raceId");
  const fisRaceId = searchParams.get("fisRaceId");

  try {
    if (action === "results" && raceId && fisRaceId) {
      const { results, scored } = await syncRaceResults(raceId, fisRaceId);
      if (results === 0) {
        return NextResponse.json({ error: "No results found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, results, scored });
    }

    if (action === "auto") {
      const { synced } = await syncCompletedRaces();
      return NextResponse.json({ ok: true, synced });
    }

    if (action === "standings") {
      const { men, women } = await syncWcStandings();
      return NextResponse.json({ ok: true, men, women });
    }

    if (action === "reset") {
      // Delete in FK-safe order: results and predictions first, then races
      const [deletedResults, deletedPredictions, deletedRaces] = await Promise.all([
        prisma.result.deleteMany(),
        prisma.prediction.deleteMany(),
      ]).then(async ([r, p]) => {
        const races = await prisma.race.deleteMany();
        return [r.count, p.count, races.count];
      });
      const total = await syncCalendar();
      return NextResponse.json({ ok: true, deletedResults, deletedPredictions, deletedRaces, synced: total });
    }

    const total = await syncCalendar();
    return NextResponse.json({ ok: true, total });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
