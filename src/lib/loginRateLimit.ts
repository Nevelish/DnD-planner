import "server-only";

/**
 * Failed sign-in attempts, counted in memory per email address and per IP
 * address over a 15-minute window. Self-hosted as a single app container,
 * so memory is enough; a restart simply clears the counters.
 *
 * Per email stops anyone guessing one person's password; per IP stops one
 * machine trying many accounts. A successful sign-in clears that email's
 * counter.
 */
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES_PER_EMAIL = 5;
const MAX_FAILURES_PER_IP = 20;
const MAX_TRACKED_KEYS = 10_000;

type Counter = { failures: number; windowEndsAt: number };

// On globalThis, not a plain module variable: Next bundles the sign-in form's
// server action and the /api/auth route separately, each with its own copy
// of this module. A module-level Map would give each its own counters, and
// posting straight to /api/auth would dodge a lockout from the form.
const globalForLogin = globalThis as unknown as { loginFailureCounters?: Map<string, Counter> };
const counters = (globalForLogin.loginFailureCounters ??= new Map<string, Counter>());

function live(key: string, now: number): Counter | undefined {
  const counter = counters.get(key);
  if (counter && counter.windowEndsAt <= now) {
    counters.delete(key);
    return undefined;
  }
  return counter;
}

function keys(email: string, ip: string) {
  return {
    email: { key: `email:${email.trim().toLowerCase()}`, max: MAX_FAILURES_PER_EMAIL },
    ip: { key: `ip:${ip}`, max: MAX_FAILURES_PER_IP },
  };
}

/** Milliseconds until another attempt is allowed, or 0 if it's allowed now. */
export function loginRetryAfterMs(email: string, ip: string, now = Date.now()): number {
  let wait = 0;
  for (const { key, max } of Object.values(keys(email, ip))) {
    const counter = live(key, now);
    if (counter && counter.failures >= max) wait = Math.max(wait, counter.windowEndsAt - now);
  }
  return wait;
}

export function recordLoginFailure(email: string, ip: string, now = Date.now()) {
  if (counters.size > MAX_TRACKED_KEYS) {
    for (const [key, counter] of counters) if (counter.windowEndsAt <= now) counters.delete(key);
  }
  for (const { key } of Object.values(keys(email, ip))) {
    const counter = live(key, now);
    if (counter) counter.failures += 1;
    else counters.set(key, { failures: 1, windowEndsAt: now + WINDOW_MS });
  }
}

export function clearLoginFailures(email: string) {
  counters.delete(keys(email, "").email.key);
}

/**
 * The visitor's IP. Behind Cloudflare (a tunnel or proxy) it's in
 * cf-connecting-ip; behind another reverse proxy, the first entry of
 * x-forwarded-for. Directly exposed, those headers could be faked, which is
 * why the per-email limit doesn't depend on the IP at all.
 */
export function clientIp(headers: Headers | undefined): string {
  return (
    headers?.get("cf-connecting-ip") ??
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers?.get("x-real-ip") ??
    "unknown"
  );
}
