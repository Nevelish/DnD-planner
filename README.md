![DnD Planner](.github/banner.svg)

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
  (paste either into "Join campaign"), join/leave. Someone the DM removes
  stays out (no rejoining with the invite link or from Discord) until the
  DM allows them back from the Members page.
- **Sessions & RSVP**: the DM proposes a date, players respond Yes/Maybe/No.
  Backing out after saying Yes asks for a quick reason, visible to the whole
  party.
- **Where & what**: mark a session as in person or online, with an address
  or a Discord/VTT link (links are clickable), plus optional notes for the
  players. New sessions start from the last session's place, and moving a
  session (or taking it online) notifies the party. Both show up in the
  .ics feed, so they land in everyone's calendar app.
- **Date polls**: not sure which day works? The DM offers a few dates,
  players mark each Yes/Maybe/No, and the best one is highlighted. If none
  work, anyone can suggest another date (they're counted as a Yes, and
  everyone who already voted is asked about it). Picking a date proposes
  the session with everyone's RSVP pre-filled from their vote.
- **Away dates**: on the Calendar page, mark days you can't play (a holiday,
  exams), with an optional note. Everyone in your campaigns sees them on
  their calendar. The DM is warned when proposing a session or offering a
  poll date that clashes, and polls and RSVP lists show who's away instead
  of "no reply". Nothing is declined automatically.
- **Session recaps**: once a session has been played, anyone in the party
  can write up what happened (markdown). The latest one shows as "Previously
  on…" on the campaign overview, and the campaign log collects them all, so
  whoever missed a night can catch up.
- **Safety tools**: a Safety tab with lines & veils that anyone can add to,
  anonymously (nobody, not even the DM, sees who added what), and the DM's
  Session Zero answers: tone, character death, PvP, how to stop a scene,
  and so on.
- **Recurring sessions**: set a cadence (e.g. every other Saturday) and the
  app drafts the next date ahead of time for the DM to review and send.
- **Calendar**: a month view of every proposed/confirmed session across your
  campaigns, plus a private .ics subscription feed (Outlook/Google/Apple
  Calendar) that stays in sync as sessions change.
- **Roster**: each player's character (name/class/level/race), with an
  optional best-effort import from a public D&D Beyond sheet.
- **DM notebook**: as many private pages as you like (NPCs, locations, plot
  threads), with pinning, search, and templates (NPC, location, session
  prep). Each session also gets its own DM-only prep, started from the
  "Lazy DM" outline, so old prep stays next to that session's recap.
  Link pages wiki-style with `[[Page title]]` (or `[[Page title|other
  text]]`): typing `[[` suggests pages right at the cursor, naming a page
  in plain text offers to link it, links to pages that don't exist yet
  create them when clicked, each page lists what links to it (and what
  mentions it without a link), and renaming a page updates the links. Players never see any of it.
- **Notifications**: in-app bell + full history for invites, proposals,
  reschedules, confirmations, cancellations, and RSVP changes.
- **Reminders**: an in-app (and optional Discord) reminder 24 hours before
  each session, to the DM and everyone who hasn't said No, plus a
  calendar-app alert an hour before via the .ics feed. Set `TZ` (e.g.
  `Europe/Oslo`) so reminder times read in your group's timezone.
- **RSVP and vote from Discord** (optional bot): session posts in your
  Discord channel get **I'm in / Maybe / Can't make it** buttons, and the
  answers on the post stay up to date. Date polls get a **Vote** button that
  opens a private panel with two lists, "dates that work for me" and "dates
  that might work"; the poll's post shows everyone's votes and the best date
  so far, and says which date was picked. If none of the dates work,
  "Suggest another date" in the panel opens a pop-up for a date (like
  `26.12`) and a time. Backing out after a Yes asks for a reason in a
  pop-up. Someone who isn't in the campaign yet gets a link to join once
  with their Discord account; or the DM can let anyone in the channel join
  just by answering (their account takes their Discord name and picture).
  See [Discord bot](#discord-bot) below to set it up.
- **Notification settings**: each person picks which events show up in
  their bell and which ones @mention them on Discord (e.g. keep reminders,
  skip every RSVP change). Everything is on until you switch it off.
- **Player and party notebooks**: next to the DM's, every player gets a
  private notebook in each campaign (hidden from other players and the
  DM), and the party shares a notebook everyone can add to and edit. Both
  have pages, search, links, suggestions and a "Session notes" template.
  In the party notebook only a page's author or the DM can delete it.
- **Checklists and pictures in notebooks**: tick `- [ ]` items straight
  from a page or the session prep, without opening the editor. Add maps,
  handouts and NPC portraits with the picture button, or by pasting or
  dropping them into the editor. Pictures are shrunk to at most 2400 px and
  stripped of hidden metadata such as phone GPS location. They're only
  visible to whoever can see the notebook they were added to: DM-notebook
  maps stay with the DM, and party handouts go to everyone in the campaign.
  The DM's **Notes → Pictures** tab lists every picture in the DM's and party
  notebooks with the pages that use it, shows how much of the campaign's
  500 MB is used, and can delete pictures one at a time or all unused ones
  at once. Players' private pictures only show there as a total.
- **Reveal to party**: when the players discover something, the DM can
  reveal a page from the DM notebook. A copy goes into the party notebook,
  and the DM's page stays as it is. The DM reviews the text first and can
  take secrets out. Links to pages the party can't see become plain text,
  so those titles don't leak, and pictures on the page are shared with the
  party while the DM's own stay private. Everyone is notified (and it's
  posted to Discord). Revealing again later updates the party's copy, with
  a warning if the players have edited it since.
