import { expect, test, type Page } from "@playwright/test";

import {
  BASE_URL, DM, PASSWORD, PLAYER1, campaignId, futureDate, go, login, resetDatabase, sql, userId,
} from "./support";
import {
  CHANNEL, buttonClick, connectCommand, interact, modalSubmit, startFakeDiscord,
} from "./discord";

/**
 * The Discord bot: a DM connects a channel, session posts get RSVP buttons,
 * and players answer from Discord. Discord itself is faked: the tests sign
 * interactions with a test key, and a local server stands in for Discord's
 * API and records what the bot posts.
 */
test.describe.configure({ mode: "serial" });

const DM_DISCORD = "100000000000000001";
const P1_DISCORD = "100000000000000002";
const NEWBIE_DISCORD = "100000000000000003";
const OTHER_DISCORD = "100000000000000004";
const STRANGER_DISCORD = "100000000000000005";

let cid: string, sessionId: string;
let dm: Page;
let discord: Awaited<ReturnType<typeof startFakeDiscord>>;

const linkDiscord = (email: string, discordId: string) =>
  sql(`INSERT INTO "Account" (id, "userId", type, provider, "providerAccountId")
       VALUES ('acct_${discordId}', '${userId(email)}', 'oauth', 'discord', '${discordId}')`);

/** Makes an account with the seeded password that isn't in the campaign. */
const addOutsider = (email: string, name: string) =>
  sql(`INSERT INTO "User" (id, email, name, "passwordHash", "createdAt", "updatedAt")
       SELECT 'u_' || md5('${email}'), '${email}', '${name}', "passwordHash", now(), now() FROM "User" WHERE email = '${DM}'`);

const rsvpOf = (email: string) =>
  sql(`SELECT r.status || '|' || coalesce(r."cancellationReason", '') FROM "Rsvp" r
       JOIN "CampaignMember" m ON m.id = r."memberId" JOIN "User" u ON u.id = m."userId"
       WHERE r."sessionProposalId" = '${sessionId}' AND u.email = '${email}'`);

const posts = () => discord.requests.filter((r) => r.method === "POST" && r.path === `/channels/${CHANNEL}/messages`);
const edits = () => discord.requests.filter((r) => r.method === "PATCH" && r.path.startsWith(`/channels/${CHANNEL}/messages/`));
const lastEditFields = () => JSON.stringify((edits().at(-1)?.body?.embeds as { fields: unknown }[] | undefined)?.[0]?.fields ?? []);
const lastEditEmbed = () => JSON.stringify((edits().at(-1)?.body?.embeds as unknown[] | undefined)?.[0] ?? {});
/** Posts that reply to the session's own post. */
const replies = () => posts().filter((r) => r.body?.message_reference);
const originalMessageId = () => sql(`SELECT "messageId" FROM "DiscordSessionMessage" WHERE "sessionProposalId" = '${sessionId}'`);

/** The content of a private reply, and the URL on its link button, if any. */
function reply(json: { type: number; data: { content: string; flags: number; components?: { components: { url?: string }[] }[] } }) {
  expect(json.type).toBe(4);
  expect(json.data.flags).toBe(64); // only the person who clicked sees it
  return { content: json.data.content, url: json.data.components?.[0]?.components?.[0]?.url };
}

test.beforeAll(async ({ browser }) => {
  resetDatabase();
  cid = campaignId();
  discord = await startFakeDiscord();
  linkDiscord(DM, DM_DISCORD);
  linkDiscord(PLAYER1, P1_DISCORD);
  dm = await login(browser, DM);
});

test.afterAll(async () => {
  await dm?.context().close();
  await discord?.close();
});

test("the settings show a DM without a linked Discord account how to link it", async () => {
  sql(`DELETE FROM "Account" WHERE "providerAccountId" = '${DM_DISCORD}'`);
  await go(dm, `/campaigns/${cid}/settings`);
  await expect(dm.getByText("Connect your Discord account, so the bot knows it's you.")).toBeVisible();
  await expect(dm.getByRole("button", { name: "Connect Discord" })).toBeVisible();

  linkDiscord(DM, DM_DISCORD);
  await dm.reload({ waitUntil: "networkidle" });
  await expect(dm.getByText("type /planner connect and pick this campaign")).toBeVisible();
  await expect(dm.getByRole("button", { name: "Connect Discord" })).toHaveCount(0);
});

