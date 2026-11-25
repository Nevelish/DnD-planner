import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

import {
  DM, PLAYER1, PLAYER2, campaignId, fetchHtml, go, login, resetDatabase, sql, startWebhookCatcher,
} from "./support";

/** "Reveal to party": the DM shares a reviewed copy of a DM notebook page
 * with the party, without giving away secrets, hidden page titles or the
 * DM's own pictures. */
test.describe.configure({ mode: "serial" });

let cid: string, notes: string, templeId: string, dmPicture: string;
let dm: Page, p1: Page;
let webhook: Awaited<ReturnType<typeof startWebhookCatcher>>;

const SECRET = "Secret: the cult still meets here at night.";
const partyCopy = () => sql(`SELECT id FROM "DmPage" WHERE "revealedFromId" = '${templeId}'`);
const contentOf = (id: string) => sql(`SELECT content FROM "DmPage" WHERE id = '${id}'`);
const dialog = (page: Page) => page.getByRole("dialog");

test.beforeAll(async ({ browser }) => {
  resetDatabase();
  cid = campaignId();
  notes = `/campaigns/${cid}/notes`;
  webhook = await startWebhookCatcher();
  sql(`UPDATE "Campaign" SET "discordWebhookUrl" = '${webhook.url}'`);
  [dm, p1] = await Promise.all([login(browser, DM), login(browser, PLAYER1)]);

  // A map in the DM's notebook.
  const buffer = await sharp({ create: { width: 600, height: 400, channels: 3, background: "#963" } }).png().toBuffer();
  const upload = await dm.context().request.post("/api/notebook-images", {
    multipart: { campaignId: cid, notebook: "mine", image: { name: "temple.png", mimeType: "image/png", buffer } },
  });
  dmPicture = (await upload.json()).url;

  // The party already knows Korvosa; the Baron's page is the DM's alone.
  sql(`INSERT INTO "DmPage" (id, "campaignId", kind, title, content, "updatedAt") VALUES
       ('korvosa', '${cid}', 'PARTY', 'Korvosa', 'The city.', now()),
       ('baron', '${cid}', 'DM', 'Baron Vex', 'Built the temple. Secretly a cultist.', now()),
       ('temple', '${cid}', 'DM', 'The Sunken Temple', $$## The Sunken Temple
Half-drowned ruins east of [[Korvosa]]. [[Baron Vex|The baron]] wants it found.
${SECRET}

![temple map](${dmPicture})
- [ ] Solve the riddle on the door$$, now())`);
  templeId = "temple";
});

test.afterAll(async () => {
  await Promise.all([dm, p1].map((page) => page?.context().close()));
  await webhook?.close();
});

test("the DM reviews the page and reveals a copy to the party", async () => {
  await go(dm, `${notes}?page=${templeId}`);
  await dm.getByRole("button", { name: "Reveal to party" }).click();
  await expect(dialog(dm).getByLabel("Title for the party")).toHaveValue("The Sunken Temple");
  await expect(dialog(dm).getByText("1 link: Baron Vex.", { exact: false })).toBeVisible(); // Korvosa is fine
  await expect(dialog(dm).getByText("1 picture will be shared with the party.")).toBeVisible();

  // Take the secret out of the party's copy.
  const text = dialog(dm).getByLabel("What the party will see");
  await text.fill((await text.inputValue()).replace(`${SECRET}\n`, ""));
  await dialog(dm).getByRole("button", { name: "Reveal to the party" }).click();
  await expect(dm.getByText("Revealed! The party can see it now.")).toBeVisible();

  const copy = contentOf(partyCopy());
  expect(sql(`SELECT kind || '|' || title FROM "DmPage" WHERE id = '${partyCopy()}'`)).toBe("PARTY|The Sunken Temple");
  expect(copy).not.toContain("cult");
  expect(copy).toContain("east of [[Korvosa]]"); // the party has that page
  expect(copy).toContain("The baron wants it found."); // the hidden page's link became text
  expect(copy).not.toContain("Baron Vex");
  expect(copy).not.toContain(dmPicture); // a party copy of the picture instead
  expect(contentOf(templeId)).toContain(SECRET); // the DM's page is untouched

  await expect(dm.getByText(/^Revealed to the party on/)).toBeVisible();
  expect(sql(`SELECT string_agg(u.email, ',' ORDER BY u.email) FROM "Notification" n JOIN "User" u ON u.id = n."recipientId" WHERE n.type = 'PAGE_REVEALED'`))
    .toBe(`${PLAYER1},${PLAYER2}`);
  await expect.poll(() => webhook.texts().some((t) => t.includes("The DM revealed “The Sunken Temple”"))).toBe(true);
});

