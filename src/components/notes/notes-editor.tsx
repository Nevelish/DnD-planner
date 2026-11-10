"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { upsertCampaignNote } from "@/lib/actions/notes";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/notes/markdown-renderer";
import type { CampaignNoteType } from "@prisma/client";

export function NotesEditor({
  campaignId,
  type,
  initialContent,
}: {
  campaignId: string;
  type: CampaignNoteType;
  initialContent: string;
}) {
  const [content, setContent] = useState(initialContent);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("content", content);
        await upsertCampaignNote(campaignId, type, formData);
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
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={14}
          placeholder="Markdown supported — headings, lists, bold, links…"
          className="font-mono text-sm"
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
