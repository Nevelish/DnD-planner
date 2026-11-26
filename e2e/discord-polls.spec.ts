import { expect, test, type Page } from "@playwright/test";

import {
  DM, PLAYER1, PLAYER2, campaignId, futureDate, go, login, resetDatabase, sql, userId,
} from "./support";
import { CHANNEL, buttonClick, interact, listChange, modalSubmitValues, startFakeDiscord } from "./discord";

/**
 * Voting on date polls from Discord: the bot posts the poll with a Vote
 * button, players vote in a private panel with two lists, and the post keeps
 * count. Discord is faked as in discord-bot.spec.ts.
 */
test.describe.configure({ mode: "serial" });

const DM_DISCORD = "200000000000000001";
const P1_DISCORD = "200000000000000002";
const NEWBIE_DISCORD = "200000000000000003";
const STRANGER_DISCORD = "200000000000000004";

let cid: string, pollId: string, options: string[];
let dm: Page;
let discord: Awaited<ReturnType<typeof startFakeDiscord>>;

const linkDiscord = (email: string, discordId: string) =>
  sql(`INSERT INTO "Account" (id, "userId", type, provider, "providerAccountId")
       VALUES ('acct_${discordId}', '${userId(email)}', 'oauth', 'discord', '${discordId}')`);

const votesOf = (email: string) =>
  sql(`SELECT string_agg(v.choice::text, ',' ORDER BY o."startsAt") FROM "DatePollVote" v
       JOIN "DatePollOption" o ON o.id = v."optionId" JOIN "CampaignMember" m ON m.id = v."memberId"
       JOIN "User" u ON u.id = m."userId" WHERE o."pollId" = '${pollId}' AND u.email = '${email}'`);

const posts = () => discord.requests.filter((r) => r.method === "POST" && r.path === `/channels/${CHANNEL}/messages`);
const pollMessageId = () => sql(`SELECT "messageId" FROM "DiscordPollMessage" WHERE "pollId" = '${pollId}'`);
const lastPollEdit = () => {
  const edit = discord.requests.filter((r) => r.method === "PATCH" && r.path.endsWith(`/messages/${pollMessageId()}`)).at(-1);
  return { text: JSON.stringify(edit?.body?.embeds ?? []), components: JSON.stringify(edit?.body?.components ?? []) };
};

type Panel = { type: number; data: { content: string; flags?: number; components: { components: { custom_id: string; options: { value: string; default: boolean }[] }[] }[] } };

test.beforeAll(async ({ browser }) => {
  resetDatabase();
  cid = campaignId();
  discord = await startFakeDiscord();
  linkDiscord(DM, DM_DISCORD);
  linkDiscord(PLAYER1, P1_DISCORD);
  sql(`UPDATE "Campaign" SET "discordChannelId" = '${CHANNEL}'`);
  dm = await login(browser, DM);
});

test.afterAll(async () => {
  await dm?.context().close();
  await discord?.close();
});

test("a new poll is posted with a Vote button", async () => {
  await go(dm, `/campaigns/${cid}/sessions`);
  await dm.getByRole("button", { name: "Find a date" }).click();
  await dm.fill("#poll-title", "Session 3: The Heist");
  await dm.getByLabel("Date option 1", { exact: true }).fill(futureDate(3, "19:00"));
  await dm.getByLabel("Date option 2", { exact: true }).fill(futureDate(4, "19:00"));
  await dm.getByLabel("Date option 3", { exact: true }).fill(futureDate(5, "19:00"));
  await dm.getByRole("button", { name: "Send poll" }).click();
  await dm.waitForURL("**/polls/**");
  pollId = dm.url().split("/polls/")[1];
  options = sql(`SELECT string_agg(id, ',' ORDER BY "startsAt") FROM "DatePollOption" WHERE "pollId" = '${pollId}'`).split(",");

  await expect.poll(() => posts().length).toBe(1);
  const post = posts()[0].body!;
  const embed = JSON.stringify(post.embeds);
  expect(embed).toContain("Session 3: The Heist");
  expect(embed).toMatch(/\*\*1\.\*\* <t:\d+:F>/);
  expect(embed).toContain("No reply: Percy Player, Rin Rogue");
  expect(JSON.stringify(post.components)).toContain(`pollvote:${pollId}`);
  await expect.poll(() => sql(`SELECT count(*) FROM "DiscordPollMessage" WHERE "pollId" = '${pollId}'`)).toBe("1");
});

