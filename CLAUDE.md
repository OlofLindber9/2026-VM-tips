# CLAUDE.md — 2026 VM-tips

## What this project is

**2026 VM-tips** is a multiplayer FIFA World Cup 2026 score prediction game. Users sign up, create or join groups via invite codes, and predict scores/winners for all WC 2026 matches. Predictions are scored automatically when matches complete:

**Group stage:**
- **3 points** — exact score
- **1 point** — correct result (W/D/L) but wrong score
- **0 points** — wrong result

**Knockout (non-final):** Predict the winner only (no score).
- **2 points** — correct winner
- **0 points** — wrong winner

**Final:** Predict the winner and the 90-min score.
- **5 points** — correct winner AND exact 90-min score
- **2 points** — correct winner only
- **0 points** — wrong winner

Groups have leaderboards showing total points per member. The UI is entirely in Swedish.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Prisma 5 ORM |
| Auth | NextAuth 5 (beta), JWT strategy, credentials provider |
| Styling | Tailwind CSS 3 with custom dark football theme |
| Live data | api-football.com (league 1, season 2026) |
| Seed data | openfootball/worldcup.json on GitHub |

---

## Dev commands

```bash
npm run dev          # Start Next.js dev server (localhost:3000)
npm run db:push      # Push schema changes to DB (no migration files)
npm run db:seed      # Fetch fixtures from OpenFootball and seed DB
npm run db:studio    # Open Prisma Studio GUI
npm run db:generate  # Regenerate Prisma client after schema changes
npm run build        # prisma generate + next build
```

**Reset and reseed the database:**
```bash
npx prisma db push --force-reset   # Wipe all data, re-apply schema
npm run db:seed                     # Fill with WC 2026 fixture data
```

---

## Environment variables

All required. See `.env`:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AUTH_SECRET` | NextAuth JWT signing secret |
| `API_FOOTBALL_KEY` | api-football.com API key (100 req/day free tier) |
| `SYNC_SECRET` | Bearer token protecting `POST /api/sync/matches` |

---

## Project structure

```
/
├── app/
│   ├── (app)/             # Protected pages (require auth)
│   │   ├── layout.tsx     # App shell with NavBar + pitch background
│   │   ├── dashboard/     # Overview: upcoming matches, groups, recent predictions
│   │   ├── matcher/       # Match list + detail pages
│   │   │   └── [id]/      # Match detail: PredictionForm + group tips section
│   │   └── groups/        # Group list + create/join/detail pages
│   │       └── [id]/      # Group leaderboard + invite code
│   ├── (auth)/            # Public auth pages
│   │   ├── login/         # Email/password login
│   │   └── signup/        # Registration
│   ├── api/
│   │   ├── auth/          # NextAuth handlers + custom signup
│   │   ├── groups/        # Create, list, join groups
│   │   ├── predictions/   # Create/update predictions
│   │   └── sync/matches/  # Match sync from API-Football (cron target)
│   ├── globals.css        # Tailwind base + custom component classes
│   ├── layout.tsx         # Root layout: fonts, SessionProvider, metadata
│   └── page.tsx           # Public landing page
├── components/
│   ├── NavBar.tsx              # Top nav (desktop + mobile hamburger)
│   ├── PredictionForm.tsx      # Score/winner input + group selector, locks after kick-off
│   ├── ResultsPodium.tsx       # Final score display card
│   ├── LiveRefresh.tsx         # Silent router.refresh() every 30s when match is live
│   ├── LiveMatchDetails.tsx    # Live events timeline + match statistics
│   └── TournamentCountdown.tsx # Countdown to tournament start shown on dashboard
├── lib/
│   ├── prisma.ts           # Singleton PrismaClient
│   ├── auth.ts (→ auth.ts) # See /auth.ts — NextAuth config
│   ├── api-football.ts     # Typed wrapper for api-football.com
│   ├── sync.ts             # Match sync + prediction scoring logic
│   ├── scoring.ts          # Pure scoring math (all stage types)
│   ├── mock-live.ts        # Mock live match data for UI development (USE_MOCK_LIVE=true)
│   └── utils.ts            # Date formatting (Swedish) + stage labels
├── prisma/
│   ├── schema.prisma       # DB schema — User, Team, Match, Group, GroupMembership, Prediction
│   └── seed.ts             # Fetches + seeds WC 2026 group-stage fixtures
└── auth.ts                 # NextAuth config (credentials, JWT callbacks)
```

---

## Authentication

- **Provider:** Credentials (email + bcrypt password)
- **Strategy:** JWT (stateless)
- **Session:** Contains `user.id` (CUID from DB), `user.name`, `user.email`
- **Protected routes:** All `(app)` pages check session server-side; redirect to `/login`
- **Custom pages:** `/login` for signIn, no custom signOut page
- **Signup flow:** `POST /api/auth/signup` → create user → `signIn()` → redirect `/dashboard`

---

## Data model summary

```
User ─── GroupMembership ─── Group
                │                │
                └──── Prediction ┘
                          │
                        Match ─── Team (home)
                                └── Team (away)
