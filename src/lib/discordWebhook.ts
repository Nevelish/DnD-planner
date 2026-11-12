import "server-only";

const EMBED_COLOR = 0xb87e40; // matches the app's gold accent

export type DiscordWebhookEvent = {
  title: string;
  body?: string | null;
  url?: string | null;
};

/** Posts a simple embed to a Discord webhook. Best-effort — never throws, so
 * a broken, revoked, or unreachable webhook can't block the real action
 * (session proposed, RSVP changed, etc.) that triggered it. Returns whether
 * it succeeded so a caller that cares (e.g. a "send test message" action)
 * can report that back; fire-and-forget callers can just ignore it.
 * Failures are also logged for container-log visibility. */
export async function postToDiscordWebhook(
  webhookUrl: string,
  event: DiscordWebhookEvent,
): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "DnD Planner",
        embeds: [
          {
            title: event.title,
            description: event.body || undefined,
            url: event.url || undefined,
            color: EMBED_COLOR,
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`Discord webhook post failed: ${res.status} ${res.statusText}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Discord webhook post failed:", e instanceof Error ? e.message : e);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
