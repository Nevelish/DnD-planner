"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EyeIcon } from "lucide-react";

import { revealNotebookPage } from "@/lib/actions/notebook";
import { normalizeTitle, wikiLinkTitles } from "@/lib/wikiLinks";
import { errorMessage } from "@/lib/userError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Reveals a DM notebook page to the party. The DM reviews (and can edit)
 * the title and text the players will get first; their own page is left as
 * it is.
 */
export function RevealDialog({
  campaignId,
  page,
  partyTitles,
  existing,
  open,
  onOpenChange,
}: {
  campaignId: string;
  page: { id: string; title: string; content: string };
  /** Titles of the party notebook's pages, to tell which links would be hidden. */
  partyTitles: string[];
  /** The party's copy, if this page was revealed before. */
  existing: { partyTitle: string; editedSince: boolean } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(existing?.partyTitle ?? page.title);
  const [content, setContent] = useState(page.content);
  const [unlinkHidden, setUnlinkHidden] = useState(true);

  // Links whose page the party won't have, which would show its title.
  const hiddenLinks = useMemo(() => {
    const visible = new Set(
      [...partyTitles.filter((t) => normalizeTitle(t) !== normalizeTitle(existing?.partyTitle ?? "")), title].map(normalizeTitle),
    );
    return wikiLinkTitles(content).filter((t) => !visible.has(normalizeTitle(t)));
  }, [content, partyTitles, title, existing]);
  const pictures = (content.match(/\/api\/notebook-images\//g) ?? []).length;

  function reveal() {
    const formData = new FormData();
    formData.set("title", title);
    formData.set("content", content);
    if (unlinkHidden) formData.set("unlinkHidden", "on");
    startTransition(async () => {
      try {
        const { partyPageId, updated } = await revealNotebookPage(campaignId, page.id, formData);
        onOpenChange(false);
        toast.success(updated ? "The party's copy is updated." : "Revealed! The party can see it now.", {
          action: {
            label: "Open",
            onClick: () => router.push(`/campaigns/${campaignId}/notes/party?page=${partyPageId}`),
          },
        });
        router.refresh();
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? "Update the party's copy" : "Reveal to the party"}</DialogTitle>
          <DialogDescription>
            The party gets a copy of this page in their notebook. Take out anything they shouldn&apos;t
            know yet: changes here only affect their copy, never your page.
          </DialogDescription>
        </DialogHeader>

        {existing?.editedSince && (
          <p role="alert" className="rounded-md border border-amber-600/40 bg-amber-500/10 p-3 text-sm">
            Players have changed their copy since you last revealed it. Updating it replaces their
            changes with this text.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reveal-title">Title for the party</Label>
          <Input id="reveal-title" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reveal-content">What the party will see</Label>
          <Textarea
            id="reveal-content"
            rows={12}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="max-h-[45vh] font-mono text-sm"
          />
        </div>

        {hiddenLinks.length > 0 && (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={unlinkHidden}
              onChange={(e) => setUnlinkHidden(e.target.checked)}
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Turn links to pages the party can&apos;t see into plain text</span>
              <span className="text-muted-foreground">
                {plural(hiddenLinks.length, "link", "links")}: {hiddenLinks.join(", ")}. Left as
                links, they&apos;d show the party those page titles.
              </span>
            </span>
          </label>
        )}
        {pictures > 0 && (
          <p className="text-sm text-muted-foreground">
            {plural(pictures, "picture", "pictures")} will be shared with the party. Your own copies stay
            DM-only.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isPending || !title.trim()} onClick={reveal}>
            <EyeIcon /> {isPending ? "Revealing…" : existing ? "Update the party's copy" : "Reveal to the party"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
