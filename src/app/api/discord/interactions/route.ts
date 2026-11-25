import { discordBotConfig } from "@/lib/discord/api";
import { verifyDiscordSignature } from "@/lib/discord/verify";
import { handleInteraction, type Interaction } from "@/lib/discord/interactions";

/**
 * Discord's "Interactions Endpoint URL": slash commands and button clicks
 * arrive here. Set it in the Discord developer portal (see the README).
 */
export async function POST(request: Request) {
  const config = discordBotConfig();
  if (!config) return new Response("The Discord bot isn't set up.", { status: 404 });

  const rawBody = await request.text();
  const valid = verifyDiscordSignature(
    rawBody,
    request.headers.get("x-signature-ed25519"),
    request.headers.get("x-signature-timestamp"),
    config.publicKey,
  );
  if (!valid) return new Response("invalid request signature", { status: 401 });

  let interaction: Interaction;
  try {
    interaction = JSON.parse(rawBody);
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }
  return Response.json(await handleInteraction(interaction));
}
