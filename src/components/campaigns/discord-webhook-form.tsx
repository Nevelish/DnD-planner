"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SendIcon } from "lucide-react";

import {
  updateCampaignDiscordWebhook,
  testCampaignDiscordWebhook,
} from "@/lib/actions/campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DiscordWebhookForm({
  campaignId,
  discordWebhookUrl,
}: {
  campaignId: string;
  discordWebhookUrl: string | null;
}) {
  const [url, setUrl] = useState(discordWebhookUrl ?? "");
  const [isSaving, startSaving] = useTransition();
  const [isTesting, startTesting] = useTransition();

  function handleSave(formData: FormData) {
    startSaving(async () => {
      try {
        await updateCampaignDiscordWebhook(campaignId, formData);
        toast.success(url ? "Discord webhook saved." : "Discord notifications turned off.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  function handleTest() {
    startTesting(async () => {
      try {
        await testCampaignDiscordWebhook(campaignId);
        toast.success("Test message sent — check your Discord channel.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <form action={handleSave} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="discordWebhookUrl">Webhook URL</Label>
        <Input
          id="discordWebhookUrl"
          name="discordWebhookUrl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          From the Discord channel you want updates in: Edit Channel →
          Integrations → Webhooks → New Webhook → Copy Webhook URL. Leave
          blank to turn this off.
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={isSaving} className="w-fit">
          {isSaving ? "Saving…" : "Save"}
        </Button>
        {discordWebhookUrl && (
          <Button
            type="button"
            variant="outline"
            disabled={isTesting}
            onClick={handleTest}
            className="w-fit"
          >
            <SendIcon /> {isTesting ? "Sending…" : "Send test message"}
          </Button>
        )}
      </div>
    </form>
  );
}
