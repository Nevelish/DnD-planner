"use client";

import { useRef, useState, useTransition } from "react";
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
  placeholder,
}: {
  campaignId: string;
  /** Omit for the current user's own private note (PlayerNote). */
  type?: CampaignNoteType;
  initialContent: string;
  placeholder?: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSave() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("content", content);
        if (type) {
          await upsertCampaignNote(campaignId, type, formData);
        } else {
          await upsertPlayerNote(campaignId, formData);
        }
        toast.success("Saved.");
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
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
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