test("players vote in a private panel with two lists", async ({ request }) => {
  const panel = (await interact(request, buttonClick(P1_DISCORD, `pollvote:${pollId}`))).json as Panel;
  expect(panel.type).toBe(4);
  expect(panel.data.flags).toBe(64);
  expect(panel.data.content).toContain("not answered");
  const lists = panel.data.components.map((row) => row.components[0]);
  expect(lists.map((l) => l.custom_id)).toEqual([`pollyes:${pollId}`, `pollmaybe:${pollId}`, `pollsuggest:${pollId}`]);
  expect(lists[0].options.map((o) => o.value)).toEqual(options);

  // "Dates that work": the first two. The third, in neither list, is a No.
  let update = (await interact(request, listChange(P1_DISCORD, `pollyes:${pollId}`, [options[0], options[1]]))).json as Panel;
  expect(update.type).toBe(7); // the panel updates in place
  expect(update.data.content).toContain("Saved.");
  expect(votesOf(PLAYER1)).toBe("YES,YES,NO");
  expect(update.data.components[0].components[0].options.map((o) => o.default)).toEqual([true, true, false]);

  // "Might work": the third. The first two stay Yes.
  await interact(request, listChange(P1_DISCORD, `pollmaybe:${pollId}`, [options[2]]));
  expect(votesOf(PLAYER1)).toBe("YES,YES,MAYBE");

  // Dropping a date from "works for me" makes it a No; the Maybe stays.
  update = (await interact(request, listChange(P1_DISCORD, `pollyes:${pollId}`, [options[0]]))).json as Panel;
  expect(votesOf(PLAYER1)).toBe("YES,NO,MAYBE");
  expect(update.data.components[1].components[0].options.map((o) => o.default)).toEqual([false, false, true]);

  await expect.poll(() => lastPollEdit().text).toContain("Yes 1: Percy Player");
  expect(lastPollEdit().text).toContain("Best so far");
  expect(posts()).toHaveLength(1); // votes update the post, they don't add to the channel
});

test("the DM is pointed to the planner to pick a date", async ({ request }) => {
  const reply = (await interact(request, buttonClick(DM_DISCORD, `pollvote:${pollId}`))).json;
  expect(reply.data.content).toContain("You're the DM of this one");
});

test("someone not in the campaign gets a link to join and vote", async ({ browser, request }) => {
  const reply = (await interact(request, buttonClick(NEWBIE_DISCORD, `pollvote:${pollId}`))).json;
  expect(reply.data.content).toContain("Join once with your Discord account and you can vote on the dates");
  const url = new URL(reply.data.components[0].components[0].url);

  sql(`INSERT INTO "User" (id, email, name, "passwordHash", "createdAt", "updatedAt")
       SELECT 'newbie', 'newbie@example.com', 'Nina Newbie', "passwordHash", now(), now() FROM "User" WHERE email = '${DM}'`);
  linkDiscord("newbie@example.com", NEWBIE_DISCORD);
  const newbie = await login(browser, "newbie@example.com");
  await go(newbie, url.pathname + url.search);
  await newbie.getByRole("button", { name: "Join and vote" }).click();
  await newbie.waitForURL(`**/polls/${pollId}`);
  expect(sql(`SELECT role FROM "CampaignMember" WHERE "userId" = 'newbie'`)).toBe("PLAYER");

  // Now the Vote button opens the panel for them too.
  const panel = (await interact(request, buttonClick(NEWBIE_DISCORD, `pollvote:${pollId}`))).json as Panel;
  expect(panel.data.components).toHaveLength(3); // two lists, and "Suggest another date"
  await newbie.context().close();
});

test("with auto-join on, clicking Vote joins and opens the panel", async ({ request }) => {
  sql(`UPDATE "Campaign" SET "discordAutoJoin" = true`);
  const panel = (await interact(request, buttonClick(STRANGER_DISCORD, `pollvote:${pollId}`, { name: "Sam Stranger" }))).json as Panel;
  expect(panel.data.content).toContain("Welcome to **Curse of the Crimson Throne**!");
  expect(panel.data.components).toHaveLength(3); // two lists, and "Suggest another date"
  sql(`UPDATE "Campaign" SET "discordAutoJoin" = false`);
});

