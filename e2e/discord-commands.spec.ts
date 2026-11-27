import { expect, test } from "@playwright/test";

import { DM, PLAYER1, PLAYER2, campaignId, futureDate, resetDatabase, sql, userId } from "./support";
import { CHANNEL, interact, slashCommand, startFakeDiscord } from "./discord";

/** The /next, /poll and /planner nudge commands, in the campaign's channel.
 * Discord is faked as in discord-bot.spec.ts. */
test.describe.configure({ mode: "serial" });

const DM_DISCORD = "400000000000000001";
const P1_DISCORD = "400000000000000002";
const RIN_DISCORD = "400000000000000003";
const SHARE = [{ name: "share", type: 5, value: true }];

let cid: string, sessionId: string;
let discord: Awaited<ReturnType<typeof startFakeDiscord>>;

type Reply = {
  type: number;
  data: {
    content?: string;
    flags?: number;
    embeds?: { author?: { name: string }; title?: string; description?: string; fields?: unknown }[];
    components?: unknown[];
    allowed_mentions?: { users?: string[] };
  };
};
const run = async (request: Parameters<typeof interact>[0], ...args: Parameters<typeof slashCommand>) =>
  (await interact(request, slashCommand(...args))).json as Reply;
const posts = () => discord.requests.filter((r) => r.method === "POST" && r.path === `/channels/${CHANNEL}/messages`);

test.beforeAll(async () => {
  resetDatabase();
  cid = campaignId();
  sessionId = sql(`SELECT id FROM "SessionProposal" LIMIT 1`); // next week; Percy Yes, Rin hasn't answered
  discord = await startFakeDiscord();
  sql(`UPDATE "Campaign" SET "discordChannelId" = '${CHANNEL}'`);
  for (const [email, id] of [[DM, DM_DISCORD], [PLAYER1, P1_DISCORD]]) {
    sql(`INSERT INTO "Account" (id, "userId", type, provider, "providerAccountId") VALUES ('acct_${id}', '${userId(email)}', 'oauth', 'discord', '${id}')`);
  }
  // Rin only typed in her Discord id (for @mentions); she isn't linked.
  sql(`UPDATE "User" SET "discordUserId" = '${RIN_DISCORD}' WHERE email = '${PLAYER2}'`);
});

test.afterAll(async () => {
  await discord?.close();
});

test("commands only work in a connected channel", async ({ request }) => {
  const reply = await run(request, P1_DISCORD, "next", [], "999999999999999999");
  expect(reply.data.content).toContain("This channel isn't connected to a campaign");
});

test("/next shows the next session privately, with RSVP buttons", async ({ request }) => {
  const reply = await run(request, P1_DISCORD, "next");
  expect(reply.type).toBe(4);
  expect(reply.data.flags).toBe(64);
  const embed = reply.data.embeds![0];
  expect(embed.author?.name).toBe("Next session");
  expect(embed.title).toBe("Session 1: Into the Dungeon");
  expect(JSON.stringify(embed.fields)).toContain('"name":"Going (1)","value":"Percy Player"');
  expect(JSON.stringify(reply.data.components)).toContain(`rsvp:${sessionId}:YES`);
  expect(posts()).toHaveLength(0); // nothing posted in the channel
});

test("/next with share posts a live post in the channel", async ({ request }) => {
  const reply = await run(request, P1_DISCORD, "next", SHARE);
  expect(reply.data.content).toBe("Posted it in the channel.");
  await expect.poll(() => posts().length).toBe(1);
  expect(JSON.stringify(posts()[0].body?.components)).toContain(`rsvp:${sessionId}:YES`);
  await expect.poll(() => sql(`SELECT count(*) FROM "DiscordSessionMessage" WHERE "sessionProposalId" = '${sessionId}'`)).toBe("1");
});

