import { expect, test, type Page } from "@playwright/test";

import {
  DM, PLAYER1, PLAYER2, campaignId, fetchHtml, futureDate, go, login, resetDatabase, sql, tamper,
} from "./support";

/**
 * Away dates: a player marks days they can't play, and the DM sees it when
 * proposing a session or offering dates in a poll. Only people who share a
 * campaign with them can see it.
 */
test.describe.configure({ mode: "serial" });

const day = (date: number) => futureDate(date, "00:00").slice(0, 10);
const year = Number(day(1).slice(0, 4));
const OUTSIDER = "outsider@example.com";

let cid: string;
let dm: Page, p1: Page, p2: Page;

test.beforeAll(async ({ browser }) => {
  resetDatabase();
  cid = campaignId();
  // Someone with an account who doesn't play in this campaign.
  sql(`INSERT INTO "User" (id, email, name, "passwordHash", "createdAt", "updatedAt")
       SELECT 'outsider', '${OUTSIDER}', 'Olga Outsider', "passwordHash", now(), now() FROM "User" WHERE email = '${DM}'`);
  [dm, p1, p2] = await Promise.all([login(browser, DM), login(browser, PLAYER1), login(browser, PLAYER2)]);
});

test.afterAll(async () => {
  await Promise.all([dm, p1, p2].map((page) => page?.context().close()));
});

test("a player adds away dates on the calendar page", async () => {
  await go(p2, "/calendar");
  await expect(p2.getByText("You haven't added any away dates.")).toBeVisible();

  // The last day before the first is refused.
  await p2.fill("#away-from", day(20));
  await p2.fill("#away-to", day(18));
  await p2.getByRole("button", { name: "Add", exact: true }).click();
  await expect(p2.getByText("The last day can't be before the first.")).toBeVisible();

  await p2.fill("#away-to", day(27));
  await p2.fill("#away-note", "Ski trip");
  await p2.getByRole("button", { name: "Add", exact: true }).click();
  await expect(p2.getByText("Away dates added.")).toBeVisible();

  const list = p2.getByRole("list", { name: "Your away dates" });
  await expect(list).toContainText(`20–27 December ${year}`);
  await expect(list).toContainText("Ski trip");
  expect(sql(`SELECT "startsOn" || '|' || "endsOn" || '|' || note FROM "AwayPeriod"`)).toBe(`${day(20)}|${day(27)}|Ski trip`);
});

test("only people who play together see them", async ({ browser }) => {
  expect(await fetchHtml(dm, "/calendar")).toContain("Rin Rogue away: Ski trip");
  expect(await fetchHtml(p1, "/calendar")).toContain("Rin Rogue away: Ski trip");
  const outsider = await login(browser, OUTSIDER);
  expect(await fetchHtml(outsider, "/calendar")).not.toContain("Ski trip");
  await outsider.context().close();
});

test("the DM is warned when proposing a session on an away day", async () => {
  await go(dm, `/campaigns/${cid}/sessions`);
  await dm.getByRole("button", { name: "Propose a session" }).click();
  const dialog = dm.getByRole("dialog");
  await dm.fill("#startsAt", futureDate(28, "19:00"));
  await expect(dialog.getByRole("status")).toHaveCount(0);
  await dm.fill("#startsAt", futureDate(22, "19:00"));
  await expect(dialog.getByRole("status")).toHaveText("Away that day: Rin Rogue (Ski trip)");

  // It's a warning, not a block: the DM can still propose it.
  await dm.fill("#title", "Session on an away day");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);
});

test("the session page shows who's away", async () => {
  const sessionId = sql(`SELECT id FROM "SessionProposal" WHERE title = 'Session on an away day'`);
  await go(p1, `/campaigns/${cid}/sessions/${sessionId}`);
  const rin = p1.getByRole("listitem").filter({ hasText: "Rin Rogue" });
  await expect(rin).toContainText("Away that day: Ski trip");
  await expect(rin).not.toContainText("No response yet"); // the badge says "Away" instead
  await expect(p1.getByRole("listitem").filter({ hasText: "Percy Player" })).toContainText("No response yet");
});

test("polls warn about away days, and show who's away", async () => {
  await go(dm, `/campaigns/${cid}/sessions`);
  await dm.getByRole("button", { name: "Find a date" }).click();
  await dm.getByLabel("Date option 1", { exact: true }).fill(futureDate(21, "19:00"));
  await dm.getByLabel("Date option 2", { exact: true }).fill(futureDate(29, "19:00"));
  const warnings = dm.getByRole("dialog").getByRole("status");
  await expect(warnings).toHaveText(["Away that day: Rin Rogue (Ski trip)"]);
  await dm.getByRole("button", { name: "Send poll" }).click();
  await dm.waitForURL("**/polls/**");
  const pollUrl = new URL(dm.url()).pathname;

  const awayDate = dm.locator("li", { hasText: "21 December" });
  await expect(awayDate).toContainText(/Away:\s*Rin Rogue \(Ski trip\)/);
  await expect(awayDate).not.toContainText(/No reply:[^:]*Rin Rogue/);
  await expect(dm.locator("li", { hasText: "29 December" })).toContainText(/No reply:\s*Percy Player, Rin Rogue/);

  // Once Rin answers anyway, the answer counts.
  await go(p2, pollUrl);
  await p2.locator("li", { hasText: "21 December" }).getByRole("button", { name: "Maybe", exact: true }).click();
  await dm.reload({ waitUntil: "networkidle" });
  await expect(awayDate).toContainText(/Maybe:\s*Rin Rogue/);
  await expect(awayDate).not.toContainText("Away:");
});

test("only the person themselves can remove their away dates", async () => {
  const rinPeriod = sql(`SELECT id FROM "AwayPeriod"`);
  // Player 1 adds their own, then replays its removal against Rin's.
  await go(p1, "/calendar");
  await p1.fill("#away-from", day(10));
  await p1.getByRole("button", { name: "Add", exact: true }).click();
  await expect(p1.getByText("Away dates added.")).toBeVisible();
  const ownPeriod = sql(`SELECT a.id FROM "AwayPeriod" a JOIN "User" u ON u.id = a."userId" WHERE u.email = '${PLAYER1}'`);
  expect(await tamper(p1, ownPeriod, rinPeriod, () =>
    p1.getByRole("button", { name: `Remove away dates 10 December ${year}` }).click())).toBe(true);
  await expect(p1.getByText("Those away dates were already removed.")).toBeVisible();
  expect(sql(`SELECT count(*) FROM "AwayPeriod" WHERE id = '${rinPeriod}'`)).toBe("1");

  await go(p2, "/calendar");
  await p2.getByRole("button", { name: `Remove away dates 20–27 December ${year}` }).click();
  await expect(p2.getByText("Away dates removed.")).toBeVisible();
  expect(sql(`SELECT count(*) FROM "AwayPeriod" WHERE id = '${rinPeriod}'`)).toBe("0");
});
