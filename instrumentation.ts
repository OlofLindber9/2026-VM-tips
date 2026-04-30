/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Makes one sync call to API-Football to pick up any live/completed matches.
 */

export async function register() {
  // Only run in the Node.js runtime (not edge), and only on the server
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Skip during build
  if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE === "phase-production-build") return;

  // Dynamic import so this module isn't bundled for the edge runtime
  const { syncMatches } = await import("@/lib/sync");

  console.log("[startup-sync] Running initial match sync...");
  try {
    const result = await syncMatches();
    console.log("[startup-sync] Done:", result);
  } catch (err) {
    // Non-fatal — app still starts, sync can run again via cron
    console.error("[startup-sync] Failed:", err instanceof Error ? err.message : err);
  }
}