test("only requests signed by Discord are accepted", async ({ request }) => {
  expect((await interact(request, { type: 1 }, { signed: false })).status).toBe(401);
  const unsigned = await request.post(`${BASE_URL}/api/discord/interactions`, { data: { type: 1 } });
  expect(unsigned.status()).toBe(401);
  const ping = await interact(request, { type: 1 });
  expect(ping).toEqual({ status: 200, json: { type: 1 } });
});

test("only the campaign's DM can connect it to a channel", async ({ request }) => {
  const stranger = reply((await interact(request, connectCommand(STRANGER_DISCORD))).json);
  expect(stranger.content).toContain("I don't know who you are");
  expect(stranger.content).toContain("click **Connect Discord**");
  expect(reply((await interact(request, connectCommand(P1_DISCORD))).json).content).toContain("you're not the DM of any campaign");

  const offer = (await interact(request, connectCommand(DM_DISCORD))).json;
  expect(reply(offer).content).toContain("Which campaign");
  expect(JSON.stringify(offer.data.components)).toContain(`connect:${cid}`);

  // A player pressing the DM's button (or forging the click) gets nowhere.
  const forged = (await interact(request, buttonClick(P1_DISCORD, `connect:${cid}`))).json;
  expect(forged).toMatchObject({ type: 7, data: { content: "Only the campaign's DM can do that." } });
  expect(sql(`SELECT coalesce("discordChannelId", '-') FROM "Campaign"`)).toBe("-");

  const done = (await interact(request, buttonClick(DM_DISCORD, `connect:${cid}`))).json;
  expect(done.type).toBe(7);
  expect(done.data.content).toContain("Done!");
  expect(sql(`SELECT "discordChannelId" FROM "Campaign"`)).toBe(CHANNEL);
  // Quieter defaults: answers show on the session post instead.
  const events = sql(`SELECT "discordWebhookEvents" FROM "Campaign"`);
  expect(events).toContain("SESSION_PROPOSED");
  for (const quiet of ["RSVP_CHANGED", "MEMBER_JOINED", "MEMBER_LEFT"]) expect(events).not.toContain(quiet);
});

test("session posts come from the bot, with RSVP buttons", async () => {
  await go(dm, `/campaigns/${cid}/sessions`);
  await dm.getByRole("button", { name: "Propose a session" }).click();
  await dm.fill("#title", "Session 2: Into the Woods");
  await dm.fill("#startsAt", futureDate(3, "19:00"));
  await dm.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(dm.getByRole("dialog")).toHaveCount(0);
  sessionId = sql(`SELECT id FROM "SessionProposal" WHERE title = 'Session 2: Into the Woods'`);

  await expect.poll(() => posts().length).toBe(1);
  const post = posts()[0].body!;
  expect(JSON.stringify(post.embeds)).toContain("Session 2: Into the Woods");
  const buttons = JSON.stringify(post.components);
  for (const status of ["YES", "MAYBE", "NO"]) expect(buttons).toContain(`rsvp:${sessionId}:${status}`);
  expect(JSON.stringify(post.embeds)).toContain("No reply yet (2)");
  // A card for the session, under what was announced, with the time in a
  // Discord timestamp (shown in each reader's own timezone).
  const embed = (post.embeds as { author: { name: string }; title: string; description: string }[])[0];
  expect(embed.author.name).toBe("New session proposed");
  expect(embed.title).toBe("Session 2: Into the Woods");
  expect(embed.description).toMatch(/^<t:\d+:F> \(<t:\d+:R>\)\nProposed: answer below/);
  await expect.poll(() => sql(`SELECT count(*) FROM "DiscordSessionMessage" WHERE "sessionProposalId" = '${sessionId}'`)).toBe("1");
});

