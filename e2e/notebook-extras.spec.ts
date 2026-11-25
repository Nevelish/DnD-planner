import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

import {
  BASE_URL, DM, PLAYER1, PLAYER2, campaignId, go, login, resetDatabase, sql,
} from "./support";

/** Checklists you can tick in a page's readable view, and pictures in
 * notebook pages (with who-can-see-them following the notebook). */
test.describe.configure({ mode: "serial" });

let cid: string, notes: string, dmPageId: string;
let dm: Page, p1: Page, p2: Page;

const contentOf = (id: string) => sql(`SELECT content FROM "DmPage" WHERE id = '${id}'`);
const activePanel = (page: Page) => page.locator('[role="tabpanel"][data-state="active"]');

const CHECKLIST = [
  "## Before the session",
  "- [ ] Find the key",
  "- [x] Meet the [[Baron]] at the docks",
  "  - [ ] Ask about the debt",
  "",
  "```",
  "- [ ] not a real box, it's code",
  "```",
].join("\n");

test.beforeAll(async ({ browser }) => {
  resetDatabase();
  cid = campaignId();
  notes = `/campaigns/${cid}/notes`;
  dmPageId = sql(`SELECT id FROM "DmPage" WHERE kind = 'DM' LIMIT 1`);
  sql(`UPDATE "DmPage" SET content = $$${CHECKLIST}$$ WHERE id = '${dmPageId}'`);
  [dm, p1, p2] = await Promise.all([login(browser, DM), login(browser, PLAYER1), login(browser, PLAYER2)]);
});

test.afterAll(async () => {
  await Promise.all([dm, p1, p2].map((page) => page?.context().close()));
});

test.describe("checklists", () => {
  test("ticking a box in the page saves it straight away", async () => {
    await go(dm, `${notes}?page=${dmPageId}`);
    const boxes = activePanel(dm).getByRole("checkbox");
    await expect(boxes).toHaveCount(3); // the one in the code block isn't a box

    await boxes.nth(0).click();
    await expect.poll(() => contentOf(dmPageId)).toContain("- [x] Find the key");
    await boxes.nth(2).click(); // nested item
    await expect.poll(() => contentOf(dmPageId)).toContain("  - [x] Ask about the debt");
    await boxes.nth(1).click(); // a line with a [[link]] on it
    await expect.poll(() => contentOf(dmPageId)).toContain("- [ ] Meet the [[Baron]] at the docks");
    expect(contentOf(dmPageId)).toContain("- [ ] not a real box, it's code");

    await dm.reload({ waitUntil: "networkidle" });
    await expect(activePanel(dm).getByRole("checkbox").nth(0)).toBeChecked();
    await expect(activePanel(dm).getByRole("checkbox").nth(1)).not.toBeChecked();
  });

  test("in the middle of an edit, a tick joins the draft instead", async () => {
    await dm.getByRole("tab", { name: "Edit", exact: true }).first().click();
    const editor = dm.locator("textarea").first();
    await editor.press("Control+End");
    await editor.pressSequentially("\nNew line, not saved yet");
    await dm.getByRole("tab", { name: "Preview", exact: true }).first().click();
    const before = contentOf(dmPageId);
    await activePanel(dm).getByRole("checkbox").nth(1).click();
    await expect(activePanel(dm).getByRole("checkbox").nth(1)).toBeChecked();
    await dm.waitForTimeout(500);
    expect(contentOf(dmPageId)).toBe(before);

    await dm.getByRole("button", { name: "Save", exact: true }).first().click();
    await expect.poll(() => contentOf(dmPageId)).toContain("- [x] Meet the [[Baron]]");
    expect(contentOf(dmPageId)).toContain("New line, not saved yet");
  });

  test("the toolbar adds a checklist", async () => {
    await dm.getByRole("tab", { name: "Edit", exact: true }).first().click();
    const editor = dm.locator("textarea").first();
    await editor.press("Control+End");
    await editor.press("Enter");
    await dm.getByRole("button", { name: "Checklist" }).first().click();
    await expect(editor).toHaveValue(/\n- \[ \] $/);
  });

  test("players tick boxes in the party notebook", async () => {
    sql(`INSERT INTO "DmPage" (id, "campaignId", kind, title, content, "updatedAt")
         VALUES ('partylist', '${cid}', 'PARTY', 'Shopping list', E'- [ ] Rope\\n- [ ] Torches', now())`);
    await go(p1, `${notes}/party?page=partylist`);
    await activePanel(p1).getByRole("checkbox").nth(1).click();
    await expect.poll(() => contentOf("partylist")).toBe("- [ ] Rope\n- [x] Torches");
  });
});

