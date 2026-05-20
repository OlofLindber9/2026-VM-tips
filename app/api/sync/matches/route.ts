/**
 * POST /api/sync/matches
 *
 * Protected endpoint that triggers a match data sync from API-Football.
 * Call this from an external cron service (e.g. Vercel Cron, GitHub Actions,
 * cron-job.org) on whatever interval you need:
 *
 *   - POST /api/sync/matches?mode=window every 5 minutes
 *   - POST /api/sync/matches?mode=live every 15 seconds on match days
 *   - POST /api/sync/matches once per day before the tournament
 *
 * Security: requires the Authorization header to match SYNC_SECRET env var.
 *
 * Example cron call:
 *   curl -X POST https://your-app.vercel.app/api/sync/matches \
 *     -H "Authorization: Bearer <SYNC_SECRET>"
 */

import { NextResponse } from "next/server";
import { syncMatches, type SyncMode } from "@/lib/sync";

export async function POST(request: Request) {
  // Verify secret
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SYNC_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const mode = syncModeFromRequest(request);
    const result = await syncMatches({ mode });
    console.log("[sync] Result:", result);
    return NextResponse.json({ ok: true, mode, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function syncModeFromRequest(request: Request): SyncMode {
  const mode = new URL(request.url).searchParams.get("mode");
  if (mode === "live" || mode === "window" || mode === "auto") return mode;
  return "auto";
}
