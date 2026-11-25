import { expect, test, type Page } from "@playwright/test";

import {
  DM, PLAYER1, PLAYER2, campaignId, fetchHtml, go, login, resetDatabase, sql, tamper, userId,
} from "./support";

/**
 * Three notebooks per campaign: the DM's, each player's private one (hidden
 * even from the DM) and a shared party one. These tests are mostly about who
 * can see and change what, including through forged requests.
 */
test.describe.configure({ mode: "serial" });

let notes: string, party: string;
let dm: Page, p1: Page, p2: Page;
let dmPageId: string, p1NotesId: string, partyNotesId: string;

const P1_SECRETS = ["owes Baron Vex money", "Watch the bard"];
const DM_SECRET = "just arrived in"; // from the seeded DM page

test.beforeAll(async ({ browser }) => {
  resetDatabase();
  const cid = campaignId();
  notes = `/campaigns/${cid}/notes`;
  party = `${notes}/party`;
  dmPageId = sql(`SELECT id FROM "DmPage" WHERE kind = 'DM' AND title = 'Campaign notes'`);
  sql(`INSERT INTO "DmPage" (id, "campaignId", kind, "ownerId", "createdById", title, content, pinned, "updatedAt")
       VALUES ('p1notes', '${cid}', 'PERSONAL', '${userId(PLAYER1)}', '${userId(PLAYER1)}', 'My notes',
               E'My character secretly owes Baron Vex money.\\n\\nWatch the bard.', true, now()),
              ('partynotes', '${cid}', 'PARTY', NULL, '${userId(PLAYER2)}', 'Party notes',
               'Loot: 300gp and a strange key.', true, now())`);
  p1NotesId = "p1notes";
  partyNotesId = "partynotes";
  [dm, p1, p2] = await Promise.all([login(browser, DM), login(browser, PLAYER1), login(browser, PLAYER2)]);
});

test.afterAll(async () => {
  await Promise.all([dm, p1, p2].map((page) => page?.context().close()));
});

async function newPage(page: Page, title: string, template?: string) {
  await page.getByRole("button", { name: "New page" }).click();
  await page.fill("#page-title", title);
  if (template) await page.getByRole("button", { name: template, exact: true }).click();
  await page.getByRole("button", { name: "Create page" }).click();
  await page.waitForURL(/edit=1/);
  await page.waitForLoadState("networkidle");
  return new URL(page.url()).searchParams.get("page")!;
}

const activePanel = (page: Page) => page.locator('[role="tabpanel"][data-state="active"]');

test("everyone gets the right notebooks", async () => {
  await go(p1, notes);
  await expect(p1.getByRole("navigation", { name: "Notebooks" }).getByRole("link")).toHaveText(["My notebook", "Party notebook"]);
  await expect(p1.getByRole("navigation", { name: "Pinned" }).getByRole("link", { name: "My notes" })).toHaveCount(1);
  await expect(p1.getByText("My character secretly owes Baron Vex money.")).toHaveCount(1);
  await expect(p1.getByRole("navigation", { name: "Session prep" })).toHaveCount(0);

  await go(dm, notes);
  await expect(dm.getByRole("navigation", { name: "Notebooks" }).getByRole("link")).toHaveText(["DM notebook", "Party notebook"]);

  for (const page of [dm, p1, p2]) {
    await go(page, party);
    await expect(page.getByRole("navigation", { name: "Pinned" }).getByRole("link", { name: "Party notes" })).toHaveCount(1);
    await expect(page.getByText("Loot: 300gp and a strange key.")).toHaveCount(1);
  }
});

test("a player's own pages and links stay in their notebook", async () => {
  await go(p1, notes);
  const vexId = await newPage(p1, "Baron Vex", "NPC");
  expect(sql(`SELECT kind || '|' || "ownerId" FROM "DmPage" WHERE id = '${vexId}'`)).toBe(`PERSONAL|${userId(PLAYER1)}`);

  await go(p1, `${notes}?page=${p1NotesId}`);
  await p1.getByRole("tab", { name: "Edit", exact: true }).first().click();
  await p1.getByRole("button", { name: "Link “Baron Vex”?" }).click();
  await p1.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(p1.getByText("Saved.").last()).toBeVisible();
  await p1.getByRole("tab", { name: "Preview", exact: true }).first().click();
  await expect(activePanel(p1).getByRole("link", { name: "Baron Vex" }))
    .toHaveAttribute("href", `${notes}?page=${vexId}`);
});