test.describe("pictures", () => {
  let dmImage: string, p1Image: string, partyImage: string;

  /** A camera photo: big, and with metadata that mustn't survive. */
  const photo = () =>
    sharp({ create: { width: 3000, height: 1500, channels: 3, background: "#7a4" } })
      .jpeg()
      .withExif({ IFD0: { Copyright: "secret location 59.9N 10.7E" } })
      .toBuffer();

  async function addPicture(page: Page, name: string) {
    await page.getByRole("tab", { name: "Edit", exact: true }).first().click();
    await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "image/jpeg", buffer: await photo() });
    const editor = page.locator("textarea").first();
    await expect(editor).toHaveValue(/!\[[^\]]*\]\(\/api\/notebook-images\/[a-z0-9]+\)/);
    const url = (await editor.inputValue()).match(/\/api\/notebook-images\/[a-z0-9]+/)![0];
    await page.getByRole("button", { name: "Save", exact: true }).first().click();
    await expect(page.getByText("Saved.").last()).toBeVisible();
    return url;
  }
  const statusFor = async (page: Page, url: string) => (await page.context().request.get(url)).status();

  test("the DM adds a map: shrunk, cleaned, and shown in the page", async () => {
    await go(dm, `${notes}?page=${dmPageId}`);
    dmImage = await addPicture(dm, "dungeon map.jpg");
    expect(contentOf(dmPageId)).toContain(`![dungeon map](${dmImage})`);

    await dm.getByRole("tab", { name: "Preview", exact: true }).first().click();
    await expect(activePanel(dm).getByRole("img", { name: "dungeon map" })).toBeVisible();

    const response = await dm.context().request.get(dmImage);
    expect(response.headers()["content-type"]).toBe("image/webp");
    const meta = await sharp(await response.body()).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 2400, 1200]);
    expect(meta.exif).toBeUndefined();
  });

  test("pictures follow their notebook: DM's, private, and party", async ({ browser }) => {
    // The DM's map: only the DM.
    expect(await statusFor(dm, dmImage)).toBe(200);
    expect(await statusFor(p1, dmImage)).toBe(404);

    // A player's private notebook: only them, not even the DM.
    await go(p1, notes);
    await p1.getByRole("button", { name: "New page" }).click();
    await p1.fill("#page-title", "Suspects");
    await p1.getByRole("button", { name: "Create page" }).click();
    await p1.waitForURL(/edit=1/);
    await p1.waitForLoadState("networkidle");
    p1Image = await addPicture(p1, "suspect.jpg");
    expect(await statusFor(p1, p1Image)).toBe(200);
    expect(await statusFor(dm, p1Image)).toBe(404);
    expect(await statusFor(p2, p1Image)).toBe(404);

    // The party notebook: everyone in the campaign, nobody else.
    await go(p2, `${notes}/party?page=partylist`);
    partyImage = await addPicture(p2, "handout.jpg");
    for (const page of [dm, p1, p2]) expect(await statusFor(page, partyImage)).toBe(200);

    sql(`INSERT INTO "User" (id, email, name, "passwordHash", "createdAt", "updatedAt")
         SELECT 'outsider', 'outsider@example.com', 'Olga Outsider', "passwordHash", now(), now() FROM "User" WHERE email = '${DM}'`);
    const outsider = await login(browser, "outsider@example.com");
    expect(await statusFor(outsider, partyImage)).toBe(404);
    await outsider.context().close();

    const anonymous = await browser.newContext({ baseURL: BASE_URL });
    expect((await anonymous.request.get(partyImage)).status()).toBe(401);
    await anonymous.close();
  });

  test("anything that isn't a picture is refused", async () => {
    const response = await p1.context().request.post("/api/notebook-images", {
      multipart: {
        campaignId: cid,
        notebook: "mine",
        image: { name: "map.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") },
      },
    });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("isn't a picture we can read");

    // And you can only add to campaigns you're in.
    sql(`INSERT INTO "Campaign" (id, name, "ownerId", "inviteCode", "updatedAt")
         SELECT 'othercampaign', 'Another table', id, 'other-invite', now() FROM "User" WHERE email = 'outsider@example.com'`);
    const elsewhere = await p1.context().request.post("/api/notebook-images", {
      multipart: { campaignId: "othercampaign", notebook: "party", image: { name: "x.jpg", mimeType: "image/jpeg", buffer: await photo() } },
    });
    expect(elsewhere.status()).toBe(403);
  });
});
