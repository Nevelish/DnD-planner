import { expect, test } from "@playwright/test";

import { DM, PLAYER1, campaignId, go, login, resetDatabase, sql, startWebhookCatcher } from "./support";

/** The reminder a day before a session, with a "previously on…" teaser from
 * the latest recap. The server looks for due reminders every two seconds in
 * the tests (REMINDER_CHECK_INTERVAL_MS in playwright.config.ts). */
test.describe.configure({ mode: "serial" });

let cid: string, dmId: string;
let webhook: Awaited<ReturnType<typeof startWebhookCatcher>>;

/** A session that starts `hoursFromNow` hours from now (negative: played). */
function addSession(id: string, title: string, hoursFromNow: number, extra: { status?: string; recap?: string } = {}) {
  const recap = extra.recap === undefined ? "NULL" : `'${extra.recap.replace(/'/g, "''")}'`;
  sql(`INSERT INTO "SessionProposal" (id, "campaignId", "proposedById", title, "startsAt", status, recap, "updatedAt")
       VALUES ('${id}', '${cid}', '${dmId}', '${title}', now() + interval '${hoursFromNow} hours', '${extra.status ?? "PROPOSED"}', ${recap}, now())`);
}

const reminderBody = (sessionId: string) =>
  sql(`SELECT body FROM "Notification" WHERE type = 'SESSION_REMINDER' AND link LIKE '%/${sessionId}' LIMIT 1`);
const reminderPost = (title: string) => webhook.texts().find((t) => t.includes(`Reminder: ${title} coming up`));

test.beforeAll(async () => {
  resetDatabase();
  cid = campaignId();
  dmId = sql(`SELECT id FROM "User" WHERE email = '${DM}'`);
  webhook = await startWebhookCatcher();
  sql(`UPDATE "Campaign" SET "discordWebhookUrl" = '${webhook.url}'`);
});

test.afterAll(async () => {
  await webhook?.close();
});

test("with no recap yet, the reminder is just the when and where", async () => {
  addSession("first", "The first game", 20);
  await expect.poll(() => reminderBody("first"), { timeout: 15_000 }).not.toBe("");
  expect(reminderBody("first")).not.toContain("Previously");
  await expect.poll(() => reminderPost("The first game"), { timeout: 10_000 }).toBeTruthy();
  expect(reminderPost("The first game")).not.toContain("Previously");
});

test("the reminder starts with the latest recap from before the session", async ({ browser }) => {
  addSession("older", "Session 1: The Road", -24 * 10, { status: "COMPLETED", recap: "An older recap about the road." });
  addSession("last", "Session 2: The Heist", -24 * 3, {
    status: "COMPLETED",
    recap: "## The heist\n\nWe robbed [[Baron Vex|the baron]] and **escaped** through the [[Sewers]].\n\n- [x] Steal the crown",
  });
  addSession("skipped", "Session 3: Cancelled", -24 * 2, { status: "CANCELLED" });
  addSession("soon", "Session 4: The Chase", 20);

  const teaser = "The heist We robbed the baron and escaped through the Sewers. Steal the crown";
  await expect.poll(() => reminderBody("soon"), { timeout: 15_000 }).toContain(`\nPreviously on…: ${teaser}`);

  // Discord: a heading that links to the recap and says which session it's from, then the teaser as a quote.
  await expect.poll(() => reminderPost("Session 4: The Chase"), { timeout: 10_000 }).toBeTruthy();
  const post = JSON.parse(reminderPost("Session 4: The Chase")!) as { embeds: { description: string }[] };
  expect(post.embeds[0].description).toMatch(
    new RegExp(`\\n\\n\\*\\*Previously on…\\*\\* \\[Session 2: The Heist\\]\\(http://localhost:\\d+/campaigns/${cid}/sessions/last\\) · <t:\\d+:D>\\n> ${teaser}$`),
  );

  // In the app, the teaser is on its own line.
  const p1 = await login(browser, PLAYER1);
  await go(p1, "/notifications");
  const body = p1.getByText(`Previously on…: ${teaser}`);
  await expect(body).toBeVisible();
  expect(await body.evaluate((el) => (el as HTMLElement).innerText.split("\n").length)).toBe(2);
  await p1.context().close();
});

test("a session with no recap is skipped for the latest one that has one", async () => {
  addSession("norecap", "Session 4b: Nobody wrote this up", -12, { status: "COMPLETED" });
  addSession("later", "Session 5: The Escape", 22);
  await expect.poll(() => reminderBody("later"), { timeout: 15_000 }).toContain("Previously on…: The heist We robbed");
});
