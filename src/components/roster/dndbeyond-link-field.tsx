"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Link2Icon, RefreshCwIcon, Link2OffIcon } from "lucide-react";

import { linkDndBeyond, unlinkDndBeyond } from "@/lib/actions/character";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { DndBeyondSyncStatus } from "@prisma/client";

const statusCopy: Record<DndBeyondSyncStatus, { label: string; variant: "secondary" | "success" | "destructive" | "outline" }> = {
  NOT_LINKED: { label: "Not linked", variant: "outline" },
  PENDING: { label: "Syncing…", variant: "secondary" },
  SUCCESS: { label: "Synced", variant: "success" },
  FAILED: { label: "Sync failed", variant: "destructive" },
  PRIVATE: { label: "Sheet is private", variant: "destructive" },
};

export function DndBeyondLinkField({
  campaignId,
  characterId,
  dndBeyondUrl,
  syncStatus,
}: {
  campaignId: string;
  characterId: string;
  dndBeyondUrl: string | null;
  syncStatus: DndBeyondSyncStatus;
}) {
  const [url, setUrl] = useState(dndBeyondUrl ?? "");
  const [isPending, startTransition] = useTransition();

  function handleLink() {
    if (!url.trim()) return;
    startTransition(async () => {
      try {
        await linkDndBeyond(campaignId, characterId, url.trim());
        toast.success("Character synced from D&D Beyond.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't sync that sheet.");
      }
    });
  }

  function handleUnlink() {
    startTransition(async () => {
      try {
        await unlinkDndBeyond(campaignId, characterId);
        setUrl("");
        toast.success("Unlinked. Your character details stay as they are.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">D&amp;D Beyond</span>
        <Badge variant={statusCopy[syncStatus].variant}>{statusCopy[syncStatus].label}</Badge>
      </div>
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.dndbeyond.com/characters/12345678"
          disabled={isPending}
        />
        {dndBeyondUrl ? (
          <>
            <Button type="button" size="icon" variant="outline" disabled={isPending} onClick={handleLink}>
              <RefreshCwIcon />
            </Button>
            <Button type="button" size="icon" variant="ghost" disabled={isPending} onClick={handleUnlink}>
              <Link2OffIcon />
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" disabled={isPending} onClick={handleLink}>
            <Link2Icon /> Link
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Best-effort: only works if the sheet is public on D&amp;D Beyond. You can
        always edit the fields above by hand instead.
      </p>
    </div>
  );
}
