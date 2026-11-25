import { expect, test, type Page } from "@playwright/test";

import {
  DM, PLAYER1, PLAYER2, campaignId, fetchHtml, futureDate, go, login, resetDatabase, sql, startWebhookCatcher, userId,
} from "./support";

/** Session recaps (anyone can write one once a session is played) and the
 * safety tools (lines & veils added anonymously, Session Zero answers). */
test.describe.configure({ mode: "serial" });

let cid: string, sessionUrl: string;
let dm: Page, p1: Page, p2: Page;
let webhook: Awaited<ReturnType<typeof startWebhookCatcher>>;

const recipients = (type: string) =>
  sql(`SELECT coalesce(string_agg(u.email, ',' ORDER BY u.email), '') FROM "Notification" n JOIN "User" u ON u.id = n."recipientId" WHERE n.type = '${type}'`);

test.beforeAll(async ({ browser }) => {
  resetDatabase();
  cid = campaignId();
  const sessionId = sql(`SELECT id FROM "SessionProposal" LIMIT 1`);
  sessionUrl = `/campaigns/${cid}/sessions/${sessionId}`;
  webhook = await startWebhookCatcher();
  sql(`UPDATE "Campaign" SET "discordWebhookUrl" = '${webhook.url}'`);
  // The seeded session is next week; move it into the past so it's been played.
  sql(`UPDATE "SessionProposal" SET "startsAt" = now() - interval '2 days' WHERE id = '${sessionId}'`);
  [dm, p1, p2] = await Promise.all([login(browser, DM), login(browser, PLAYER1), login(browser, PLAYER2)]);
});

test.afterAll(async () => {
  await Promise.all([dm, p1, p2].map((page) => page?.context().close()));
  await webhook?.close();
});

test.describe("recaps", () => {
  test("a player writes the recap; everyone else is told", async () => {
    await go(p1, sessionUrl);
    await p1.getByRole("button", { name: "Write the recap" }).click();
    await p1.locator("textarea").fill(
      "## Into the dungeon\n\nWe found **the Crimson Crown** and [a strange map](https://example.com).\n\n- Rin nearly died\n- The goblin king escaped",
    );
    await p1.getByRole("button", { name: "Save" }).click();
    await expect(p1.getByRole("heading", { name: "Into the dungeon" })).toBeVisible();
    await expect(p1.locator("strong", { hasText: "the Crimson Crown" })).toHaveCount(1);
    await expect(p1.getByText("Last edited by Percy Player")).toBeVisible();

    expect(recipients("RECAP_POSTED")).toBe(`${DM},${PLAYER2}`);
    expect(sql(`SELECT body FROM "Notification" WHERE type = 'RECAP_POSTED' LIMIT 1`))
      .toBe("Into the dungeon We found the Crimson Crown and a strange map. Rin nearly died The goblin king escaped");
    await expect.poll(() => webhook.texts().some((t) => t.includes("Recap posted: Session 1: Into the Dungeon"))).toBe(true);
  });

  test("a stale edit can't overwrite a newer one", async () => {
    await go(p2, sessionUrl);
    await p2.getByRole("button", { name: "Edit recap" }).click();

    await go(dm, sessionUrl);
    await dm.getByRole("button", { name: "Edit recap" }).click();
    await dm.locator("textarea").fill("## Into the dungeon\n\nDM's note: the map is fake.");
    await dm.getByRole("button", { name: "Save" }).click();
    await expect(dm.getByRole("button", { name: "Edit recap" })).toBeVisible();

    await p2.locator("textarea").fill("Player 2's version");
    await p2.getByRole("button", { name: "Save" }).click();
    await expect(p2.getByText("Someone else changed this recap")).toBeVisible();
    expect(sql(`SELECT recap LIKE '%map is fake%' FROM "SessionProposal" WHERE id = '${sessionUrl.split("/").pop()}'`)).toBe("t");
    expect(sql(`SELECT count(*) FROM "Notification" WHERE type = 'RECAP_POSTED'`)).toBe("2"); // edits don't re-notify

    // Saving again straight after a save isn't a false conflict.
    await dm.getByRole("button", { name: "Edit recap" }).click();
    await dm.locator("textarea").fill("## Into the dungeon\n\nThe map is fake. Next: the Sunken Temple.");
    await dm.getByRole("button", { name: "Save" }).click();
    await expect(dm.getByText("Next: the Sunken Temple.")).toBeVisible();
  });

  test("the latest recap shows on the overview and in the log", async () => {
    await go(p2, `/campaigns/${cid}`);
    await expect(p2.getByText("Previously on…")).toBeVisible();
    await expect(p2.getByText("Next: the Sunken Temple.")).toBeVisible();
    await go(p2, `/campaigns/${cid}/log`);
    await expect(p2.getByText("1 of 1 session has a recap")).toBeVisible();
  });

  test("upcoming sessions have no recap", async () => {
    await go(dm, `/campaigns/${cid}/sessions`);
    await dm.getByRole("button", { name: "Propose a session" }).click();
    await dm.fill("#startsAt", futureDate(20, "18:00"));
    await dm.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(dm.getByRole("dialog")).toHaveCount(0);
    const futureId = sql(`SELECT id FROM "SessionProposal" WHERE status = 'PROPOSED' LIMIT 1`);
    await go(dm, `/campaigns/${cid}/sessions/${futureId}`);
    await expect(dm.getByText("What happened this session")).toHaveCount(0);
  });
});