test("party pages: anyone edits, links stay in the party notebook", async () => {
  await go(p1, party);
  const questId = await newPage(p1, "Quest log", "Session notes");
  expect(sql(`SELECT kind || '|' || coalesce("ownerId", '-') || '|' || "createdById" FROM "DmPage" WHERE id = '${questId}'`))
    .toBe(`PARTY|-|${userId(PLAYER1)}`);

  await go(p2, `${party}?page=${questId}`);
  await expect(p2.getByLabel("Page title")).toHaveValue("Quest log");
  await p2.getByRole("tab", { name: "Edit", exact: true }).first().click();
  const editor = p2.locator("textarea").first();
  await editor.fill("## Quests\n- Find the strange key's lock at the [[Docks]]\n- Ask about Baron Vex");
  await p2.getByRole("button", { name: "Save", exact: true }).first().click();
  await expect(p2.getByText("Saved.").last()).toBeVisible();
  expect(sql(`SELECT content LIKE '%strange key''s lock%' FROM "DmPage" WHERE id = '${questId}'`)).toBe("t");

  // [[ only suggests party pages, and nothing offers to link player 1's
  // private "Baron Vex" page.
  await editor.click();
  await p2.keyboard.press("Control+End");
  await p2.keyboard.type("\n[[");
  const suggestions = p2.getByRole("listbox", { name: "Link to a page" });
  await expect(suggestions.getByRole("option")).toHaveText(["Party notes"]);
  await p2.keyboard.press("Escape");
  await expect(p2.getByRole("button", { name: /^Link “/ })).toHaveCount(0);

  // Following a link to a missing page creates it in the party notebook.
  await p2.reload({ waitUntil: "networkidle" });
  await activePanel(p2).getByRole("button", { name: "Docks" }).click();
  await p2.waitForURL(/edit=1/);
  expect(new URL(p2.url()).pathname).toBe(party);
  expect(sql(`SELECT kind || '|' || coalesce("ownerId", '-') FROM "DmPage" WHERE title = 'Docks'`)).toBe("PARTY|-");
});

