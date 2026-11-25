"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserMinusIcon } from "lucide-react";

import { removeMember, leaveCampaign } from "@/lib/actions/campaign";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { AvatarUser } from "@/lib/avatar";
import { errorMessage } from "@/lib/userError";

type MemberRow = {
  id: string;
  role: "DM" | "PLAYER";
  user: AvatarUser & { id: string; name: string | null; email: string | null };
};

export function MemberList({
  campaignId,
  members,
  currentUserId,
  isDM,
}: {
  campaignId: string;
  members: MemberRow[];
  currentUserId: string;
  isDM: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRemove(memberId: string) {
    startTransition(async () => {
      try {
        await removeMember(campaignId, memberId);
        toast.success("Member removed.");
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  function handleLeave() {
    startTransition(async () => {
      try {
        await leaveCampaign(campaignId);
        toast.success("You left the campaign.");
        router.push("/campaigns");
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {members.map((member) => {
        const isSelf = member.user.id === currentUserId;
        return (
          <li
            key={member.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <UserAvatar user={member.user} className="size-9" />
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">
                  {member.user.name ?? member.user.email}
                  {isSelf && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      (you)
                    </span>
                  )}
                </span>
                {member.user.email && member.user.name && (
                  <span className="truncate text-xs text-muted-foreground">
                    {member.user.email}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={member.role === "DM" ? "default" : "secondary"}>
                {member.role === "DM" ? "DM" : "Player"}
              </Badge>
              {isDM && member.role !== "DM" && (
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => handleRemove(member.id)}
                  title="Remove from campaign"
                >
                  <UserMinusIcon className="text-destructive" />
                </Button>
              )}
              {!isDM && isSelf && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={handleLeave}
                >
                  Leave
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
