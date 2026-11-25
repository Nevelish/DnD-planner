import { expect, test } from "@playwright/test";

import { DM, PLAYER1, PLAYER2, campaignId, fetchHtml, login, resetDatabase, sql } from "./support";

/**
 * Loads every page as each user and checks the HTML (which includes all the
 * data sent to client components) for other people's secrets: password
 * hashes, calendar feed tokens and Discord ids. A user's own password hash
 * must never reach the browser either.
 */
test("no page sends anyone's secrets to the browser", async ({ browser }) => {
  resetDatabase();
  sql(`UPDATE "User" SET "calendarToken" = 'caltoken-' || md5(email), "discordUserId" = '9' || abs(hashtext(email))`);
  const cid = campaignId();
  // A poll and a played session, so their pages are scanned too.
  const dmId = sql(`SELECT id FROM "User" WHERE email = '${DM}'`);
  sql(`INSERT INTO "DatePoll" (id, "campaignId", "createdById", title, "durationMinutes", status, "updatedAt")
       VALUES ('scanpoll', '${cid}', '${dmId}', 'Scan poll', 180, 'OPEN', now())`);
  sql(`INSERT INTO "SessionProposal" (id, "campaignId", "proposedById", title, "startsAt", status, recap, "recapAuthorId", "updatedAt")
       VALUES ('scanpast', '${cid}', '${dmId}', 'Played', now() - interval '3 days', 'COMPLETED', 'It went well.', '${dmId}', now())`);

  const users = sql(`SELECT email || '|' || "passwordHash" || '|' || "calendarToken" || '|' || "discordUserId" FROM "User"`)
    .split("\n")
    .map((line) => {
      const [email, hash, ...others] = line.split("|");
      return { email, hash, secrets: [hash, ...others] };
    });
  const sessions = sql(`SELECT id FROM "SessionProposal"`).split("\n");
  const paths = [
    "/dashboard", "/calendar", "/account", "/campaigns", "/notifications", "/admin", "/admin/users", "/admin/settings",
    ...["", "/sessions", "/roster", "/notes", "/notes/party", "/safety", "/members", "/settings", "/log"].map((p) => `/campaigns/${cid}${p}`),
    ...sessions.map((s) => `/campaigns/${cid}/sessions/${s}`),
    `/campaigns/${cid}/polls/scanpoll`,
  ];
  sql(`UPDATE "User" SET role = 'ADMIN' WHERE email = '${DM}'`); // so the admin pages are scanned too

  const leaks: string[] = [];
  for (const me of [DM, PLAYER1, PLAYER2]) {
    const page = await login(browser, me);
    for (const path of paths) {
      const html = await fetchHtml(page, path);
      for (const user of users) {
        const secrets = user.email === me ? [user.hash] : user.secrets;
        for (const secret of secrets) {
          if (html.includes(secret)) leaks.push(`${me} gets ${user.email}'s ${secret.slice(0, 10)}… on ${path}`);
        }
      }
    }
    await page.context().close();
  }
  expect(leaks).toEqual([]);
});
