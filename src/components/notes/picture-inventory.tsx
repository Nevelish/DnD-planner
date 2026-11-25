"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";

import { deleteNotebookImage, deleteUnusedNotebookImages } from "@/lib/actions/notebookImages";
import type { InventoryPicture } from "@/lib/notebookImages";
import { errorMessage } from "@/lib/userError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const isUnused = (p: InventoryPicture) => p.usedOn.length === 0 && !p.usedPrivately;

export function PictureInventory({
  campaignId,
  pictures,
  privateCount,
  privateBytes,
  usedBytes,
  limitBytes,
}: {
  campaignId: string;
  pictures: InventoryPicture[];
  privateCount: number;
  privateBytes: number;
  usedBytes: number;
  limitBytes: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [onlyUnused, setOnlyUnused] = useState(false);
  const unused = useMemo(() => pictures.filter(isUnused), [pictures]);
  const shown = onlyUnused ? unused : pictures;
  const percent = Math.min(100, (usedBytes / limitBytes) * 100);

  function run(action: () => Promise<unknown>, success: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  function remove(picture: InventoryPicture) {
    const warning = picture.usedOn.length
      ? `This picture is used on ${picture.usedOn.map((p) => `"${p.title}"`).join(", ")}. It will show as removed there. Delete it?`
      : picture.usedPrivately
        ? "A player uses this picture in their private notebook. It will show as removed there. Delete it?"
        : "Delete this picture?";
    if (!window.confirm(warning)) return;
    run(() => deleteNotebookImage(campaignId, picture.id), "Picture deleted.");
  }

  function removeUnused() {
    if (!window.confirm(`Delete ${unused.length} unused ${unused.length === 1 ? "picture" : "pictures"}? No page uses them.`)) return;
    run(() => deleteUnusedNotebookImages(campaignId), "Unused pictures deleted.");
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Storage" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span>
            <span className="font-medium">{formatBytes(usedBytes)}</span>{" "}
            <span className="text-muted-foreground">of {formatBytes(limitBytes)} used</span>
          </span>
          {privateCount > 0 && (
            <span className="text-muted-foreground">
              Includes {privateCount} {privateCount === 1 ? "picture" : "pictures"} ({formatBytes(privateBytes)}) in
              players&apos; private notebooks, which only they can see.
            </span>
          )}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-label="Picture storage used" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
      </section>

      {pictures.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pictures yet. Add maps, handouts and portraits from the editor in your notebook or
          the party&apos;s.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={onlyUnused}
                onChange={(e) => setOnlyUnused(e.target.checked)}
              />
              Only show unused ({unused.length})
            </label>
            <Button size="sm" variant="outline" disabled={isPending || unused.length === 0} onClick={removeUnused}>
              <Trash2Icon /> Delete all unused
            </Button>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Pictures">
            {shown.map((picture) => (
              <li key={picture.id} className="flex flex-col overflow-hidden rounded-lg border bg-card">
                <a href={picture.url} target="_blank" rel="noopener noreferrer" className="block bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, served by the app's own route */}
                  <img src={picture.url} alt="" loading="lazy" className="aspect-video w-full object-contain" />
                </a>
                <div className="flex flex-1 flex-col gap-2 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{picture.notebook === "DM" ? "DM notebook" : "Party notebook"}</Badge>
                    {isUnused(picture) && <Badge variant="warning">Not used on any page</Badge>}
                  </div>
                  <p className="text-muted-foreground">
                    {formatBytes(picture.size)} · {picture.width}×{picture.height}
                    {picture.addedBy ? ` · added by ${picture.addedBy}` : ""}
                  </p>
                  {picture.usedOn.length > 0 && (
                    <p>
                      Used on{" "}
                      {picture.usedOn.map((page, i) => (
                        <span key={page.href}>
                          {i > 0 && ", "}
                          <Link href={page.href} className="underline underline-offset-2">
                            {page.title}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                  {picture.usedPrivately && (
                    <p className="text-muted-foreground">Also used in a player&apos;s private notebook.</p>
                  )}
                  <div className="mt-auto flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() => remove(picture)}
                      aria-label={`Delete picture added ${new Date(picture.createdAt).toLocaleString()}`}
                    >
                      <Trash2Icon /> Delete
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
