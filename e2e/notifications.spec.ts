import { expect, test } from "@playwright/test";

import { PLAYER1, PLAYER2, go, login, resetDatabase, sql, userId } from "./support";

/** The Notifications page's buttons, and the bell in the header keeping up
 * with them (it keeps its own copy, refreshed every 30 seconds otherwise). */
const addUnread = (email: string, count: number, prefix: string) =>
  sql(`INSERT INTO "Notification" (id, "recipientId", type, title, "createdAt")
       SELECT '${prefix}' || g, '${userId(email)}', 'RSVP_CHANGED', '${prefix} ' || g, now()
       FROM generate_series(1, ${count}) g`);

test("mark all read and clear all update the bell straight away", async ({ browser }) => {
  resetDatabase();
  addUnread(PLAYER1, 5, "first");
  addUnread(PLAYER2, 2, "theirs");
  const p1 = await login(browser, PLAYER1);
  await go(p1, "/notifications");
  const bell = p1.getByRole("button", { name: /^Notifications/ });
  await expect(bell).toHaveAccessibleName("Notifications, 5 unread");

  await p1.getByRole("button", { name: "Mark all read" }).click();
  await expect(bell).toHaveAccessibleName("Notifications"); // no reload, no 30-second wait
  expect(sql(`SELECT count(*) FROM "Notification" WHERE "recipientId" = '${userId(PLAYER1)}' AND NOT "isRead"`)).toBe("0");

  addUnread(PLAYER1, 3, "second");
  await p1.reload({ waitUntil: "networkidle" });
  await expect(bell).toHaveAccessibleName("Notifications, 3 unread");

  await p1.getByRole("button", { name: "Clear all" }).click();
  await p1.getByRole("dialog").getByRole("button", { name: "Clear all" }).click();
  await expect(p1.getByText("Notifications cleared.")).toBeVisible();
  await expect(p1.getByText("No notifications yet.")).toBeVisible();
  await expect(bell).toHaveAccessibleName("Notifications");
  await bell.click();
  await expect(p1.getByText("You're all caught up.")).toBeVisible();

  expect(sql(`SELECT count(*) FROM "Notification" WHERE "recipientId" = '${userId(PLAYER1)}'`)).toBe("0");
  expect(sql(`SELECT count(*) FROM "Notification" WHERE "recipientId" = '${userId(PLAYER2)}'`)).toBe("2"); // only your own
});

test("on a small laptop screen, a long list scrolls and View all stays visible", async ({ browser }) => {
  resetDatabase();
  sql(`INSERT INTO "Notification" (id, "recipientId", type, title, body, "createdAt")
       SELECT 'long' || g, '${userId(PLAYER1)}', 'RSVP_CHANGED', 'Notification ' || g,
              repeat('A long notification body that goes on for a while. ', 6), now() - g * interval '1 minute'
       FROM generate_series(1, 10) g`);
  // A 13-inch laptop, minus the browser's own toolbars.
  const p1 = await login(browser, PLAYER1, { viewport: { width: 1280, height: 620 } });
  await go(p1, "/dashboard");
  await p1.getByRole("button", { name: /^Notifications/ }).click();

  const menu = p1.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: /Notification 1\b/ })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "View all" })).toBeInViewport({ ratio: 1 });
  const box = (await menu.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(620);

  // The list scrolls to the oldest one.
  await menu.getByRole("menuitem", { name: /Notification 10\b/ }).scrollIntoViewIfNeeded();
  await expect(menu.getByRole("menuitem", { name: /Notification 10\b/ })).toBeInViewport();
  await expect(menu.getByRole("menuitem", { name: "View all" })).toBeInViewport({ ratio: 1 });

  await menu.getByRole("menuitem", { name: "View all" }).click();
  await p1.waitForURL("**/notifications");
});
