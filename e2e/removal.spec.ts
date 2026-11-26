import { expect, test, type Page } from "@playwright/test";

import {
  DM, PLAYER1, PLAYER2, campaignId, go, login, resetDatabase, sql, tamper, userId,
} from "./support";
import { CHANNEL, buttonClick, interact, startFakeDiscord } from "./discord";

/**
 * Someone the DM removes stays out until the DM allows them back: no
 * rejoining with the invite link, the Discord buttons or the Discord join
 * link. Also: accounts made from Discord get the person's Discord picture.
 */
test.describe.configure({ mode: "serial" });

const RIN_DISCORD = "300000000000000002";
let cid: string, sessionId: string;
let dm: Page, p2: Page;
let discord: Awaited<ReturnType<typeof startFakeDiscord>>;

const isMember = (email: string) =>
  sql(`SELECT count(*) FROM "CampaignMember" WHERE "campaignId" = '${cid}' AND "userId" = '${userId(email)}'`);

test.beforeAll(async ({ browser }) => {
  resetDatabase();
  cid = campaignId();
  sessionId = sql(`SELECT id FROM "SessionProposal" LIMIT 1`);
  discord = await startFakeDiscord();
  sql(`UPDATE "Campaign" SET "discordChannelId" = '${CHANNEL}', "discordAutoJoin" = true`);
  sql(`INSERT INTO "Account" (id, "userId", type, provider, "providerAccountId")
       VALUES ('acct_rin', '${userId(PLAYER2)}', 'oauth', 'discord', '${RIN_DISCORD}')`);
  [dm, p2] = await Promise.all([login(browser, DM), login(browser, PLAYER2)]);
});

test.afterAll(async () => {
  await Promise.all([dm, p2].map((page) => page?.context().close()));
  await discord?.close();
});

test("the DM removes a player, who's listed as removed", async () => {
  await go(dm, `/campaigns/${cid}/members`);
  await dm.getByRole("button", { name: "Remove Rin Rogue" }).click();
  await expect(dm.getByText("Member removed.")).toBeVisible();
  expect(isMember(PLAYER2)).toBe("0");
  await dm.reload({ waitUntil: "networkidle" });
  await expect(dm.getByRole("list", { name: "Removed players" })).toContainText("Rin Rogue");
});

test("they can't rejoin with the invite link", async () => {
  await go(p2, "/invite/demo-campaign");
  await p2.getByRole("button", { name: "Join as Player" }).click();
  await expect(p2.getByText("The DM removed you from this campaign.")).toBeVisible();
  expect(isMember(PLAYER2)).toBe("0");
});

test("or from Discord, even with auto-join on", async ({ request }) => {
  const reply = (await interact(request, buttonClick(RIN_DISCORD, `rsvp:${sessionId}:YES`))).json;
  expect(reply.data.content).toBe("The DM removed you from **Curse of the Crimson Throne**. Ask them if you'd like to rejoin.");
  expect(reply.data.components).toBeUndefined(); // no join link either
  expect(isMember(PLAYER2)).toBe("0");

  // Not even as a brand-new account made from the same Discord account.
  sql(`DELETE FROM "Account" WHERE id = 'acct_rin'`);
  const rsvp = (await interact(request, buttonClick(RIN_DISCORD, `rsvp:${sessionId}:YES`))).json;
  expect(rsvp.data.content).toContain("The DM removed you");
  expect(sql(`SELECT count(*) FROM "Account" WHERE "providerAccountId" = '${RIN_DISCORD}'`)).toBe("0");
});

test("once the DM allows them back, they can rejoin", async () => {
  sql(`INSERT INTO "Account" (id, "userId", type, provider, "providerAccountId")
       VALUES ('acct_rin', '${userId(PLAYER2)}', 'oauth', 'discord', '${RIN_DISCORD}')`);
  await go(dm, `/campaigns/${cid}/members`);
  await dm.getByRole("button", { name: "Allow Rin Rogue back" }).click();
  await expect(dm.getByText("Rin Rogue can rejoin now")).toBeVisible();

  await go(p2, "/invite/demo-campaign");
  await p2.getByRole("button", { name: "Join as Player" }).click();
  await p2.waitForURL(`**/campaigns/${cid}`);
  expect(isMember(PLAYER2)).toBe("1");
});

test("a DM can't remove players from someone else's campaign", async () => {
  sql(`INSERT INTO "User" (id, email, name, "passwordHash", "createdAt", "updatedAt")
       SELECT 'otherdm', 'otherdm@example.com', 'Other DM', "passwordHash", now(), now() FROM "User" WHERE email = '${DM}'`);
  sql(`INSERT INTO "Campaign" (id, name, "ownerId", "inviteCode", "updatedAt") VALUES ('other', 'Other table', 'otherdm', 'other-code', now())`);
  sql(`INSERT INTO "CampaignMember" (id, "campaignId", "userId", role) VALUES
       ('otherdm_m', 'other', 'otherdm', 'DM'), ('victim_m', 'other', '${userId(PLAYER1)}', 'PLAYER')`);

  const ownMember = sql(`SELECT id FROM "CampaignMember" WHERE "campaignId" = '${cid}' AND "userId" = '${userId(PLAYER1)}'`);
  await go(dm, `/campaigns/${cid}/members`);
  expect(await tamper(dm, ownMember, "victim_m", () => dm.getByRole("button", { name: "Remove Percy Player" }).click())).toBe(true);
  await expect(dm.getByText("They're not in this campaign any more.")).toBeVisible();
  expect(sql(`SELECT count(*) FROM "CampaignMember" WHERE id = 'victim_m'`)).toBe("1");
  expect(sql(`SELECT count(*) FROM "CampaignMember" WHERE id = '${ownMember}'`)).toBe("1");
});

test("accounts made from Discord get the person's Discord picture", async ({ request }) => {
  const click = buttonClick("300000000000000009", `rsvp:${sessionId}:YES`, { name: "Sam Stranger" });
  (click.member.user as Record<string, unknown>).avatar = "a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const reply = (await interact(request, click)).json;
  expect(reply.data.content).toContain("Welcome to **Curse of the Crimson Throne**!");
  const image = sql(`SELECT u.image FROM "User" u JOIN "Account" a ON a."userId" = u.id WHERE a."providerAccountId" = '300000000000000009'`);
  expect(image).toBe("https://cdn.discordapp.com/avatars/300000000000000009/a1b2c3d4e5f60718293a4b5c6d7e8f90.png?size=128");

  await go(dm, `/campaigns/${cid}/members`);
  await expect(dm.locator(`img[src="${image}"]`)).toHaveCount(1);

  // Someone's own picture is never replaced: an account with a password
  // keeps having none rather than getting the Discord one.
  const rinClick = buttonClick(RIN_DISCORD, `rsvp:${sessionId}:MAYBE`);
  (rinClick.member.user as Record<string, unknown>).avatar = "ffffffffffffffffffffffffffffffff";
  await interact(request, rinClick);
  expect(sql(`SELECT coalesce(image, '-') FROM "User" WHERE email = '${PLAYER2}'`)).toBe("-");
});
