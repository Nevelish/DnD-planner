import { createPrivateKey, sign } from "node:crypto";
import http from "node:http";
import type { APIRequestContext } from "@playwright/test";

import { BASE_URL } from "./support";

/**
 * Stand-ins for Discord in the tests. The keys are throwaway test keys: the
 * app under test is configured with the public one (playwright.config.ts),
 * and the tests sign their fake interactions with the private one.
 */
export const DISCORD_TEST_APP_ID = "1111111111";
export const DISCORD_TEST_PUBLIC_KEY = "74dab7b08d628228f911b82d7df9c5c48f2c5ae6e997f55f8101c8b98665b114";
const PRIVATE_KEY = createPrivateKey({
  key: Buffer.from("MC4CAQAwBQYDK2VwBCIEIOQtkBMrb7BqCcUMOVThe78vLcrDVE/eycwkddiGNETw", "base64"),
  format: "der",
  type: "pkcs8",
});
export const FAKE_DISCORD_PORT = Number(process.env.E2E_FAKE_DISCORD_PORT ?? 4600);

/** Sends an interaction to the app the way Discord does: signed. */
export async function interact(request: APIRequestContext, interaction: object, { signed = true } = {}) {
  const body = JSON.stringify(interaction);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = sign(null, Buffer.from(timestamp + body), PRIVATE_KEY).toString("hex");
  const response = await request.post(`${BASE_URL}/api/discord/interactions`, {
    data: body,
    headers: {
      "content-type": "application/json",
      "x-signature-timestamp": timestamp,
      "x-signature-ed25519": signed ? signature : "0".repeat(128),
    },
  });
  return { status: response.status(), json: response.ok() ? await response.json() : null };
}

const who = (discordId: string, name = `user${discordId.slice(-3)}`) => ({
  member: { user: { id: discordId, username: name, global_name: name }, nick: null },
});

export const GUILD = "800000000000000000";
export const CHANNEL = "900000000000000000";

export const connectCommand = (discordId: string, channel = CHANNEL) => ({
  type: 2,
  guild_id: GUILD,
  channel_id: channel,
  ...who(discordId),
  data: { name: "planner", type: 1, options: [{ name: "connect", type: 1 }] },
});

export const buttonClick = (discordId: string, customId: string, { channel = CHANNEL, name }: { channel?: string; name?: string } = {}) => ({
  type: 3,
  guild_id: GUILD,
  channel_id: channel,
  ...who(discordId, name),
  data: { custom_id: customId, component_type: 2 },
});

export const modalSubmit = (discordId: string, customId: string, reason: string) => ({
  type: 5,
  guild_id: GUILD,
  channel_id: CHANNEL,
  ...who(discordId),
  data: { custom_id: customId, components: [{ type: 18, id: 1, component: { type: 4, id: 2, custom_id: "reason", value: reason } }] },
});

export type FakeDiscordRequest = { method: string; path: string; body: Record<string, unknown> | null };

/** Discord's REST API, as far as the bot uses it: records every request. */
export async function startFakeDiscord() {
  const requests: FakeDiscordRequest[] = [];
  let messageId = 1000;
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const path = (req.url ?? "").replace(/^\/api/, "");
      requests.push({ method: req.method ?? "", path, body: raw ? JSON.parse(raw) : null });
      res.setHeader("content-type", "application/json");
      const channel = path.match(/^\/channels\/(\d+)/)?.[1];
      if (req.method === "POST" && path.endsWith("/messages")) {
        res.end(JSON.stringify({ id: String(++messageId), channel_id: channel }));
      } else if (req.method === "GET" && channel) {
        res.end(JSON.stringify({ id: channel, name: "game-night" }));
      } else {
        res.end("{}");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(FAKE_DISCORD_PORT, "127.0.0.1", resolve));
  return {
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
