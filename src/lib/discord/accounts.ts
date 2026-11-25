import "server-only";

import { prisma } from "@/lib/prisma";

/** The Discord account linked to a planner account ("Sign in with Discord",
 * or made by the bot), if any. */
export async function linkedDiscordId(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "discord" },
    select: { providerAccountId: true },
  });
  return account?.providerAccountId ?? null;
}