test("party pages can only be deleted by their author or the DM", async () => {
  const questId = sql(`SELECT id FROM "DmPage" WHERE title = 'Quest log'`);
  const docksId = sql(`SELECT id FROM "DmPage" WHERE title = 'Docks'`);

  await go(p2, `${party}?page=${questId}`);
  await expect(p2.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await go(dm, `${party}?page=${questId}`);
  await expect(dm.getByRole("button", { name: "Delete" })).toHaveCount(1);

  // Player 2 replays the delete of their own page against player 1's.
  await go(p2, `${party}?page=${docksId}`);
  expect(await tamper(p2, docksId, questId, () => p2.getByRole("button", { name: "Delete" }).click())).toBe(true);
  await expect(p2.getByText("Only the person who made this page, or the DM, can delete it.")).toHaveCount(1);
  expect(sql(`SELECT count(*) FROM "DmPage" WHERE id = '${questId}'`)).toBe("1");

  await go(p2, `${party}?page=${docksId}`);
  await p2.getByRole("button", { name: "Delete" }).click();
  await expect(p2.getByText("Page deleted.")).toBeVisible();
  expect(sql(`SELECT count(*) FROM "DmPage" WHERE id = '${docksId}'`)).toBe("0");
});

test("private and DM pages never reach anyone else", async () => {
  const vexId = sql(`SELECT id FROM "DmPage" WHERE title = 'Baron Vex'`);
  for (const page of [dm, p2]) {
    for (const url of [
      notes, `${notes}?page=${p1NotesId}`, `${notes}?page=${vexId}`, `${notes}?q=Baron`,
      party, `${party}?page=${p1NotesId}`, `${party}?q=Baron`,
    ]) {
      const html = await fetchHtml(page, url);
      expect(P1_SECRETS.filter((secret) => html.includes(secret)), `${url}`).toEqual([]);
    }
  }
  for (const page of [p1, p2]) {
    for (const url of [notes, `${notes}?page=${dmPageId}`, `${notes}?q=Korvosa`, `${party}?page=${dmPageId}`]) {
      expect((await fetchHtml(page, url)).includes(DM_SECRET), url).toBe(false);
    }
    await go(page, `${notes}?q=Korvosa`);
    await expect(page.getByText("0 pages match")).toHaveCount(1);
  }
  // A party page's id doesn't open it inside someone's own notebook.
  const questId = sql(`SELECT id FROM "DmPage" WHERE title = 'Quest log'`);
  expect((await fetchHtml(p1, `${notes}?page=${questId}`)).includes("strange key's lock")).toBe(false);
});

test("forged requests can't touch other people's pages", async () => {
  // Player 2 makes a page, then replays its save/rename/delete/pin with
  // player 1's (or the DM's) page id swapped in.
  await go(p2, notes);
  const ownId = await newPage(p2, "Rin's page");
  const before = sql(`SELECT title || '|' || content FROM "DmPage" WHERE id = '${p1NotesId}'`);

  await p2.locator("textarea").first().fill("HACKED BY RIN");
  expect(await tamper(p2, ownId, p1NotesId, () => p2.getByRole("button", { name: "Save", exact: true }).first().click())).toBe(true);
  const title = p2.getByLabel("Page title");
  await title.fill("HACKED TITLE");
  expect(await tamper(p2, ownId, p1NotesId, () => title.press("Enter"))).toBe(true);
  await go(p2, `${notes}?page=${ownId}`);
  expect(await tamper(p2, ownId, p1NotesId, () => p2.getByRole("button", { name: "Delete" }).click())).toBe(true);
  expect(sql(`SELECT title || '|' || content FROM "DmPage" WHERE id = '${p1NotesId}'`)).toBe(before);

  sql(`UPDATE "DmPage" SET pinned = true WHERE id = '${dmPageId}'`);
  await go(p2, notes);
  const otherId = await newPage(p2, "Rin's other page");
  expect(await tamper(p2, otherId, dmPageId, () => p2.getByRole("button", { name: "Pin", exact: true }).click())).toBe(true);
  expect(sql(`SELECT pinned FROM "DmPage" WHERE id = '${dmPageId}'`)).toBe("t");

  // A save from a private notebook can't land on a party page.
  const partyBefore = sql(`SELECT content FROM "DmPage" WHERE id = '${partyNotesId}'`);
  await go(p1, `${notes}?page=${p1NotesId}`);
  await p1.getByRole("tab", { name: "Edit", exact: true }).first().click();
  await p1.locator("textarea").first().fill("HACKED FROM A PRIVATE NOTEBOOK");
  expect(await tamper(p1, p1NotesId, partyNotesId, () => p1.getByRole("button", { name: "Save", exact: true }).first().click())).toBe(true);
  expect(sql(`SELECT content FROM "DmPage" WHERE id = '${partyNotesId}'`)).toBe(partyBefore);

  // The DM can't delete a player's private page either.
  const vexId = sql(`SELECT id FROM "DmPage" WHERE title = 'Baron Vex'`);
  await go(dm, `${notes}?page=${dmPageId}`);
  expect(await tamper(dm, dmPageId, vexId, () => dm.getByRole("button", { name: "Delete" }).click())).toBe(true);
  expect(sql(`SELECT count(*) FROM "DmPage" WHERE id IN ('${vexId}', '${dmPageId}')`)).toBe("2");
});

test("session prep only links to the DM's own pages", async () => {
  const sessionId = sql(`SELECT id FROM "SessionProposal" LIMIT 1`);
  await go(dm, `/campaigns/${campaignId()}/sessions/${sessionId}`);
  await dm.getByRole("button", { name: /Start prep|Edit prep/ }).click();
  await dm.locator("#prep textarea").fill("Ask [[");
  await expect(dm.locator("#prep").getByRole("option")).toHaveText(["Campaign notes"]);
});
