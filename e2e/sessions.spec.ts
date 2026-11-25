import { expect, test, type Page } from "@playwright/test";

import {
  BASE_URL, DM, PLAYER1, PLAYER2, campaignId, futureDate, go, login, resetDatabase, sql, startWebhookCatcher,
} from "./support";

/**
 * Scheduling: times in each viewer's own timezone, what reschedules and
 * confirmations notify, RSVPs, and sessions that have been played.
 */
test.describe.configure({ mode: "serial" });

let cid: string, s1: string, sessionUrl: string;
let dm: Page;
let webhook: Awaited<ReturnType<typeof startWebhookCatcher>>;

const startsAtUtc = (where: string) => sql(`SELECT to_char("startsAt", 'HH24:MI') FROM "SessionProposal" WHERE ${where}`);
const count = (type: string) => sql(`SELECT count(*) FROM "Notification" WHERE type = '${type}'`);

test.beforeAll(async ({ browser }) => {
  resetDatabase();
  cid = campaignId();
  s1 = sql(`SELECT id FROM "SessionProposal" WHERE title = 'Session 1: Into the Dungeon'`);
  sessionUrl = `/campaigns/${cid}/sessions/${s1}`;
  webhook = await startWebhookCatcher();
  sql(`UPDATE "Campaign" SET "discordWebhookUrl" = '${webhook.url}'`);
  // Session 1 at 19:00 Oslo on a winter evening (18:00 UTC).
  sql(`UPDATE "SessionProposal" SET "startsAt" = '${futureDate(1, "18:00").replace("T", " ")}+00' WHERE id = '${s1}'`);
  // Sessions that were (or are being) played.
  const dmId = sql(`SELECT id FROM "User" WHERE email = '${DM}'`);
  sql(`INSERT INTO "SessionProposal" (id, "campaignId", "proposedById", title, "startsAt", "durationMinutes", status, "updatedAt") VALUES
       ('past_confirmed', '${cid}', '${dmId}', 'Past confirmed', now() - interval '3 days', 180, 'CONFIRMED', now()),
       ('past_proposed',  '${cid}', '${dmId}', 'Past proposed',  now() - interval '2 days', 180, 'PROPOSED', now()),
       ('in_progress',    '${cid}', '${dmId}', 'In progress',    now() - interval '1 hour', 240, 'CONFIRMED', now())`);
  dm = await login(browser, DM);
});

test.afterAll(async () => {
  await dm?.context().close();
  await webhook?.close();
});

test("the browser's timezone is picked up on first visit", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: BASE_URL, timezoneId: "America/New_York" });
  const page = await context.newPage();
  await go(page, "/signin");
  await expect.poll(async () => (await context.cookies()).find((c) => c.name === "tz")?.value).toBe("America/New_York");
  await context.close();
});

test("played sessions are marked completed, and stay visible", async () => {
  await go(dm, "/dashboard");
  expect(sql(`SELECT string_agg(id || '=' || status, ',' ORDER BY id) FROM "SessionProposal" WHERE id IN ('past_confirmed', 'past_proposed', 'in_progress')`))
    .toBe("in_progress=CONFIRMED,past_confirmed=COMPLETED,past_proposed=COMPLETED");

  await go(dm, "/calendar");
  await expect.poll(() => dm.locator(".rbc-event-completed").count()).toBeGreaterThanOrEqual(1);

  sql(`UPDATE "User" SET "calendarToken" = 'e2e-calendar-token' WHERE email = '${DM}'`);
  const ics = await (await dm.context().request.get("/api/calendar/e2e-calendar-token")).text();
  expect(ics).toContain("Past confirmed");
  expect(ics).toContain("Past proposed");
});

test("editing without changes keeps the time and notifies nobody", async () => {
  await go(dm, sessionUrl);
  await expect(dm.locator('[data-slot="card-description"]').first()).toContainText("at 19:00");
  await dm.getByRole("button", { name: "Edit" }).click();
  await expect(dm.locator("#startsAt")).toHaveValue(/T19:00$/);
  await dm.getByRole("button", { name: "Save" }).click();
  await expect(dm.getByRole("dialog")).toHaveCount(0);
  expect(startsAtUtc(`id = '${s1}'`)).toBe("18:00");
  expect(count("SESSION_RESCHEDULED")).toBe("0");
});

test("a reschedule notifies the players, in the DM's timezone", async () => {
  await dm.getByRole("button", { name: "Edit" }).click();
  const date = (await dm.inputValue("#startsAt")).slice(0, 10);
  await dm.fill("#startsAt", `${date}T20:00`);
  await dm.fill("#endsAt", `${date}T23:00`);
  await dm.getByRole("button", { name: "Save" }).click();
  await expect(dm.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => startsAtUtc(`id = '${s1}'`)).toBe("19:00");
  expect(count("SESSION_RESCHEDULED")).toBe("2");
  const body = sql(`SELECT body FROM "Notification" WHERE type = 'SESSION_RESCHEDULED' LIMIT 1`);
  expect(body).toContain("at 19:00 → ");
  expect(body).toContain("at 20:00");
});

test("confirming notifies the players", async () => {
  await dm.getByRole("button", { name: "Lock it in" }).click();
  await expect.poll(() => sql(`SELECT status FROM "SessionProposal" WHERE id = '${s1}'`)).toBe("CONFIRMED");
  expect(count("SESSION_CONFIRMED")).toBe("2");
});

test("players see times in their own timezone and can RSVP", async ({ browser }) => {
  const nyc = await login(browser, PLAYER1, { timezoneId: "America/New_York" });
  await go(nyc, sessionUrl);
  await expect(nyc.locator('[data-slot="card-description"]').first()).toContainText("at 14:00");
  await go(nyc, `/campaigns/${cid}/sessions/past_confirmed`);
  await expect(nyc.getByRole("button", { name: /Yes, I'm in|Can't make it/ })).toHaveCount(0);
  await nyc.context().close();

  const p2 = await login(browser, PLAYER2);
  await go(p2, sessionUrl);
  await p2.getByRole("button", { name: "Yes, I'm in" }).click();
  await expect.poll(() => sql(
    `SELECT r.status FROM "Rsvp" r JOIN "CampaignMember" m ON m.id = r."memberId" JOIN "User" u ON u.id = m."userId"
     WHERE r."sessionProposalId" = '${s1}' AND u.email = '${PLAYER2}'`,
  )).toBe("YES");
  await p2.context().close();
});

test("a summer session is stored in UTC+2, and posted to Discord", async () => {
  await go(dm, `/campaigns/${cid}/sessions`);
  await dm.getByRole("button", { name: "Propose a session" }).click();
  await dm.fill("#title", "Summer session");
  await dm.fill("#startsAt", futureDate(15, "19:00", { month: 6 }));
  await dm.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => startsAtUtc(`title = 'Summer session'`)).toBe("17:00");
  await expect.poll(() => webhook.texts().some((text) => text.includes("Summer session"))).toBe(true);
});