- **Profile pictures**: optional; upload one under Account and it shows next
  to your name in the nav, member lists and RSVPs. Discord sign-ins use
  the Discord picture until you upload your own; otherwise initials. Photos
  are cropped, shrunk and re-encoded on upload, which also strips hidden
  data like phone GPS tags, and they're stored in Postgres (no extra
  volume needed).
- **Account settings**: change your password (email/password accounts only).
- **Dark mode**: light/dark/system, toggle in the nav.
- **Admin panel**: the first person to ever sign in becomes admin
  automatically — no setup step or env var needed. Admins can set the
  server's public URL (so invite/calendar links don't show `localhost`
  behind a reverse proxy or tunnel), create accounts, promote/demote other
  admins, disable/re-enable accounts, and reset a forgotten password for
  any email/password account — all without needing an email server.

## Security

- Disabling an account, resetting or changing a password, or removing
  admin rights takes effect on the person's next click, not when their
  sign-in would have expired. Changing your own password signs out your
  other devices.
- Sign-in is rate limited: 5 wrong passwords for an account, or 20 from one
  IP, lock that out for 15 minutes (the counters live in memory and reset
  when the app restarts).
- Responses carry standard security headers (no framing by other sites,
  no MIME sniffing, a strict referrer policy).
- `GET /api/health` returns `{"status":"ok"}` while the app and database are
  up (503 otherwise), and the Docker image uses it as its health check, so
  TrueNAS shows the app as unhealthy if it hangs.

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

## Running on TrueNAS SCALE

On SCALE 24.10 ("Electric Eel") or newer, Apps runs on a native Docker
backend, so you can deploy via **Apps → Discover Apps → Custom App →
Install via YAML** using `docker-compose.truenas.yml` instead of
`docker-compose.yml`. The difference: it pulls a prebuilt image from GHCR
rather than building `docker/Dockerfile` locally, since the Apps YAML
importer deploys images, it doesn't build them.

1. Push to `main` (or run the "CI" workflow manually on `main`):
   `.github/workflows/ci.yml` runs the end-to-end tests and, only if they
   pass, builds and pushes the image to `ghcr.io/nevelish/dnd-planner`. A
   push whose tests fail publishes nothing. If the package ends up
   private (the default for a private repo), either make it public from the
   package's GitHub settings, or `docker login ghcr.io` on the TrueNAS host
   with a PAT that has `read:packages`.
2. Create a dataset for Postgres's data, e.g. `tank/apps/dnd-planner/pgdata`,
   so it's visible to TrueNAS's own snapshot/backup tooling instead of
   living in a Docker-managed volume.
3. Copy `docker-compose.truenas.yml`, fill in every `REPLACE_ME` (secrets,
   the dataset path, and `NEXTAUTH_URL` — your public domain, e.g. a
   Cloudflare Tunnel hostname), and paste it into the Custom App YAML editor.
4. Point your reverse proxy / tunnel at the TrueNAS host's IP on the port
   you mapped (`3000` by default).
5. Sign in once — since no admin exists yet, you become the admin
   automatically — then set the same public address in `/admin/settings` →
   Public URL, so invite and calendar links use it instead of `localhost`.

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

## Tests

