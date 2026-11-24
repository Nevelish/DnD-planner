"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { NotebookPenIcon, PencilIcon } from "lucide-react";

import { ensureSessionPrep, saveDmPage } from "@/lib/actions/dmPages";
import { Button } from "@/components/ui/button";
import { NotebookMarkdown, type LinkablePage } from "@/components/notes/notebook-markdown";
import { NotesEditor } from "@/components/notes/notes-editor";

type Prep = { id: string; content: string; updatedAt: string };

/** The DM's prep for one session, on that session's page. Starts from the
 * session-prep template the first time it's opened. */
export function SessionPrepSection({
  campaignId,
  proposalId,
  initialPrep,
  linkablePages,
}: {
  campaignId: string;
  proposalId: string;
  initialPrep: Prep | null;
  /** Notebook pages that [[links]] in the prep can point at. */
  linkablePages: LinkablePage[];
}) {
  const [prep, setPrep] = useState<Prep | null>(initialPrep);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function startPrep() {
    startTransition(async () => {
      try {
        setPrep(await ensureSessionPrep(campaignId, proposalId));
        setEditing(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  if (!prep) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-4 text-sm">
        <p className="text-muted-foreground">
          Plan this session: strong start, scenes, secrets &amp; clues, NPCs,
          monsters and rewards.
        </p>
        <Button size="sm" variant="outline" onClick={startPrep} disabled={isPending}>
          <NotebookPenIcon /> Start prep
        </Button>
      </div>
    );
  }

  if (editing) {
    return (
      <NotesEditor
        key={prep.id}
        campaignId={campaignId}
        initialContent={prep.content}
        initialUpdatedAt={prep.updatedAt}
        save={(formData) => saveDmPage(campaignId, prep.id, formData)}
        onSaved={({ content, updatedAt }) => {
          setPrep({ ...prep, content, updatedAt });
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
        linkTargets={linkablePages.map((p) => p.title)}
        renderPreview={(content) => (
          <NotebookMarkdown campaignId={campaignId} content={content} pages={linkablePages} />
        )}
        placeholder={"Markdown works. Link notebook pages with [[Page title]]."}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <NotebookMarkdown campaignId={campaignId} content={prep.content} pages={linkablePages} />
      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
        <Button asChild size="sm" variant="ghost">
          <Link href={`/campaigns/${campaignId}/notes?page=${prep.id}`}>Open in notebook</Link>
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <PencilIcon /> Edit prep
        </Button>
      </div>
    </div>
  );
}
