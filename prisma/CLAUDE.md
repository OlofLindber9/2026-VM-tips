# prisma/CLAUDE.md — Database & Seed

## Schema overview

File: `prisma/schema.prisma`

Provider: PostgreSQL. No migration files — schema is pushed with `npx prisma db push`.

### Models

#### User
```
id          String   @id @default(cuid())
displayName String
email       String   @unique
password    String   // bcrypt hash (bcryptjs)
createdAt   DateTime @default(now())
```

#### Team
```
id          String   @id   // 3-letter FIFA code: "BRA", "ARG", "ENG", etc.
name        String         // Swedish display name: "Brasilien", "Argentina"
group       String?        // "A"–"L"; null if not yet assigned
homeMatches Match[]  @relation("HomeTeam")
awayMatches Match[]  @relation("AwayTeam")
```
Team IDs are the primary key AND the FIFA code. Never use CUIDs here.

#### Match
```
id             String   @id @default(cuid())
homeTeamId     String
awayTeamId     String
scheduledAt    DateTime             // UTC
venue          String
city           String
country        String               // "USA" | "Canada" | "Mexico"
stage          String               // "group"|"r32"|"r16"|"qf"|"sf"|"3p"|"final"
group          String?              // "A"–"L" for group stage; null for knockouts
matchNumber    Int?                 // Official FIFA match number (1-based)
status         String @default("upcoming")  // "upcoming"|"live"|"completed"
homeScore      Int?                 // null until played
awayScore      Int?                 // null until played
minute         String?              // "45+2" — only set when live
apiFootballId  Int? @unique         // fixture id from api-football.com
predictions    Prediction[]
createdAt      DateTime @default(now())
updatedAt      DateTime @updatedAt
```

#### Group
```
id          String   @id @default(cuid())
name        String
inviteCode  String   @unique @default(cuid())   // 4-byte hex in practice
createdBy   String                               // User.id (no FK constraint)
createdAt   DateTime @default(now())
members     GroupMembership[]
predictions Prediction[]
```

#### GroupMembership
```
id       String   @id @default(cuid())
userId   String                           // User.id (no FK constraint)
groupId  String
joinedAt DateTime @default(now())
group    Group @relation(..., onDelete: Cascade)

@@unique([userId, groupId])
```
Cascade delete: when a Group is deleted, all its memberships are deleted.

#### Prediction
```
id              String   @id @default(cuid())
userId          String                         // User.id (no FK constraint — plain string)
matchId         String
groupId         String
predictedHome   Int?                           // null for knockout non-final predictions
predictedAway   Int?                           // null for knockout non-final predictions
predictedWinner String?                        // "home"|"away" — for knockout + final
score           Int?                           // null=unscored; set after match completes
createdAt       DateTime @default(now())
updatedAt       DateTime @updatedAt
match           Match    @relation(...)
group           Group    @relation(...)

@@unique([userId, matchId, groupId])           // one prediction per user per match per group
```

**Score values by stage:**
- Group: `3` (exact), `1` (correct W/D/L), `0` (wrong)
- Knockout non-final: `2` (correct winner), `0` (wrong)
- Final: `5` (correct winner + exact 90-min score), `2` (correct winner only), `0` (wrong)

**Important:** `GroupMembership` has no FK/relation to `User`. To resolve display names for group members, query `prisma.user.findMany({ where: { id: { in: memberUserIds } } })` separately.

---

## Seed file (`prisma/seed.ts`)

Run with: `npm run db:seed` (executes `npx tsx prisma/seed.ts`)

### What it does

1. Fetches live fixture data from OpenFootball:
   ```
   https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
   ```
2. Filters to group-stage matches only (knockout participants unknown pre-tournament)
3. Upserts 48 Teams with FIFA codes and Swedish names
4. **Clears all existing Matches** (`deleteMany({})`) then creates fresh ones
5. Creates ~72 group-stage Match records

### Team mapping

The seed contains `TEAM_MAP` — a Record mapping OpenFootball English team names to `{ id: string, name: string }`:
- `id` = FIFA 3-letter code (primary key)
- `name` = Swedish display name

Examples:
```typescript
"Brazil"      → { id: "BRA", name: "Brasilien" }
"Germany"     → { id: "GER", name: "Tyskland" }
"USA"         → { id: "USA", name: "USA" }
"South Korea" → { id: "KOR", name: "Sydkorea" }
```

Any team in the fixture data NOT in `TEAM_MAP` is silently skipped. Add new entries here if teams are missing.

### Venue mapping

`GROUND_MAP` maps OpenFootball ground strings to `{ venue, city, country }`:

```typescript
"Mexico City"                  → { venue: "Estadio Azteca", city: "Mexico City", country: "Mexico" }
"Dallas (Arlington)"           → { venue: "AT&T Stadium", city: "Arlington", country: "USA" }
"New York/New Jersey ..."      → { venue: "MetLife Stadium", city: "East Rutherford", country: "USA" }
// ... 14 venues total
```

If a ground string is not in `GROUND_MAP`, a fallback is used: `{ venue: ground, city: ground, country: "USA" }`.

### Date parsing

```typescript
parseMatchDate("2026-06-11", "13:00 UTC-6") → Date (UTC)
```

Parses local match time + UTC offset string into a UTC Date object. Formula: `local_time - offset = UTC`.

### Stage mapping

OpenFootball round strings → internal stage codes:
```
"Matchday X"   → "group"
"Round of 32"  → "r32"
"Round of 16"  → "r16"
"Quarter-final"→ "qf"
"Semi-final"   → "sf"
"3rd Place"    → "3p"
"Final"        → "final"
```

---

## Common database operations

### Reset everything
```bash
npx prisma db push --force-reset
npm run db:seed
```

### Inspect data
```bash
npm run db:studio   # Opens Prisma Studio at localhost:5555
```

### Schema changes
```bash
# Edit prisma/schema.prisma, then:
npm run db:push      # Push changes (drops/alters tables as needed)
npm run db:generate  # Regenerate TS client
```

### Prisma client import
```typescript
import prisma from "@/lib/prisma";  // Always use the singleton
```
