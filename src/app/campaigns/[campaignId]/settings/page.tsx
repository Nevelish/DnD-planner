import { prisma } from "@/lib/prisma";
import { requireDMForPage } from "@/lib/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EditCampaignForm } from "@/components/campaigns/edit-campaign-form";
import { DeleteCampaignButton } from "@/components/campaigns/delete-campaign-button";
import { DiscordWebhookForm } from "@/components/campaigns/discord-webhook-form";
import { RecurringRuleForm } from "@/components/sessions/recurring-rule-form";
import { DiscordBotCard } from "@/components/campaigns/discord-bot-card";
import { discordApi, discordBotConfig } from "@/lib/discord/api";
import { linkedDiscordId } from "@/lib/discord/accounts";

// Read Messages, Send Messages, Embed Links, Read Message History.
const BOT_PERMISSIONS = 1024 + 2048 + 16384 + 65536;

export default async function CampaignSettingsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { userId } = await requireDMForPage(campaignId);

  const [campaign, recurringRule] = await Promise.all([
    prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } }),
    prisma.recurringRule.findFirst({
      where: { campaignId, isActive: true },
    }),
  ]);

  const bot = discordBotConfig();
  const channel =
    bot && campaign.discordChannelId
      ? await discordApi<{ name?: string }>("GET", `/channels/${campaign.discordChannelId}`)
      : null;
  const channelLabel = campaign.discordChannelId
    ? channel?.name
      ? `#${channel.name}`
      : `channel ${campaign.discordChannelId}`
    : null;
  const botConnected = !!bot && !!campaign.discordChannelId;
  const dmDiscordLinked = bot ? (await linkedDiscordId(userId)) !== null : false;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Campaign details</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <EditCampaignForm
            campaignId={campaignId}
            name={campaign.name}
            description={campaign.description}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recurring sessions</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <RecurringRuleForm campaignId={campaignId} rule={recurringRule} />
        </CardContent>
      </Card>

      {bot && (
        <Card>
          <CardHeader>
            <CardTitle>Discord bot</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <DiscordBotCard
              campaignId={campaignId}
              channelLabel={channelLabel}
              autoJoin={campaign.discordAutoJoin}
              dmDiscordLinked={dmDiscordLinked}
              inviteUrl={`https://discord.com/oauth2/authorize?client_id=${bot.applicationId}&scope=bot+applications.commands&permissions=${BOT_PERMISSIONS}`}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Discord notifications</CardTitle>
          {botConnected && (
            <CardDescription>
              The Discord bot is posting for this campaign, so the webhook URL isn&apos;t used. The
              events you pick here still decide what gets posted. Session posts show everyone&apos;s
              answers themselves, and updates to a session are posted as replies to it.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pb-6">
          <DiscordWebhookForm
            campaignId={campaignId}
            discordWebhookUrl={campaign.discordWebhookUrl}
            discordWebhookEvents={campaign.discordWebhookEvents}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <DeleteCampaignButton campaignId={campaignId} />
        </CardContent>
      </Card>
    </div>
  );
}