test("/poll shows the open date poll, and says when there isn't one", async ({ request }) => {
  expect((await run(request, P1_DISCORD, "poll")).data.content).toContain("There's no date poll open");

  const dmId = userId(DM);
  sql(`INSERT INTO "DatePoll" (id, "campaignId", "createdById", title, "durationMinutes", status, "updatedAt")
       VALUES ('poll1', '${cid}', '${dmId}', 'Session 2: The Heist', 180, 'OPEN', now())`);
  sql(`INSERT INTO "DatePollOption" (id, "pollId", "startsAt") VALUES
       ('o1', 'poll1', '${futureDate(10, "18:00").replace("T", " ")}+00'),
       ('o2', 'poll1', '${futureDate(11, "18:00").replace("T", " ")}+00')`);

  const reply = await run(request, P1_DISCORD, "poll");
  expect(reply.data.flags).toBe(64);
  expect(reply.data.embeds![0].title).toBe("Session 2: The Heist");
  expect(JSON.stringify(reply.data.components)).toContain("pollvote:poll1");

  const shared = await run(request, P1_DISCORD, "poll", SHARE);
  expect(shared.data.content).toBe("Posted it in the channel.");
  await expect.poll(() => sql(`SELECT count(*) FROM "DiscordPollMessage" WHERE "pollId" = 'poll1'`)).toBe("1");
});

test("/planner nudge is for the DM only", async ({ request }) => {
  const nudge = [{ name: "nudge", type: 1 }];
  expect((await run(request, P1_DISCORD, "planner", nudge)).data.content).toBe("Only the campaign's DM can nudge players.");
});

test("/planner nudge @mentions only the players who haven't answered", async ({ request }) => {
  const nudge = [{ name: "nudge", type: 1 }];
  const reply = await run(request, DM_DISCORD, "planner", nudge);
  expect(reply.type).toBe(4);
  expect(reply.data.flags).toBeUndefined(); // public, in the channel

  // Percy said Yes to the session but hasn't voted; Rin has done neither.
  const text = reply.data.embeds![0].description!;
  expect(text).toContain("**Session 1: Into the Dungeon**");
  expect(text).toContain("Not answered yet: Rin Rogue");
  expect(text).toContain("Not voted yet: Percy Player, Rin Rogue");
  // Only people with a Discord id get pinged (Percy has no typed-in id here).
  expect(reply.data.content).toBe(`<@${RIN_DISCORD}> The DM is waiting for your answer:`);
  expect(reply.data.allowed_mentions?.users).toEqual([RIN_DISCORD]);
  const buttons = JSON.stringify(reply.data.components);
  expect(buttons).toContain(`rsvp:${sessionId}:YES`);
  expect(buttons).toContain("pollvote:poll1");
});

test("nudge leaves out anyone away that day, and stops when everyone has answered", async ({ request }) => {
  const nudge = [{ name: "nudge", type: 1 }];
  const sessionDay = sql(`SELECT to_char("startsAt" AT TIME ZONE 'Europe/Oslo', 'YYYY-MM-DD') FROM "SessionProposal" WHERE id = '${sessionId}'`);
  sql(`INSERT INTO "AwayPeriod" (id, "userId", "startsOn", "endsOn") VALUES ('away1', '${userId(PLAYER2)}', '${sessionDay}', '${sessionDay}')`);
  let text = (await run(request, DM_DISCORD, "planner", nudge)).data.embeds![0].description!;
  expect(text).not.toContain("Not answered yet");
  expect(text).toContain("Not voted yet: Percy Player, Rin Rogue");

  for (const email of [PLAYER1, PLAYER2]) {
    sql(`INSERT INTO "DatePollVote" (id, "optionId", "memberId", choice, "updatedAt")
         SELECT 'v_' || m.id, 'o1', m.id, 'YES', now() FROM "CampaignMember" m WHERE m."userId" = '${userId(email)}'`);
  }
  text = (await run(request, DM_DISCORD, "planner", nudge)).data.content!;
  expect(text).toBe("Everyone has answered. Nothing to nudge.");
});

test("/next says when nothing is planned", async ({ request }) => {
  sql(`UPDATE "SessionProposal" SET status = 'CANCELLED'`);
  const reply = await run(request, P1_DISCORD, "next");
  expect(reply.data.content).toContain("No session is planned for **Curse of the Crimson Throne** yet.");
  expect(reply.data.content).toContain("`/poll` brings it up");
});