test("votes on the site and new dates show on the post", async ({ browser }) => {
  const rin = await login(browser, PLAYER2);
  await go(rin, `/campaigns/${cid}/polls/${pollId}`);
  await rin.locator("li", { hasText: "3 December" }).getByRole("button", { name: "Yes", exact: true }).click();
  await expect.poll(() => lastPollEdit().text).toContain("Yes 2: Percy Player, Rin Rogue");

  // A suggested date is a reply to the poll's post, which grows a 4th date.
  await rin.fill("#poll-new-date", futureDate(6, "19:00"));
  await rin.getByRole("button", { name: /Suggest date|Add date/ }).click();
  await expect(rin.getByText("you're marked as a Yes")).toBeVisible();
  await expect.poll(() => posts().filter((p) => p.body?.message_reference).length).toBe(1);
  const reply = posts().find((p) => p.body?.message_reference)!.body!;
  expect((reply.message_reference as { message_id: string }).message_id).toBe(pollMessageId());
  expect(JSON.stringify(reply.embeds)).toContain("New date added to the poll");
  await expect.poll(() => lastPollEdit().text).toContain("**4.**");
  await rin.context().close();
});

test("players suggest a date from Discord, in a pop-up", async ({ request }) => {
  const panel = (await interact(request, buttonClick(P1_DISCORD, `pollvote:${pollId}`))).json as Panel;
  expect(JSON.stringify(panel.data.components[2])).toContain(`pollsuggest:${pollId}`);

  const popup = (await interact(request, buttonClick(P1_DISCORD, `pollsuggest:${pollId}`))).json;
  expect(popup.type).toBe(9);
  expect(popup.data.custom_id).toBe(`pollsuggestform:${pollId}`);
  // The time box starts at the poll's usual time.
  expect(popup.data.components.map((c: { component: { custom_id: string; value?: string } }) => [c.component.custom_id, c.component.value]))
    .toEqual([["date", undefined], ["time", "19:00"]]);

  const submit = (date: string, time = "19:00") =>
    interact(request, modalSubmitValues(P1_DISCORD, `pollsuggestform:${pollId}`, { date, time }));

  let reply = (await submit("31.02")).json;
  expect(reply.type).toBe(7); // the panel updates, with the reason
  expect(reply.data.content).toContain("Couldn't add that date: That date doesn't exist.");
  reply = (await submit("26.12", "25:00")).json;
  expect(reply.data.content).toContain("Couldn't add that date: I couldn't read that time.");

  const [year, , day] = futureDate(7, "19:00").slice(0, 10).split("-");
  reply = (await submit(`${day}.12.${year}`)).json;
  expect(reply.data.content).toMatch(/^Added <t:\d+:F>, and you're marked as a Yes for it\./);
  expect(sql(`SELECT u.email || '|' || v.choice FROM "DatePollOption" o
              JOIN "User" u ON u.id = o."addedById"
              JOIN "DatePollVote" v ON v."optionId" = o.id
              WHERE o."pollId" = '${pollId}' AND to_char(o."startsAt", 'MM-DD HH24:MI') = '12-07 18:00'`))
    .toBe(`${PLAYER1}|YES`);
  // The new date is in the panel's lists, already picked as a Yes.
  const yesList = (reply as Panel).data.components[0].components[0].options;
  expect(yesList.filter((o) => o.default).length).toBeGreaterThan(0);

  reply = (await submit(`${day}.12.${year}`)).json;
  expect(reply.data.content).toContain("Couldn't add that date: That date is already in the poll.");

  // Everyone else hears about it as a reply to the poll's post.
  await expect.poll(() => posts().filter((p) => p.body?.message_reference).length).toBe(2);
});

test("picking a date closes the poll's post and posts the session", async ({ request }) => {
  await dm.reload({ waitUntil: "networkidle" });
  const best = dm.locator("li", { has: dm.getByText("Best so far") });
  await best.getByRole("button", { name: "Pick this date" }).click();
  await dm.getByRole("dialog").getByRole("button", { name: "Pick this date" }).click();
  await dm.waitForURL("**/sessions/**");
  const sessionId = dm.url().split("/sessions/")[1];

  await expect.poll(() => lastPollEdit().text).toContain("**Date picked:**");
  expect(lastPollEdit().components).not.toContain("pollvote:");
  expect(lastPollEdit().components).toContain(`/sessions/${sessionId}`);
  await expect.poll(() => posts().some((p) => JSON.stringify(p.body?.components ?? []).includes(`rsvp:${sessionId}:YES`))).toBe(true);

  // A panel left open from before can't change the closed poll.
  const before = votesOf(PLAYER1); // including a Yes for the date they suggested
  const stale = (await interact(request, listChange(P1_DISCORD, `pollyes:${pollId}`, [options[1]]))).json;
  expect(stale.data.content).toContain("This poll is closed.");
  expect(votesOf(PLAYER1)).toBe(before);
});