test("a linked player answers from Discord, and the post updates", async ({ request }) => {
  const answer = reply((await interact(request, buttonClick(P1_DISCORD, `rsvp:${sessionId}:YES`))).json);
  expect(answer.content).toContain("You're down as **I'm in** for **Session 2: Into the Woods**");
  expect(rsvpOf(PLAYER1)).toBe("YES|");
  await expect.poll(lastEditFields).toContain('"name":"Going (1)","value":"Percy Player"');
  expect(posts()).toHaveLength(1); // no separate "Percy RSVP'd Yes" post
});

test("backing out after a Yes asks for a reason", async ({ request }) => {
  const modal = (await interact(request, buttonClick(P1_DISCORD, `rsvp:${sessionId}:NO`))).json;
  expect(modal.type).toBe(9);
  expect(modal.data.custom_id).toBe(`reason:${sessionId}`);
  expect(rsvpOf(PLAYER1)).toBe("YES|"); // nothing saved until they say why

  const done = reply((await interact(request, modalSubmit(P1_DISCORD, `reason:${sessionId}`, "Work trip, sorry"))).json);
  expect(done.content).toContain("Can't make it");
  expect(rsvpOf(PLAYER1)).toBe("NO|Work trip, sorry");
  await expect.poll(lastEditFields).toContain('"name":"Can\'t make it (1)","value":"Percy Player"');
});

test("moving and confirming the session reply to its post, and update it", async () => {
  const originalId = originalMessageId();
  const startsAt = () => sql(`SELECT extract(epoch FROM "startsAt")::bigint FROM "SessionProposal" WHERE id = '${sessionId}'`);

  await go(dm, `/campaigns/${cid}/sessions/${sessionId}`);
  await dm.getByRole("button", { name: "Edit" }).click();
  await dm.fill("#startsAt", futureDate(4, "19:00"));
  await dm.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expect(dm.getByRole("dialog")).toHaveCount(0);

  await expect.poll(() => replies().length).toBe(1);
  const moved = replies()[0].body!;
  expect((moved.message_reference as { message_id: string }).message_id).toBe(originalId);
  expect(JSON.stringify(moved.embeds)).toContain("Session time changed");
  expect(moved.components).toBeUndefined(); // the buttons stay on the original
  await expect.poll(lastEditEmbed).toContain(`<t:${startsAt()}:F>`); // the original shows the new time

  await dm.getByRole("button", { name: "Lock it in" }).click();
  await expect.poll(() => replies().length).toBe(2);
  expect(JSON.stringify(replies()[1].body!.embeds)).toContain("Session confirmed");
  await expect.poll(lastEditEmbed).toContain("**Confirmed**: it's on!");
  expect(posts()).toHaveLength(3); // the original and two replies, nothing else
});

