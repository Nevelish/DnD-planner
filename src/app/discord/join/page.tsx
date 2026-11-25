import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/permissions";
import { readJoinToken } from "@/lib/discord/joinLink";
import { linkedDiscordId } from "@/lib/discord/accounts";
import { formatSessionDateTimeForUser, getDateTimePrefs } from "@/lib/sessionDateFormat";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DiscordButton } from "@/components/auth/discord-button";
import { JoinFromDiscordButton } from "@/components/discord/join-from-discord-button";

const ANSWER = { YES: "I'm in", MAYBE: "Maybe", NO: "Can't make it" } as const;

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pb-6 text-sm text-muted-foreground">{children}</CardContent>
      </Card>
    </div>
  );
}

/**
 * Where the Discord bot sends someone who clicked an RSVP button before they
 * were in the campaign. They sign in with the same Discord account, join,
 * and their answer is saved.
 */
export default async function JoinFromDiscordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const data = readJoinToken(token);
  if (!data || !token) {
    return (
      <Message title="This link has expired">
        <p>Click the button in Discord again to get a fresh one.</p>
      </Message>
    );
  }

  const session = await prisma.sessionProposal.findFirst({
    where: { id: data.sessionId, campaignId: data.campaignId },
    select: { title: true, startsAt: true, campaign: { select: { name: true } } },
  });
  if (!session) {
    return (
      <Message title="That session is gone">
        <p>It may have been deleted. Check the Discord channel for the latest one.</p>
      </Message>
    );
  }

  const here = `/discord/join?token=${token}`;
  const userId = await getCurrentUserId();
  if (!userId) {
    return (
      <Message title={`Join ${session.campaign.name}`}>
        <p>
          Continue with the Discord account you clicked the button with. You&apos;ll join the
          campaign and your answer will be saved. After that, the buttons in Discord just work.
        </p>
        <DiscordButton callbackUrl={here} />
        <p>
          Already have a planner account with an email and password?{" "}
          <Link href={`/signin?callbackUrl=${encodeURIComponent(here)}`} className="font-medium text-foreground underline underline-offset-2">
            Sign in with it first
          </Link>
          , then connect Discord.
        </p>
      </Message>
    );
  }

  const discordId = await linkedDiscordId(userId);
  if (!discordId) {
    return (
      <Message title="Connect your Discord account">
        <p>
          You&apos;re signed in to the planner, but not with Discord. Connect the Discord account
          you clicked the button with, and you&apos;ll come straight back here.
        </p>
        <DiscordButton callbackUrl={here} />
      </Message>
    );
  }
  if (discordId !== data.discordId) {
    return (
      <Message title="That's a different Discord account">
        <p>
          The button was clicked with another Discord account than the one linked to your
          planner account. Sign out, then open the link again and continue with the right one.
        </p>
      </Message>
    );
  }

  const [prefs, membership] = await Promise.all([
    getDateTimePrefs(userId),
    prisma.campaignMember.findUnique({
      where: { campaignId_userId: { campaignId: data.campaignId, userId } },
      select: { id: true },
    }),
  ]);
  return (
    <Message title={membership ? "Save your answer" : `Join ${session.campaign.name}`}>
      <CardDescription className="text-foreground">
        <span className="font-medium">{session.title || "Next session"}</span>
        <br />
        {formatSessionDateTimeForUser(session.startsAt, prefs)}
      </CardDescription>
      <p>
        Your answer: <span className="font-medium text-foreground">{ANSWER[data.status]}</span>
      </p>
      <JoinFromDiscordButton
        token={token}
        label={membership ? "Save my answer" : "Join and save my answer"}
      />
    </Message>
  );
}
