"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { NotificationType } from "@prisma/client";

import { updateNotificationPrefs } from "@/lib/actions/account";
import { MENTION_EVENT_TYPES, NOTIFICATION_PREF_GROUPS } from "@/lib/notificationPrefs";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/userError";

function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

export function NotificationPrefsForm({
  mutedNotificationTypes,
  mutedMentionTypes,
  hasDiscordId,
}: {
  mutedNotificationTypes: NotificationType[];
  mutedMentionTypes: NotificationType[];
  hasDiscordId: boolean;
}) {
  const [mutedInApp, setMutedInApp] = useState(() => new Set(mutedNotificationTypes));
  const [mutedMention, setMutedMention] = useState(() => new Set(mutedMentionTypes));
  const [isPending, startTransition] = useTransition();

  function toggle(
    setter: typeof setMutedInApp,
    type: NotificationType,
    on: boolean,
  ) {
    setter((prev) => {
      const next = new Set(prev);
      if (on) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function handleSave() {
    // Built from state rather than the DOM, so the mention boxes keep their
    // values even while they're disabled for lack of a Discord ID.
    const formData = new FormData();
    for (const { items } of NOTIFICATION_PREF_GROUPS) {
      for (const { type } of items) {
        if (!mutedInApp.has(type)) formData.append("inApp", type);
        if (MENTION_EVENT_TYPES.includes(type) && !mutedMention.has(type)) {
          formData.append("mention", type);
        }
      }
    }

    startTransition(async () => {
      try {
        await updateNotificationPrefs(formData);
        toast.success("Notification settings saved.");
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <table className="w-full text-sm">
        {NOTIFICATION_PREF_GROUPS.map((group, i) => (
          <tbody key={group.heading}>
            <tr>
              <th scope="col" className={`pb-2 text-left font-medium ${i > 0 ? "pt-5" : ""}`}>
                {group.heading}
              </th>
              <th scope="col" className={`w-16 pb-2 text-center text-xs font-normal text-muted-foreground ${i > 0 ? "pt-5" : ""}`}>
                In app
              </th>
              <th scope="col" className={`w-16 pb-2 text-center text-xs font-normal text-muted-foreground ${i > 0 ? "pt-5" : ""}`}>
                Discord ping
              </th>
            </tr>
            {group.items.map(({ type, label }) => {
              const mentionable = MENTION_EVENT_TYPES.includes(type);
              return (
                <tr key={type} className="border-t">
                  <td className="py-2 pr-2">{label}</td>
                  <td className="py-2 text-center">
                    <Toggle
                      label={`${label}: in app`}
                      checked={!mutedInApp.has(type)}
                      onChange={(on) => toggle(setMutedInApp, type, on)}
                    />
                  </td>
                  <td className="py-2 text-center">
                    {mentionable ? (
                      <Toggle
                        label={`${label}: Discord ping`}
                        checked={!mutedMention.has(type)}
                        disabled={!hasDiscordId}
                        onChange={(on) => toggle(setMutedMention, type, on)}
                      />
                    ) : (
                      <span className="text-muted-foreground" aria-label="Never pinged">
                        –
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
      <p className="text-xs text-muted-foreground">
        {hasDiscordId
          ? "Discord ping controls whether you're @mentioned when the campaign's Discord channel gets the post. The post itself is set up by the DM."
          : "Add your Discord user ID above to be @mentioned in your campaigns' Discord channels."}
      </p>
      <Button onClick={handleSave} disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  );
}