```

- A **User** belongs to many **Groups** via **GroupMembership**
- A **Prediction** is always scoped to both a User AND a Group (unique on `[userId, matchId, groupId]`)
- A **Match** has two **Team** relations (home/away)
- **Team** IDs are 3-letter FIFA codes (primary key), e.g. `"BRA"`, `"ARG"`
- **Group** invite codes are 4-byte hex strings (auto-generated by seed, not CUID)
- **Important:** `GroupMembership.userId` is a plain string with no FK constraint to `User`. There is no Prisma relation between `GroupMembership` and `User`. To get user display names for group members, always do a separate `prisma.user.findMany({ where: { id: { in: memberUserIds } } })` query.

---

## Match lifecycle

```
upcoming → live → completed
```

1. **upcoming**: After seed. No scores. Predictions open.
2. **live**: When `POST /api/sync/matches` detects match started. Predictions locked. `minute` field set (e.g. `"45+2"`).
3. **completed**: When sync detects finished status ("FT", "AET", "PEN"). Scores written. All predictions auto-scored.

---

## Match sync (`/api/sync/matches`)

This is the cron-facing endpoint. Call it every ~60s when matches are live, every ~5min otherwise.

**Security:** Requires `Authorization: Bearer <SYNC_SECRET>` header.

**What it does:**
1. **Bootstrap** (first run): Maps DB matches to API-Football fixture IDs by normalizing team names + fuzzy date matching (±1 day for timezone edge cases). Writes `apiFootballId` to each Match row.
2. **Fetch live + today's fixtures** from api-football.com
3. **Update** each match: status, homeScore, awayScore, minute
4. **Score predictions** for any match that just became `completed`

**Returns:** `{ ok: true, live: N, completed: N, predictionsScored: N }`

See [lib/CLAUDE.md](lib/CLAUDE.md) for implementation details.

---

## Styling system

The app uses a custom dark football pitch theme. Key colors:

| Token | Hex | Use |
|---|---|---|
| `app-midnight` | `#040d08` | Page backgrounds |
| `app-deep` | `#091a10` | Card backgrounds |
| `app-pitch` | `#2d6a4f` | Action color (buttons, active state) |
| `app-accent` | `#e8a020` | Orange gold (highlights) |
| `app-gold` | `#f5c842` | Bright gold (medals, top rank) |
| `app-ice` | `#b8f0c8` | Mint green (current user highlight) |

Custom component classes in `globals.css`: `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.glass-card`, `.badge-*`, `.input-dark`, `.select-dark`, `.page-dark`, `.gradient-text`.

Fonts: **Inter** (body) + **Barlow Condensed** (headings, weight 600–900).

---

## Important conventions

- **Swedish UI**: All user-facing strings are in Swedish. Stage names, dates, labels — all Swedish. Do not introduce English strings in the UI.
- **No migration files**: Schema changes use `prisma db push` (not `prisma migrate`). There is no `migrations/` directory.
- **Upsert predictions**: `POST /api/predictions` uses `upsert` — idempotent, safe to call multiple times.
- **Match stages**: `"group"` | `"r32"` | `"r16"` | `"qf"` | `"sf"` | `"3p"` | `"final"`
- **Date handling**: All dates stored as UTC. Display uses Swedish locale with `format()` / `formatWithTime()` from `lib/utils.ts`.
- **Path alias**: `@/` maps to the project root. Use `@/lib/...`, `@/components/...`, etc.
- **Mock live mode**: Set `USE_MOCK_LIVE=true` in `.env` to simulate a live match locally without hitting the API. Controlled via `lib/mock-live.ts`.
- **No User FK on GroupMembership**: `GroupMembership.userId` is a plain string. Never attempt `include: { user: ... }` on GroupMembership — it has no such relation. Fetch users separately.

---

## See also

- [prisma/CLAUDE.md](prisma/CLAUDE.md) — Schema details, seed logic, team/venue mappings
- [lib/CLAUDE.md](lib/CLAUDE.md) — Utility libraries: sync, scoring, api-football client, utils
- [app/api/CLAUDE.md](app/api/CLAUDE.md) — All API routes: request/response shapes, auth requirements, errors