test.describe("safety tools", () => {
  const safety = () => `/campaigns/${cid}/safety`;

  test("lines are shared anonymously, and never sent to Discord", async () => {
    await go(p1, safety());
    await p1.getByLabel("New line").fill("Spiders");
    await p1.getByRole("button", { name: "Add line" }).click();
    await expect(p1.getByText("(added by you)")).toBeVisible();

    expect(recipients("SAFETY_TOOL_ADDED")).toBe(`${DM},${PLAYER2}`);
    expect(sql(`SELECT title || ' ' || body FROM "Notification" WHERE type = 'SAFETY_TOOL_ADDED' LIMIT 1`))
      .toBe("A new line was added “Spiders”");

    await go(p2, safety());
    await expect(p2.getByText("Spiders")).toBeVisible();
    await expect(p2.getByText("(added by you)")).toHaveCount(0);
    await expect(p2.getByRole("button", { name: 'Remove "Spiders"' })).toHaveCount(0);
    const html = await fetchHtml(p2, safety());
    expect(html.includes(userId(PLAYER1)) || html.includes("authorId")).toBe(false);
    expect(webhook.texts().some((t) => t.includes("Spiders") || t.includes("line was added"))).toBe(false);
  });

  test("the DM can remove any entry, players only their own", async () => {
    await go(p2, safety());
    await p2.getByRole("button", { name: "Veil", exact: true }).click();
    await p2.getByLabel("New veil").fill("Detailed torture");
    await p2.getByRole("button", { name: "Add veil" }).click();
    await expect(p2.getByText("(added by you)")).toBeVisible();

    await go(dm, safety());
    await expect(dm.getByRole("button", { name: /^Remove "/ })).toHaveCount(2);
    await dm.getByRole("button", { name: 'Remove "Detailed torture"' }).click();
    await expect(dm.getByText("Detailed torture")).toHaveCount(0);

    await go(p1, safety());
    await p1.getByRole("button", { name: 'Remove "Spiders"' }).click();
    await expect(p1.getByText("Spiders")).toHaveCount(0);
    expect(sql(`SELECT count(*) FROM "SafetyEntry"`)).toBe("0");
  });

  test("Session Zero: the DM fills it in, players see the answered questions", async () => {
    await go(p1, safety());
    await expect(p1.getByText("The DM hasn't filled this in yet.")).toBeVisible();

    await go(dm, safety());
    await dm.getByLabel("Tone & themes").fill("Heroic fantasy with some horror.");
    await dm.getByLabel("Stopping a scene").fill("Say \"pause\" or tap the X-card.");
    await dm.getByRole("button", { name: "Save" }).click();
    await expect(dm.getByText("Session Zero saved.")).toBeVisible();

    await go(p1, safety());
    await expect(p1.getByText("Tone & themes")).toBeVisible();
    await expect(p1.getByText("Heroic fantasy with some horror.")).toBeVisible();
    await expect(p1.getByText("Character death")).toHaveCount(0);
  });
});
