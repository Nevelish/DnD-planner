"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, ScrollTextIcon } from "lucide-react";

import { saveRecap } from "@/lib/actions/recap";
import { Button } from "@/components/ui/button";
import { MarkdownRenderer } from "@/components/notes/markdown-renderer";
import { NotesEditor } from "@/components/notes/notes-editor";

export function RecapSection({
  campaignId,
  proposalId,
  initialContent,
  initialUpdatedAt,
  initialAuthorName,
  currentUserName,
}: {
  campaignId: string;
  proposalId: string;
  initialContent: string | null;
  initialUpdatedAt: string | null;
  initialAuthorName: string | null;
  currentUserName: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  // Kept locally so opening the editor again right after a save starts
  // from what was just saved, without waiting for the page to refresh.
  const [recap, setRecap] = useState({
    content: initialContent ?? "",
    updatedAt: initialUpdatedAt ?? undefined,
    authorName: initialAuthorName,
  });

  if (editing) {
    return (
      <NotesEditor
        initialContent={recap.content}
        initialUpdatedAt={recap.updatedAt}
        placeholder={"What happened? Where did the party go, who did they meet, what did they find — and how did it end?\n\nMarkdown works: **bold**, lists, headings…"}
        save={(formData) => saveRecap(campaignId, proposalId, formData)}
        onSaved={({ content, updatedAt }) => {
          setRecap({ content, updatedAt, authorName: currentUserName });
          setEditing(false);
          router.refresh();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  if (!recap.content.trim()) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-md border border-dashed p-4 text-sm">
        <p className="text-muted-foreground">
          No recap yet. Anyone in the party can write one, which helps whoever
          missed it, and everyone else next time.
        </p>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <ScrollTextIcon /> Write the recap
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <MarkdownRenderer content={recap.content} />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
        <span>{recap.authorName ? `Last edited by ${recap.authorName}` : " "}</span>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          <PencilIcon /> Edit recap
        </Button>
      </div>
    </div>
  );
}
