import { expect, test, type Browser, type Page } from "@playwright/test";

import { BASE_URL, DM, PLAYER1, PLAYER2, landsOn, login, resetDatabase, sql } from "./support";

/**
 * Accounts and sign-in: sessions end when an account is disabled or its
 * password changes, admin rights apply straight away, and repeated wrong
 * passwords lock sign-in for a while.
 *
 * Runs last (see playwright.config.ts): the lockouts it triggers stay in the
 * server's memory for 15 minutes.
 */
test.describe.configure({ mode: "serial" });

let dm: Page;

const path = (page: Page) => new URL(page.url()).pathname;

async function adminAction(who: string, item: string) {
  await dm.goto("/admin/users", { waitUntil: "networkidle" });
  await dm.getByRole("button", { name: `Actions for ${who}` }).click();
  await dm.getByRole("menuitem", { name: item }).click();
}

/** Signs in by posting straight to Auth.js, skipping the form. */
async function directSignIn(browser: Browser, email: string, password: string, ip: string) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  const { csrfToken } = await (await context.request.get("/api/auth/csrf")).json();
  const response = await context.request.post("/api/auth/callback/credentials", {
    form: { email, password, csrfToken, callbackUrl: `${BASE_URL}/dashboard` },
    headers: { "x-forwarded-for": ip },
    maxRedirects: 0,
  });
  const signedIn = (await context.cookies()).some((c) => c.name.includes("session-token"));
  await context.close();
  return { signedIn, location: response.headers()["location"] ?? "" };
}

test.beforeAll(async ({ browser }) => {
  resetDatabase();
  sql(`UPDATE "User" SET role = 'ADMIN' WHERE email = '${DM}'`);
  dm = await login(browser, DM);
});

test.afterAll(async () => {
  await dm?.context().close();
});

test("disabling an account signs it out", async ({ browser }) => {
  const p1 = await login(browser, PLAYER1);
  expect(await landsOn(p1)).toBe("/dashboard");
  await adminAction("Percy Player", "Disable account");
  await expect(dm.getByText("Account disabled.")).toBeVisible();
  expect(await landsOn(p1)).toBe("/signin");
  expect(path(await login(browser, PLAYER1))).toBe("/signin");

  await adminAction("Percy Player", "Enable account");
  await expect(dm.getByText("Account re-enabled.")).toBeVisible();
  expect(path(await login(browser, PLAYER1))).toBe("/dashboard");
});

test("an admin password reset signs the user out everywhere", async ({ browser }) => {
  const p1 = await login(browser, PLAYER1);
  await adminAction("Percy Player", "Reset password");
  await dm.fill("#admin-new-password", "brand-new-pass-1");
  await dm.getByRole("button", { name: "Set password" }).click();
  await expect(dm.getByText("signed out everywhere")).toBeVisible();
  expect(await landsOn(p1)).toBe("/signin");
  expect(path(await login(browser, PLAYER1))).toBe("/signin");
  expect(path(await login(browser, PLAYER1, { password: "brand-new-pass-1" }))).toBe("/dashboard");
});

test("changing your password signs out your other devices", async ({ browser }) => {
  const laptop = await login(browser, PLAYER2);
  const phone = await login(browser, PLAYER2);
  await laptop.goto("/account", { waitUntil: "networkidle" });
  await laptop.fill("#currentPassword", "password123");
  await laptop.fill("#newPassword", "rin-new-pass-1");
  await laptop.fill("#confirmPassword", "rin-new-pass-1");
  await laptop.getByRole("button", { name: "Update password" }).click();
  await expect(laptop.getByText("other devices signed in to your account have been signed out")).toBeVisible();
  expect(await landsOn(laptop)).toBe("/dashboard");
  expect(await landsOn(phone)).toBe("/signin");
  expect(path(await login(browser, PLAYER2, { password: "rin-new-pass-1" }))).toBe("/dashboard");
});

test("admin rights change without signing in again", async ({ browser }) => {
  const p2 = await login(browser, PLAYER2, { password: "rin-new-pass-1" });
  // A refused page can still arrive with status 200 (it streams), so look at
  // what's on it.
  const seesAdminPage = async () => {
    await p2.goto("/admin/users", { waitUntil: "networkidle" });
    return p2.getByRole("button", { name: "Actions for Dana the DM" }).count();
  };
  expect(await seesAdminPage()).toBe(0);
  await adminAction("Rin Rogue", "Make admin");
  await expect(dm.getByText("Promoted to admin.")).toBeVisible();
  expect(await seesAdminPage()).toBe(1);
  await adminAction("Rin Rogue", "Remove admin");
  await expect(dm.getByText("Admin rights removed.")).toBeVisible();
  expect(await seesAdminPage()).toBe(0);
});

test("repeated wrong passwords lock sign-in", async ({ browser }) => {
  for (let i = 1; i <= 5; i++) {
    const page = await login(browser, DM, { password: `wrong-guess-${i}` });
    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    await page.context().close();
  }
  const locked = await login(browser, DM);
  expect(path(locked)).toBe("/signin");
  await expect(locked.getByText("Too many failed sign-in attempts")).toBeVisible();

  // Posting straight to Auth.js is blocked too, from any IP.
  const direct = await directSignIn(browser, DM, "password123", "203.0.113.77");
  expect(direct.signedIn).toBe(false);
  expect(direct.location).toContain("too_many_attempts");

  expect(await landsOn(dm)).toBe("/dashboard"); // existing sessions keep working
  expect(path(await login(browser, PLAYER1, { password: "brand-new-pass-1" }))).toBe("/dashboard");
});

test("wrong 'current password' guesses are limited too", async ({ browser }) => {
  const p1 = await login(browser, PLAYER1, { password: "brand-new-pass-1" });
  await p1.goto("/account", { waitUntil: "networkidle" });
  for (let i = 1; i <= 6; i++) {
    await p1.fill("#currentPassword", `nope-${i}`);
    await p1.fill("#newPassword", "whatever-pass-9");
    await p1.fill("#confirmPassword", "whatever-pass-9");
    await Promise.all([
      p1.waitForResponse((r) => r.request().method() === "POST" && !!r.request().headers()["next-action"]),
      p1.getByRole("button", { name: "Update password" }).click(),
    ]);
  }
  await expect(p1.getByText("Too many wrong passwords")).toBeVisible();
});

test("one IP failing many times is blocked, for every account", async ({ browser }) => {
  for (let i = 0; i < 20; i++) await directSignIn(browser, `nobody${i}@example.com`, "x", "198.51.100.9");
  expect((await directSignIn(browser, PLAYER2, "rin-new-pass-1", "198.51.100.9")).signedIn).toBe(false);
  expect((await directSignIn(browser, PLAYER2, "rin-new-pass-1", "198.51.100.10")).signedIn).toBe(true);
});

test("security headers and health check", async ({ request }) => {
  const headers = (await request.get(`${BASE_URL}/signin`)).headers();
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toContain("camera=()");
  expect(headers["x-powered-by"]).toBeUndefined();

  const health = await request.get(`${BASE_URL}/api/health`);
  expect(health.status()).toBe(200);
  expect(await health.json()).toEqual({ status: "ok" });
});
