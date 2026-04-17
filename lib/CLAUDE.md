# lib/CLAUDE.md — Utility Libraries

## prisma.ts — Database client

Singleton PrismaClient to avoid multiple connections in Next.js dev mode (hot reload creates new module instances). Always import from here:

```typescript
import prisma from "@/lib/prisma";
```

---

## auth.ts (root-level, not in lib/)

Path: `/auth.ts`

NextAuth 5 configuration. Exports: `handlers`, `auth`, `signIn`, `signOut`.

**Provider:** Credentials (email + password)

**JWT callbacks:**
```typescript
jwt:     token ← user.id    (on sign-in)
session: session.user.id ← token.id  (on every request)
```

**Usage in server components/API routes:**
```typescript
import { auth } from "@/auth";
const session = await auth();
if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
const userId = session.user.id;
```

**Custom pages:** signIn → `/login`

---

## api-football.ts — Live match data client

Wrapper for api-football.com REST API. WC 2026 = league ID 1, season 2026.

**Environment:** Requires `API_FOOTBALL_KEY` env var. Free tier = 100 requests/day.

### Functions

```typescript
getLiveFixtures(): Promise<Fixture[]>
// All currently live WC 2026 matches

getFixturesByDate(date: string): Promise<Fixture[]>
// date = "YYYY-MM-DD", returns matches scheduled for that day

getAllFixtures(): Promise<Fixture[]>
// All WC 2026 matches (use sparingly — expensive call)
```

### Status helpers

```typescript
isLive(status: string): boolean
// true for: "1H", "HT", "2H", "ET", "BT", "P", "INT"

isCompleted(status: string): boolean
// true for: "FT", "AET", "PEN"

minuteLabel(status: string): string
// "HT" → "HT"
// "45'" → "45'"
// anything else → status code itself
```

### Fixture type (key fields)
```typescript
{
  fixture: {
    id: number       // apiFootballId — used to match DB records
    status: { short: string, elapsed: number | null }
    date: string     // ISO timestamp
  }
  teams: {
    home: { name: string }
    away: { name: string }
  }
  goals: {
    home: number | null
    away: number | null
  }
}
```

---

## sync.ts — Match synchronization

This is the core business logic for keeping match data current and scoring predictions.

### bootstrapApiIds()

Run once (or whenever new matches lack `apiFootballId`). Maps DB matches to API-Football fixture IDs.

**Algorithm:**
1. Fetches all WC 2026 fixtures from API-Football
2. For each DB match missing `apiFootballId`:
   - Normalizes team names to lowercase
   - Finds API fixture where both team names match (substring match)
   - Allows ±1 day date tolerance (timezone edge cases)
3. Writes `apiFootballId` to matched DB matches

**Note:** Team name matching is fuzzy — "United States" in API matches "usa" in DB name. If bootstrap fails for a match, sync silently skips it until manually fixed.

### syncMatches()

Main function called by `POST /api/sync/matches`.

```typescript
async function syncMatches(): Promise<{
  live: number
  completed: number
  predictionsScored: number
  bootstrapped?: number
}>
```

**Steps:**
1. Bootstrap if any matches lack `apiFootballId`
2. Fetch live fixtures + today's fixtures from API-Football
3. For each fetched fixture, find matching DB match by `apiFootballId`
4. Update match: `status`, `homeScore`, `awayScore`, `minute`
5. If match just became `completed`: call `scorePredictions()`
6. Return summary counts

**Status transitions:**
- API `isLive()` → DB `"live"`
- API `isCompleted()` → DB `"completed"` + score predictions
- Otherwise → DB `"upcoming"`

### scorePredictions(matchId, homeScore, awayScore)

Scores all unscored predictions for a match.

```typescript
async function scorePredictions(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<number>  // returns count of predictions scored
```

Fetches all Predictions where `matchId = X AND score IS NULL`, calls `calculateScore()` for each, bulk-updates with `prisma.prediction.update()`.

---

## scoring.ts — Pure scoring logic

No database dependencies. Pure functions.

```typescript
type MatchResult = "home" | "draw" | "away"

getResult(home: number, away: number): MatchResult
// Returns who won or if it was a draw

calculateGroupScore(
  predictedHome: number, predictedAway: number,
  actualHome: number,   actualAway: number
): 0 | 1 | 3
// 3 = exact score; 1 = correct W/D/L; 0 = wrong result

calculateKnockoutScore(predictedWinner: string, actualWinner: string): 0 | 2
// 2 = correct winner; 0 = wrong
// Used for r32, r16, qf, sf, 3p

calculateFinalScore(
  predictedHome: number, predictedAway: number,
  actual90Home: number,  actual90Away: number,
  predictedWinner: string, actualWinner: string
): 0 | 2 | 5
// 5 = correct winner + exact 90-min score
// 2 = correct winner only
// 0 = wrong winner

calculateScore(
  stage: string,
  predictedHome: number | null,
  predictedAway: number | null,
  predictedWinner: string | null,
  actual90Home: number,
  actual90Away: number,
  knockoutWinner: string | null
): number
// Main entry point used by sync when scoring predictions.
// Dispatches to the correct stage-specific function above.
```

---

## utils.ts — Formatting utilities

All output is in Swedish locale.

### Date formatting

```typescript
format(date: Date | string): string
// "15 apr 2026"  (Swedish, UTC timezone)

formatWithTime(date: Date | string): string
// "15 apr 2026, 14:30"
```

Both functions interpret dates as UTC to avoid timezone-shifted display.

### Stage labels (Swedish)

```typescript
stageLabel(stage: string): string
// "group" → "Gruppspel"
// "r32"   → "Omgång 32"  (or similar)
// "r16"   → "Åttondelsfinaler"
// "qf"    → "Kvartsfinaler"
// "sf"    → "Semifinaler"
// "3p"    → "Bronsmatch"
// "final" → "Final"
```

### Stage badge colors

```typescript
stageColor(stage: string): string
// Returns Tailwind badge class string
// "final" → "badge-gold"
// "sf"    → "badge-yellow"
// "qf"    → "badge-green"
// "r16"   → "badge-teal"
// "r32" / "group" → "badge-blue"
```

Badge classes are defined in `app/globals.css`.
