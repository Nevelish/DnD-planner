"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { upsertCampaignNote, upsertPlayerNote } from "@/lib/actions/notes";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/notes/markdown-renderer";
import { MarkdownToolbar } from "@/components/notes/markdown-toolbar";
import type { CampaignNoteType } from "@prisma/client";

export function NotesEditor({
  campaignId,
  type,
  initialContent,
  initialUpdatedAt,
  placeholder,
  save,
  onSaved,
  onCancel,
}: {
  campaignId: string;
  /** Omit for the current user's own private note (PlayerNote). */
  type?: CampaignNoteType;
  initialContent: string;
  /** ISO timestamp of the loaded note, or undefined if it doesn't exist yet. */
  initialUpdatedAt?: string;
  placeholder?: string;
  /** Overrides where the note is saved (e.g. a session recap). */
  save?: (formData: FormData) => Promise<{ updatedAt: string }>;
  onSaved?: (saved: { content: string; updatedAt: string }) => void;
  /** Shows a Cancel button next to Save. */
  onCancel?: () => void;
}) {
  const [content, setContent] = useState(initialContent);
  const [lastSavedContent, setLastSavedContent] = useState(initialContent);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(initialUpdatedAt);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = content !== lastSavedContent;

  // Warn on tab close/refresh/navigating away by URL so an edit made but
  // not saved isn't silently lost — the editor has no separate read-only
  // view, so there's otherwise nothing stopping someone from typing,
  // getting distracted, and closing the tab.
  useEffect(() => {
    if (!isDirty) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  function handleSave() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("content", content);
        if (expectedUpdatedAt) {
          formData.set("expectedUpdatedAt", expectedUpdatedAt);
        }
        const result = save
          ? await save(formData)
          : type
            ? await upsertCampaignNote(campaignId, type, formData)
            : await upsertPlayerNote(campaignId, formData);
        setExpectedUpdatedAt(result.updatedAt);
        setLastSavedContent(content);
        toast.success("Saved.");
        onSaved?.({ content, updatedAt: result.updatedAt });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <Tabs defaultValue="edit">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <div className="flex gap-2">
          {onCancel && (
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => {
                if (!isDirty || window.confirm("Discard your changes?")) onCancel();
              }}
            >
              Cancel
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      <TabsContent value="edit">
        <MarkdownToolbar textareaRef={textareaRef} value={content} onChange={setContent} />
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={14}
          placeholder={placeholder ?? "Markdown supported — headings, lists, bold, links…"}
          className="rounded-t-none font-mono text-sm"
        />
      </TabsContent>
      <TabsContent value="preview">
        <div className="min-h-[21rem] rounded-md border p-4">
          <MarkdownRenderer content={content} />
        </div>
      </TabsContent>
    </Tabs>
  );
}
