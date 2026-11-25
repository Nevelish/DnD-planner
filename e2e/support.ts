import { execFileSync } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Browser, BrowserContextOptions, Page } from "@playwright/test";

export const BASE_URL = `http://localhost:${process.env.E2E_PORT ?? 3100}`;
export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://dnd:dnd@localhost:5432/dnd_planner_e2e";

/** Seeded accounts (prisma/seed.ts). They all share this password. */
export const PASSWORD = "password123";
export const DM = "dm@example.com";
export const PLAYER1 = "player1@example.com"; // Percy Player
export const PLAYER2 = "player2@example.com"; // Rin Rogue

/** Runs SQL against the test database and returns psql's unaligned output
 * (booleans as t/f, rows on separate lines). */
export function sql(query: string): string {
  return execFileSync("psql", [DATABASE_URL, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", query], {
    encoding: "utf8",
  }).trim();
}

/** Empties every table and runs the normal seed, so each spec file starts from
 * the same known state. */
export function resetDatabase() {
  const name = new URL(DATABASE_URL).pathname.slice(1);
  if (!/e2e|test/i.test(name)) {
    throw new Error(`Refusing to wipe database "${name}": the tests only reset databases with "e2e" or "test" in the name.`);
  }
  const tables = sql(
    `SELECT string_agg(format('%I', tablename), ', ') FROM pg_tables
     WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`,
  );
  sql(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
  execFileSync("npx", ["tsx", "prisma/seed.ts"], {
    env: { ...process.env, DATABASE_URL, TZ: "Europe/Oslo" },
    stdio: "pipe",
  });
}

export const campaignId = () => sql(`SELECT id FROM "Campaign" LIMIT 1`);
export const userId = (email: string) => sql(`SELECT id FROM "User" WHERE email = '${email}'`);

/** Makes a fourth account and adds it to the campaign as a player. */
export function addPlayer(email: string, name: string) {
  sql(`INSERT INTO "User" (id, email, name, "passwordHash", "createdAt", "updatedAt")
       SELECT 'u_' || md5('${email}'), '${email}', '${name}', "passwordHash", now(), now()
       FROM "User" WHERE email = '${DM}'`);
  sql(`INSERT INTO "CampaignMember" (id, "campaignId", "userId", role, "joinedAt")
       SELECT 'm_' || md5('${email}'), c.id, 'u_' || md5('${email}'), 'PLAYER', now() FROM "Campaign" c`);
}

/**
 * Signs in through the real form in a fresh browser context. The timezone
 * cookie the app would normally set on first load is set up front, so pages
 * render in the browser's timezone straight away.
 */
export async function login(
  browser: Browser,
  email: string,
  { password = PASSWORD, ...options }: BrowserContextOptions & { password?: string } = {},
): Promise<Page> {
  const context = await browser.newContext({ baseURL: BASE_URL, ...options });
  const timezone = options.timezoneId ?? "Europe/Oslo";
  await context.addCookies([{ name: "tz", value: timezone, url: BASE_URL }]);
  const page = await context.newPage();
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/signin", { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  // Either it works and lands on the dashboard, or the form shows why not.
  await Promise.race([
    page.waitForURL("**/dashboard", { timeout: 15_000 }),
    page.getByText(/Invalid email or password|Too many failed sign-in attempts/).waitFor({ timeout: 15_000 }),
  ]).catch(() => {});
  return page;
}

/** Pages stream in behind a loading state; only look at them once settled.
 * (That's also why a "not found" can arrive with status 200: check content.) */
export const go = (page: Page, path: string) => page.goto(path, { waitUntil: "networkidle" });

/** The raw HTML a signed-in user gets for a URL, including the data React
 * sends along for client components. */
export const fetchHtml = async (page: Page, path: string) =>
  (await page.context().request.get(path)).text();

/** Where a signed-in page ends up when it loads `path`. */
export async function landsOn(page: Page, path = "/dashboard") {
  await go(page, path);
  return new URL(page.url()).pathname;
}

export const hasHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

/**
 * Does what a malicious client could: while `action` runs, any server-action
 * request carrying `ownId` is sent with `victimId` in its place. Returns
 * whether a request was actually rewritten, so a test can't pass by accident.
 */
export async function tamper(page: Page, ownId: string, victimId: string, action: () => Promise<unknown>) {
  let swapped = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const body = request.postData();
    if (request.method() === "POST" && request.headers()["next-action"] && body?.includes(ownId)) {
      swapped = true;
      return route.continue({ postData: body.split(ownId).join(victimId) });
    }
    return route.continue();
  });
  await action();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  await page.unrouteAll({ behavior: "ignoreErrors" });
  return swapped;
}

/** A stand-in for a Discord webhook that records what the app posts to it. */
export async function startWebhookCatcher() {
  const posts: unknown[] = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      posts.push(JSON.parse(body));
      res.writeHead(204).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/hook`,
    /** Every post so far, as JSON text. */
    texts: () => posts.map((post) => JSON.stringify(post)),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * A date-time-local value ("YYYY-MM-DDTHH:mm") on the given day and month of
 * next year, so it's always in the future and tests don't go stale. The
 * default month, December, is in winter, when Oslo is UTC+1.
 */
export function futureDate(day: number, time: string, { month = 12 }: { month?: number } = {}) {
  const year = new Date().getFullYear() + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${time}`;
}
