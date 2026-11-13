import "server-only";

const DEFAULT_EMBED_COLOR = 0xb87e40; // matches the app's gold accent

export type DiscordWebhookEvent = {
  title: string;
  body?: string | null;
  url?: string | null;
  /** Overrides the default gold embed color. */
  color?: number;
  /** Shown in the embed footer, e.g. the campaign name. */
  footerText?: string | null;
  /** ISO 8601 timestamp rendered by Discord's own local-time formatting. */
  timestamp?: string | null;
  /** Top-level message content, e.g. "<@123> <@456>" — mentions only ping
   * when placed here, never inside an embed's title/description/fields. */
  content?: string | null;
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
        content: event.content || undefined,
        embeds: [
          {
            title: event.title,
            description: event.body || undefined,
            url: event.url || undefined,
            color: event.color ?? DEFAULT_EMBED_COLOR,
            footer: event.footerText ? { text: event.footerText } : undefined,
            timestamp: event.timestamp || undefined,
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
