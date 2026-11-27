import "server-only";

/**
 * The Discord bot: optional, and switched on by setting DISCORD_BOT_TOKEN and
 * DISCORD_PUBLIC_KEY next to the DISCORD_CLIENT_ID used for "Sign in with
 * Discord" (it's the same Discord application). See the README.
 */
export type DiscordBotConfig = {
  applicationId: string;
  botToken: string;
  publicKey: string;
  apiBase: string;
};

export function discordBotConfig(): DiscordBotConfig | null {
  const applicationId = process.env.DISCORD_CLIENT_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!applicationId || !botToken || !publicKey) return null;
  return {
    applicationId,
    botToken,
    publicKey,
    // Overridable so the tests can stand in for Discord.
    apiBase: (process.env.DISCORD_API_BASE ?? "https://discord.com/api/v10").replace(/\/$/, ""),
  };
}

/**
 * Calls Discord's REST API as the bot. Never throws: Discord being down or
 * a message having been deleted mustn't break whatever the app was doing.
 * Returns the parsed JSON on success, null on any failure (logged).
 */
export async function discordApi<T = unknown>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T | null> {
  const config = discordBotConfig();
  if (!config) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${config.apiBase}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bot ${config.botToken}`,
        "Content-Type": "application/json",
        "User-Agent": "DiscordBot (https://github.com/Nevelish/DnD-planner, 1.0)",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`Discord API ${method} ${path} failed: ${res.status} ${await res.text().catch(() => "")}`);
      return null;
    }
    return res.status === 204 ? ({} as T) : ((await res.json()) as T);
  } catch (e) {
    console.error(`Discord API ${method} ${path} failed:`, e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// The bot's slash commands. They work in the channel a campaign is connected
// to, and are about that campaign.
const COMMANDS = [
  {
    name: "next",
    description: "The next session: when, where, and who's coming",
    type: 1, // CHAT_INPUT
    contexts: [0], // servers only
    options: [
      {
        type: 5, // BOOLEAN
        name: "share",
        description: "Post it for everyone in the channel (otherwise only you see it)",
        required: false,
      },
    ],
  },
  {
    name: "poll",
    description: "The open date poll, with its Vote button",
    type: 1,
    contexts: [0],
    options: [
      {
        type: 5, // BOOLEAN
        name: "share",
        description: "Post it for everyone in the channel (otherwise only you see it)",
        required: false,
      },
    ],
  },
  {
    name: "planner",
    description: "DnD Planner",
    type: 1,
    contexts: [0],
    options: [
      {
        type: 1, // SUB_COMMAND
        name: "connect",
        description: "Post your campaign's sessions in this channel, with RSVP buttons",
      },
      {
        type: 1,
        name: "nudge",
        description: "DM only: remind players who haven't answered the next session or the poll",
      },
    ],
  },
];

/** Registers the bot's slash commands with Discord. A bulk overwrite, so
 * running it on every start is harmless. */
export async function registerDiscordCommands() {
  const config = discordBotConfig();
  if (!config) return;
  const ok = await discordApi("PUT", `/applications/${config.applicationId}/commands`, COMMANDS);
  if (ok) console.log("Discord bot: slash commands registered.");
}
