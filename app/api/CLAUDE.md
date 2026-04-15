# app/api/CLAUDE.md — API Routes

All routes return JSON. Errors always include `{ error: string }`.

---

## Auth routes

### `POST /api/auth/signup`

Create a new user account.

**Auth required:** No

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "minimum6chars",
  "displayName": "Olle"
}
```

**Responses:**
- `201` — `{ id, email, displayName, createdAt }`
- `400` — missing field or password too short
- `409` — email already registered
- `500` — server error

**Flow:** Validates → bcrypt hash password (rounds=10) → `prisma.user.create` → returns user (no password field).

### `GET|POST /api/auth/[...nextauth]`

NextAuth catch-all route. Handles OAuth callbacks, session, CSRF. Do not call directly — use `signIn()` / `signOut()` from `next-auth/react` or `auth()` from `@/auth`.

---

## Group routes

### `GET /api/groups`

List the authenticated user's groups.

**Auth required:** Yes

**Response `200`:**
```json
[
  {
    "id": "clxxx",
    "name": "Kompisgruppen",
    "inviteCode": "a1b2c3d4",
    "createdBy": "clyyy",
    "createdAt": "2026-04-01T...",
    "_count": { "members": 5 }
  }
]
```

Ordered by `joinedAt` descending (most recently joined first).

---

### `POST /api/groups`

Create a new group.

**Auth required:** Yes

**Request body:**
```json
{ "name": "Kompisgruppen" }
```

**Responses:**
- `201` — `{ id, name, inviteCode, createdBy, createdAt }`
- `400` — name too short (< 2 chars) or missing
- `401` — not authenticated

**Flow:** Validate → `prisma.group.create` with 4-byte hex `inviteCode` → `prisma.groupMembership.create` to add creator as member → return group.

---

### `POST /api/groups/join`

Join an existing group via invite code.

**Auth required:** Yes

**Request body:**
```json
{ "inviteCode": "a1b2c3d4" }
```

**Responses:**
- `201` — `{ id, name, inviteCode, createdBy, createdAt }`
- `400` — missing invite code
- `401` — not authenticated
- `404` — invite code not found
- `409` — user already a member of this group

**Note:** Invite code lookup is case-insensitive.

---

## Prediction routes

### `POST /api/predictions`

Create or update a prediction. Idempotent — safe to call multiple times (upsert).

**Auth required:** Yes + must be a member of the specified group

**Request body:**
```json
{
  "matchId": "clxxx",
  "groupId": "clyyy",
  "predictedHome": 2,
  "predictedAway": 1
}
```

**Responses:**
- `200` — updated prediction object
- `400` — validation error (see below)
- `401` — not authenticated
- `403` — user is not a member of this group
- `404` — match not found

**Validation rules:**
- `matchId`, `groupId` required
- `predictedHome`, `predictedAway` must be integers 0–99
- Match status must be `"upcoming"` (locked if `"live"` or `"completed"`)

**Flow:** Auth check → validate inputs → verify group membership → find match → check status → `prisma.prediction.upsert` on `[userId, matchId, groupId]`.

---

## Sync route

### `POST /api/sync/matches`

Sync match data from API-Football and score completed-match predictions. This is the cron-facing endpoint.

**Auth required:** No session — uses bearer token instead

**Headers required:**
```
Authorization: Bearer <SYNC_SECRET>
```

**Request body:** Empty / ignored

**Responses:**
- `200` — `{ ok: true, live: N, completed: N, predictionsScored: N, bootstrapped?: N }`
- `401` — missing or wrong bearer token
- `500` — API-Football call failed or DB error

**Call frequency:** Every ~60s when matches are expected to be live; every ~5min otherwise. The endpoint is idempotent.

**What it does:** See [lib/CLAUDE.md](../../lib/CLAUDE.md) for full sync logic documentation.

---

## Common patterns

### Auth check in API routes

```typescript
import { auth } from "@/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  // ...
}
```

### Standard error responses

```typescript
// 400
return Response.json({ error: "Name is required" }, { status: 400 });

// 404
return Response.json({ error: "Group not found" }, { status: 404 });

// 409 conflict
return Response.json({ error: "Already a member" }, { status: 409 });
```