test("players see the copy, its picture, and nothing secret", async () => {
  const copyId = partyCopy();
  await go(p1, `${notes}/party?page=${copyId}`);
  await expect(p1.getByText("Revealed by the DM on")).toBeVisible();
  await expect(p1.getByText("Half-drowned ruins east of")).toBeVisible();
  const html = await fetchHtml(p1, `${notes}/party?page=${copyId}`);
  expect(html).not.toContain("cult");
  expect(html).not.toContain("Baron Vex");

  const partyPicture = contentOf(copyId).match(/\/api\/notebook-images\/[a-z0-9]+/)![0];
  expect((await p1.context().request.get(partyPicture)).status()).toBe(200);
  expect((await p1.context().request.get(dmPicture)).status()).toBe(404); // the DM's original stays private
  await expect(p1.locator('[role="tabpanel"][data-state="active"]').getByRole("img", { name: "temple map" })).toBeVisible();
});

test("revealing again updates the party's copy, with a warning if they edited it", async () => {
  const copyId = partyCopy();
  // A player ticks the box in their copy.
  await p1.locator('[role="tabpanel"][data-state="active"]').getByRole("checkbox").click();
  await expect.poll(() => contentOf(copyId)).toContain("- [x] Solve the riddle");

  sql(`UPDATE "DmPage" SET content = content || E'\\nThe door opens at low tide.' WHERE id = '${templeId}'`);
  await go(dm, `${notes}?page=${templeId}`);
  await expect(dm.getByText("and they've edited their copy since")).toBeVisible();
  await dm.getByRole("button", { name: "Update party's copy" }).click();
  await expect(dialog(dm).getByRole("alert")).toContainText("Players have changed their copy");
  const text = dialog(dm).getByLabel("What the party will see");
  await text.fill((await text.inputValue()).replace(`${SECRET}\n`, ""));
  await dialog(dm).getByRole("button", { name: "Update the party's copy" }).click();
  await expect(dm.getByText("The party's copy is updated.")).toBeVisible();

  expect(partyCopy()).toBe(copyId); // the same page, not a second one
  expect(contentOf(copyId)).toContain("The door opens at low tide.");
  expect(contentOf(copyId)).not.toContain("cult");
  expect(sql(`SELECT count(*) FROM "DmPage" WHERE kind = 'PARTY' AND title = 'The Sunken Temple'`)).toBe("1");
  expect(sql(`SELECT count(*) FROM "Notification" WHERE type = 'PAGE_REVEALED' AND title LIKE 'The DM updated%'`)).toBe("2");
});

test("only the DM's own pages can be revealed, and only by the DM", async () => {
  // Players have no Reveal button, in their notebook or the party's.
  await go(p1, notes);
  await expect(p1.getByRole("button", { name: /Reveal to party|Update party's copy/ })).toHaveCount(0);
  await go(p1, `${notes}/party?page=korvosa`);
  await expect(p1.getByRole("button", { name: /Reveal to party|Update party's copy/ })).toHaveCount(0);

  // Session prep stays with the DM.
  const sessionId = sql(`SELECT id FROM "SessionProposal" LIMIT 1`);
  await go(dm, `/campaigns/${cid}/sessions/${sessionId}`);
  await dm.getByRole("button", { name: "Start prep" }).click();
  await dm.locator("#prep textarea").waitFor();
  const prepId = sql(`SELECT id FROM "DmPage" WHERE "sessionProposalId" = '${sessionId}'`);
  await go(dm, `${notes}?page=${prepId}`);
  await expect(dm.getByRole("button", { name: "Reveal to party" })).toHaveCount(0);
});
