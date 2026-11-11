# DnD Planner

A self-hosted D&D campaign planner: DMs run campaigns with private notes and
session prep, propose the next session date, and players RSVP (or back out
with a reason the group can see). Includes a cross-campaign calendar,
recurring session scheduling, a party roster with best-effort D&D Beyond
import, and in-app notifications.

## Features

- **Sign in** with email/password or Discord.
- **Per-campaign roles** — the same account can DM one campaign and play in
  another.
- **Campaigns**: create, invite players via a shareable link or invite code
  (paste either into "Join campaign"), join/leave.
- **Sessions & RSVP**: the DM proposes a date, players respond Yes/No. Backing
  out after saying Yes asks for a quick reason, visible to the whole party.
- **Recurring sessions**: set a cadence (e.g. every other Saturday) and the
  app drafts the next date ahead of time for the DM to review and send.
- **Calendar**: a month view of every proposed/confirmed session across your
  campaigns, plus a private .ics subscription feed (Outlook/Google/Apple
  Calendar) that stays in sync as sessions change.
- **Roster**: each player's character (name/class/level/race), with an
  optional best-effort import from a public D&D Beyond sheet.
- **DM notes & session prep**: private markdown notes, visible only to the DM.
- **Notifications**: in-app bell + full history for invites, proposals,
  cancellations, and RSVP changes.
- **Account settings**: change your password (email/password accounts only).
- **Dark mode**: light/dark/system, toggle in the nav.

## Stack

Next.js (App Router, TypeScript) + Tailwind, Prisma + PostgreSQL, Auth.js
(NextAuth v5), Docker Compose for self-hosting.

## Running with Docker Compose (recommended)

1. Copy the example environment file and fill in `NEXTAUTH_SECRET` (any long
   random string — `openssl rand -base64 32` works) and, if you want Discord
   sign-in, `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` from a
   [Discord application](https://discord.com/developers/applications):

   ```bash
   cp .env.example .env
   ```

2. Build and start the app + database:

   ```bash
   docker compose up --build
   ```

   The app runs database migrations automatically on startup and is then
   available at [http://localhost:3000](http://localhost:3000).

## Local development (without Docker for the app)

1. Start a local Postgres with Docker:

   ```bash
   cp .env.example .env
   docker compose -f docker-compose.dev.yml up -d
   ```

2. Install dependencies and apply migrations:

   ```bash
   npm install
   npx prisma migrate dev
   ```

3. (Optional) seed some demo data — a campaign with a DM and two players:

   ```bash
   npx prisma db seed
   ```

   This creates `dm@example.com` / `player1@example.com` / `player2@example.com`,
   all with password `password123`.

4. Run the dev server:

   ```bash
   npm run dev
   ```

## Environment variables

See `.env.example`. `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` are
required. `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` are optional — leave
them blank to ship with email/password only; the "Continue with Discord"
button is hidden until both are set.

## Notes on the D&D Beyond integration

D&D Beyond has no official public API. Linking a character fetches from the
same undocumented endpoint public character sheets use in the browser
(`character-service.dndbeyond.com`). This only works for **public** sheets,
is explicitly best-effort, and can break if D&D Beyond changes that service.
Manual character fields always remain editable regardless of sync status.
