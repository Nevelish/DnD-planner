import { prisma } from "@/lib/prisma";
import { requireDMForPage } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditCampaignForm } from "@/components/campaigns/edit-campaign-form";
import { DeleteCampaignButton } from "@/components/campaigns/delete-campaign-button";
import { DiscordWebhookForm } from "@/components/campaigns/discord-webhook-form";
import { RecurringRuleForm } from "@/components/sessions/recurring-rule-form";

export default async function CampaignSettingsPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  await requireDMForPage(campaignId);

  const [campaign, recurringRule] = await Promise.all([
    prisma.campaign.findUniqueOrThrow({ where: { id: campaignId } }),
    prisma.recurringRule.findFirst({
      where: { campaignId, isActive: true },
    }),
  ]);

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

      <Card>
        <CardHeader>
          <CardTitle>Discord notifications</CardTitle>
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