End-to-end tests in `e2e/` drive a production build of the app in a real
browser (Playwright) against a real Postgres database. They cover what would
hurt most if it broke: signing in and account security, who can see and
change what (including forged requests), the scan for leaked secrets,
scheduling and RSVPs, date polls, notebooks, recaps and the safety tools.

They run on GitHub for every pull request and every push to `main`
(`.github/workflows/ci.yml`), and a new Docker image is only published once
they pass on `main`. To run them locally:

1. Create a separate, throwaway database. **The tests wipe it** before each
   test file, so never point them at real data:

   ```bash
   docker compose -f docker-compose.dev.yml exec postgres createdb -U dnd dnd_planner_e2e
   ```

2. Install a browser for Playwright (once), then build the app and run the tests:

   ```bash
   npx playwright install chromium
   ```

   ```bash
   npm run build && npm run test:e2e
   ```

The tests start the app themselves on port 3100 and expect `psql` on your
`PATH`. Set `E2E_DATABASE_URL` to use a database other than
`postgresql://dnd:dnd@localhost:5432/dnd_planner_e2e`. After a failure,
`npx playwright show-trace test-results/<test>/trace.zip` replays what the
browser saw. To use a Chromium you already have instead of Playwright's own, set
`E2E_CHROMIUM_PATH` to it.

Dependencies are kept current by Dependabot (`.github/dependabot.yml`): a
weekly pull request each for npm packages, GitHub Actions and the Docker base
image, with patch and minor updates only, each tested by CI. Major upgrades
are done by hand.

## Environment variables

See `.env.example`. `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL` are
required. `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` are optional — leave
them blank to ship with email/password only; the "Continue with Discord"
button is hidden until both are set. `DISCORD_BOT_TOKEN` and
`DISCORD_PUBLIC_KEY` switch on the Discord bot (below).

## Discord bot

Optional. It uses the same Discord application as "Continue with Discord", so
set that up first. Discord sends button clicks to the planner over the
internet, so the planner must be reachable at a public `https://` address
(the same one Discord sign-in already redirects back to).

1. In the [Discord developer portal](https://discord.com/developers/applications),
   open your application.
   - **General Information**: copy the **Public Key** into
     `DISCORD_PUBLIC_KEY`.
   - **Bot**: click **Reset Token** and copy the token into
     `DISCORD_BOT_TOKEN`. Keep it secret: it lets anyone post as your bot.
     No privileged intents are needed.
2. Restart the app with the two new variables (on TrueNAS, add them to the
   app's environment). On start it registers the `/planner` command with
   Discord.
3. Back in the portal, under **General Information**, set **Interactions
   Endpoint URL** to `https://<your planner address>/api/discord/interactions`
   and save. Discord checks the address straight away, so the app must be
   running with the new variables first.
4. As the DM, open the campaign's **Settings** on the planner and use
   **Add the bot to your server**.
5. In the Discord channel you want, type `/planner connect` and pick the
   campaign. The bot needs to know you're the DM, so your planner account must
   be linked to Discord: either you sign in with Discord, or you click
   **Connect Discord** (on your Account page, or in the campaign's settings)
   and keep signing in with email. The two email addresses don't have to match.

From then on that campaign's posts come from the bot instead of the webhook,
and session posts get RSVP buttons. Each session has one post that keeps
itself up to date: its time (shown in each reader's own timezone), whether
it's confirmed, where it is, and who's answered what. When a session is
moved, confirmed, cancelled or coming up tomorrow, the bot replies to that
post rather than starting a new one. Date polls work the same way: one post
per poll with a Vote button and live counts, dates suggested later posted as
replies, and the post closed with a link to the session once a date is picked.
Players can suggest a new date from the voting panel too: a pop-up takes the
date as typed (`26.12`, `26.12.2027`, `26 dec`; without a year, the next time
it comes around) and a start time in the group's timezone, filled in with the
poll's usual one. Connecting also switches off posts for
each RSVP, members joining or leaving, and recurring drafts, since the
session post covers those; the DM can turn any back on in Settings. Players
whose planner account is linked to Discord can answer right away. Anyone else
gets a private link to join with their Discord account once, unless the DM
turns on **Let anyone in the channel join by answering** in Settings.

## Notes on the D&D Beyond integration

D&D Beyond has no official public API. Linking a character fetches from the
same undocumented endpoint public character sheets use in the browser
(`character-service.dndbeyond.com`). This only works for **public** sheets,
is explicitly best-effort, and can break if D&D Beyond changes that service.
Manual character fields always remain editable regardless of sync status.
