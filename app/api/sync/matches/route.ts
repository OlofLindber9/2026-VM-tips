/**
 * POST /api/sync/matches
 *
 * Protected endpoint that triggers a match data sync from API-Football.
 * Call this from an external cron service (e.g. Vercel Cron, GitHub Actions,
 * cron-job.org) on whatever interval you need:
 *
 *   - Pre-tournament:  once per day (just to keep fixtures up-to-date)
 *   - Match days:      every 60 seconds while matches are live
 *   - Between matches: every 5 minutes
 *
 * Security: requires the Authorization header to match SYNC_SECRET env var.
 *
 * Example cron call:
 *   curl -X POST https://your-app.vercel.app/api/sync/matches \
 *     -H "Authorization: Bearer <SYNC_SECRET>"
 */

import { NextResponse } from "next/server";
import { syncMatches } from "@/lib/sync";

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
    const result = await syncMatches();
    console.log("[sync] Result:", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sync] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
