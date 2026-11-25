import { expect, test, type Page } from "@playwright/test";

import { DM, PLAYER1, PLAYER2, addPlayer, campaignId, futureDate, go, login, resetDatabase, sql } from "./support";

/** Date polls: the DM offers dates, players vote or suggest their own, and
 * the picked date becomes a session with RSVPs filled in from the votes. */
test.describe.configure({ mode: "serial" });

const PLAYER3 = "player3@example.com";
let cid: string;
let dm: Page, p1: Page, p2: Page, p3: Page;

const row = (page: Page, text: string) => page.locator("li", { hasText: text });

async function vote(page: Page, date: string, choice: "Yes" | "Maybe" | "No") {
  const button = row(page, date).getByRole("button", { name: choice, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

async function openPoll(dates: string[], title?: string) {
  await go(dm, `/campaigns/${cid}/sessions`);
  await dm.getByRole("button", { name: "Find a date" }).click();
  if (title) await dm.fill("#poll-title", title);
  for (const [i, date] of dates.entries()) await dm.getByLabel(`Date option ${i + 1}`, { exact: true }).fill(date);
  await dm.getByRole("button", { name: "Send poll" }).click();
  await dm.waitForURL("**/polls/**");
  return dm.url().split("/polls/")[1];
}

async function suggest(page: Page, value: string) {
  await page.fill("#poll-new-date", value);
  await page.getByRole("button", { name: /Suggest date|Add date/ }).click();
}

test.beforeAll(async ({ browser }) => {
  resetDatabase();
  addPlayer(PLAYER3, "Aria Archer");
  cid = campaignId();
  [dm, p1, p2, p3] = await Promise.all([
    login(browser, DM),
    login(browser, PLAYER1, { timezoneId: "America/New_York" }),
    login(browser, PLAYER2),
    login(browser, PLAYER3, { viewport: { width: 390, height: 844 } }),
  ]);
});

test.afterAll(async () => {
  await Promise.all([dm, p1, p2, p3].map((page) => page?.context().close()));
});

test.describe("voting and picking a date", () => {
  let pollId: string;

  test("the DM opens a poll", async () => {
    await go(dm, `/campaigns/${cid}/sessions`);
    await dm.getByRole("button", { name: "Find a date" }).click();
    await dm.getByLabel("Date option 1", { exact: true }).fill(futureDate(3, "19:00"));
    await dm.getByRole("button", { name: "Send poll" }).click();
    await expect(dm.getByText("Offer at least two dates to choose from.")).toBeVisible();

    await dm.fill("#poll-title", "Session 2: Goblin Market");
    await dm.getByLabel("Session length").click();
    await dm.getByRole("option", { name: "4 hours" }).click();
    await dm.getByLabel("Date option 2", { exact: true }).fill(futureDate(4, "19:00"));
    await dm.getByLabel("Date option 3", { exact: true }).fill(futureDate(5, "18:00"));
    await dm.getByRole("button", { name: "Send poll" }).click();
    await dm.waitForURL("**/polls/**");
    pollId = dm.url().split("/polls/")[1];

    expect(sql(`SELECT string_agg(to_char("startsAt", 'MM-DD HH24:MI'), ',' ORDER BY "startsAt") FROM "DatePollOption" WHERE "pollId" = '${pollId}'`))
      .toBe("12-03 18:00,12-04 18:00,12-05 17:00");
    expect(sql(`SELECT "durationMinutes" FROM "DatePoll" WHERE id = '${pollId}'`)).toBe("240");
    expect(sql(`SELECT string_agg(u.email, ',' ORDER BY u.email) FROM "Notification" n JOIN "User" u ON u.id = n."recipientId" WHERE n.type = 'DATE_POLL_OPENED'`))
      .toBe(`${PLAYER1},${PLAYER2},${PLAYER3}`);
  });

  test("players vote", async () => {
    await go(p1, `/campaigns/${cid}/polls/${pollId}`);
    await expect(p1.locator("li").first()).toContainText("at 13:00"); // 19:00 Oslo, seen from New York
    await vote(p1, "3 December", "Yes");
    await vote(p1, "4 December", "Maybe");
    await vote(p1, "5 December", "No");
    await vote(p1, "5 December", "Yes"); // changed their mind
    expect(sql(`SELECT count(*) FROM "DatePollVote" v JOIN "CampaignMember" m ON m.id = v."memberId" JOIN "User" u ON u.id = m."userId" WHERE u.email = '${PLAYER1}'`))
      .toBe("3");

    await go(p2, `/campaigns/${cid}/polls/${pollId}`);
    await vote(p2, "3 December", "Maybe");
    await vote(p2, "4 December", "Yes");
    await vote(p2, "5 December", "Yes");

    await go(p3, `/campaigns/${cid}`);
    await p3.getByRole("link", { name: "Vote now" }).click();
    await p3.waitForURL("**/polls/**");
    await vote(p3, "3 December", "Yes");
    await vote(p3, "4 December", "No");
    await go(p3, `/campaigns/${cid}`);
    await expect(p3.getByText("You've answered 2 of 3 dates.")).toBeVisible();
  });

  test("the DM sees the results and picks the best date", async () => {
    // 3 Dec: 2 yes + 1 maybe. 4 Dec: 1 yes + 1 maybe. 5 Dec: 2 yes.
    await dm.reload({ waitUntil: "networkidle" });
    const best = dm.locator("li", { has: dm.getByText("Best so far") });
    await expect(best).toContainText("3 December");
    await expect(dm.getByText("3 of 3 players have voted")).toBeVisible();
    await expect(row(dm, "3 December")).toContainText("Percy Player, Aria Archer");
    await expect(dm.getByRole("button", { name: "Maybe", exact: true })).toHaveCount(0);

    await best.getByRole("button", { name: "Pick this date" }).click();
    await dm.getByRole("dialog").getByRole("button", { name: "Pick this date" }).click();
    await dm.waitForURL("**/sessions/**");
    const sessionId = dm.url().split("/sessions/")[1];

    expect(sql(`SELECT status || ':' || ("sessionProposalId" = '${sessionId}') FROM "DatePoll" WHERE id = '${pollId}'`)).toBe("DECIDED:true");
    expect(sql(`SELECT to_char("startsAt", 'MM-DD HH24:MI') || '|' || title || '|' || "durationMinutes" || '|' || status FROM "SessionProposal" WHERE id = '${sessionId}'`))
      .toBe("12-03 18:00|Session 2: Goblin Market|240|PROPOSED");
    expect(sql(`SELECT string_agg(u.name || '=' || r.status, ',' ORDER BY u.name) FROM "Rsvp" r JOIN "CampaignMember" m ON m.id = r."memberId" JOIN "User" u ON u.id = m."userId" WHERE r."sessionProposalId" = '${sessionId}'`))
      .toBe("Aria Archer=YES,Percy Player=YES,Rin Rogue=MAYBE");
    expect(sql(`SELECT count(*) FROM "Notification" WHERE title = 'Date picked for the next session'`)).toBe("3");

    await p1.reload({ waitUntil: "networkidle" });
    await expect(p1.getByRole("link", { name: "Go to session" })).toBeVisible();
    await expect(p1.getByRole("button", { name: "Maybe", exact: true })).toHaveCount(0);
  });
});

test.describe("suggesting a date", () => {
  let pollId: string, pollUrl: string;

  test("a player suggests a date when none work", async () => {
    pollId = await openPoll([futureDate(10, "19:00"), futureDate(11, "19:00")]);
    pollUrl = `/campaigns/${cid}/polls/${pollId}`;
    await go(p2, pollUrl);
    await expect(p2.getByText("None of these work?")).toBeVisible();
    await suggest(p2, futureDate(12, "18:00"));
    await expect(p2.getByText("you're marked as a Yes")).toBeVisible();

    const option = `SELECT id FROM "DatePollOption" WHERE "pollId" = '${pollId}' AND to_char("startsAt", 'MM-DD HH24:MI') = '12-12 17:00'`;
    expect(sql(`SELECT v.choice FROM "DatePollVote" v JOIN "CampaignMember" m ON m.id = v."memberId" JOIN "User" u ON u.id = m."userId" WHERE v."optionId" = (${option}) AND u.email = '${PLAYER2}'`))
      .toBe("YES");
    await expect(row(p2, "12 December").getByText("Suggested by you")).toBeVisible();
    expect(sql(`SELECT string_agg(u.email, ',' ORDER BY u.email) FROM "Notification" n JOIN "User" u ON u.id = n."recipientId" WHERE n.title = 'New date added to the poll'`))
      .toBe(DM); // nobody else has voted yet
    await expect(p2.getByRole("button", { name: /^Remove / })).toHaveCount(1);
  });

  test("others see who suggested it but can't remove it", async () => {
    await go(p1, pollUrl);
    await expect(row(p1, "12 December").getByText("Suggested by Rin Rogue")).toBeVisible();
    await expect(p1.getByRole("button", { name: /^Remove / })).toHaveCount(0);

    await suggest(p1, futureDate(12, "12:00")); // player 1 is in New York: the same moment as 18:00 in Oslo
    await expect(p1.getByText("That date is already in the poll.")).toBeVisible();
    await suggest(p1, "2024-01-01T18:00");
    await expect(p1.getByText("Pick a date in the future.")).toBeVisible();
    expect(sql(`SELECT count(*) FROM "DatePollOption" WHERE "pollId" = '${pollId}'`)).toBe("3");
  });

  test("the suggester can take it back", async () => {
    await p2.reload({ waitUntil: "networkidle" });
    await p2.getByRole("button", { name: /^Remove / }).click();
    await expect(p2.getByText("Date removed.")).toBeVisible();
    expect(sql(`SELECT count(*) FROM "DatePollOption" WHERE "pollId" = '${pollId}'`)).toBe("2");
  });
});