test.describe("someone who isn't in the campaign", () => {
  let joinUrl: string;

  test("gets a link to join with Discord", async ({ request }) => {
    const answer = reply((await interact(request, buttonClick(NEWBIE_DISCORD, `rsvp:${sessionId}:YES`))).json);
    expect(answer.content).toContain("You're not in **Curse of the Crimson Throne** on the planner yet");
    expect(answer.url).toContain("/discord/join?token=");
    joinUrl = new URL(answer.url!).pathname + new URL(answer.url!).search;
  });

  test("a signed-out visitor is asked to continue with Discord", async ({ browser }) => {
    const page = await (await browser.newContext({ baseURL: BASE_URL })).newPage();
    await go(page, joinUrl);
    await expect(page.getByText("Join Curse of the Crimson Throne")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue with Discord" })).toBeVisible();
    // The same link with one character of its signature changed.
    await go(page, joinUrl.slice(0, -1) + (joinUrl.endsWith("A") ? "B" : "A"));
    await expect(page.getByText("This link has expired")).toBeVisible();
    await page.context().close();
  });

  test("the link only works for the Discord account that clicked", async ({ browser }) => {
    addOutsider("other@example.com", "Otto Other");
    linkDiscord("other@example.com", OTHER_DISCORD);
    const other = await login(browser, "other@example.com");
    await go(other, joinUrl);
    await expect(other.getByText("That's a different Discord account")).toBeVisible();
    await other.context().close();
  });

  test("once signed in with that Discord account, they join and the answer is saved", async ({ browser }) => {
    // As if they'd just signed in with Discord for the first time.
    addOutsider("newbie@example.com", "Nina Newbie");
    linkDiscord("newbie@example.com", NEWBIE_DISCORD);
    const newbie = await login(browser, "newbie@example.com", { password: PASSWORD });
    await go(newbie, joinUrl);
    await expect(newbie.getByText("Your answer: I'm in")).toBeVisible();
    await newbie.getByRole("button", { name: "Join and save my answer" }).click();
    await newbie.waitForURL(`**/sessions/${sessionId}`);
    expect(rsvpOf("newbie@example.com")).toBe("YES|");
    expect(sql(`SELECT role FROM "CampaignMember" WHERE "userId" = '${userId("newbie@example.com")}'`)).toBe("PLAYER");

    // From now on the buttons just work for them.
    const again = reply((await interact(newbie.context().request, buttonClick(NEWBIE_DISCORD, `rsvp:${sessionId}:MAYBE`))).json);
    expect(again.content).toContain("You're down as **Maybe**");
    await newbie.context().close();
  });
});

test("with auto-join on, anyone in the channel joins by answering", async ({ request }) => {
  await go(dm, `/campaigns/${cid}/settings`);
  await expect(dm.getByText("Posting in #game-night")).toBeVisible();
  await dm.getByLabel("Let anyone in the channel join by answering").check();
  await expect.poll(() => sql(`SELECT "discordAutoJoin" FROM "Campaign"`)).toBe("t");

  // Not from another channel, though.
  const elsewhere = reply((await interact(request, buttonClick(STRANGER_DISCORD, `rsvp:${sessionId}:YES`, { channel: "900000000000000099" }))).json);
  expect(elsewhere.url).toContain("/discord/join?token=");
  expect(sql(`SELECT count(*) FROM "Account" WHERE "providerAccountId" = '${STRANGER_DISCORD}'`)).toBe("0");

  const welcome = reply((await interact(request, buttonClick(STRANGER_DISCORD, `rsvp:${sessionId}:YES`, { name: "Sam Stranger" }))).json);
  expect(welcome.content).toContain("Welcome to **Curse of the Crimson Throne**! You're down as **I'm in**");
  const created = sql(`SELECT u.name || '|' || m.role FROM "Account" a JOIN "User" u ON u.id = a."userId"
                       JOIN "CampaignMember" m ON m."userId" = u.id WHERE a."providerAccountId" = '${STRANGER_DISCORD}'`);
  expect(created).toBe("Sam Stranger|PLAYER");
  expect(sql(`SELECT count(*) FROM "Notification" WHERE type = 'MEMBER_JOINED' AND title LIKE 'Sam Stranger joined%'`)).toBe("1");
});

test("cancelling the session takes the buttons off its post", async () => {
  await go(dm, `/campaigns/${cid}/sessions/${sessionId}`);
  await dm.getByRole("button", { name: "Cancel session" }).click();
  await dm.getByRole("dialog").getByRole("button", { name: "Cancel session" }).click();
  await expect(dm.getByRole("dialog")).toHaveCount(0);
  await expect.poll(() => JSON.stringify(edits().at(-1)?.body?.components)).toBe("[]");
  expect(lastEditEmbed()).toContain("**Cancelled**");
  await expect.poll(() => JSON.stringify(replies().at(-1)?.body?.embeds)).toContain("Session cancelled");
});

test("disconnecting hands posting back to the webhook", async () => {
  await go(dm, `/campaigns/${cid}/settings`);
  await dm.getByRole("button", { name: "Disconnect" }).click();
  await expect(dm.getByText("Disconnected from Discord.")).toBeVisible();
  expect(sql(`SELECT coalesce("discordChannelId", '-') FROM "Campaign"`)).toBe("-");
});
