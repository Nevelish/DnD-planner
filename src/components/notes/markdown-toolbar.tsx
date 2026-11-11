"use client";

import type { RefObject } from "react";
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { applyMarkdownAction, type MarkdownAction } from "@/lib/markdownToolbar";

const BUTTONS: { action: MarkdownAction; icon: typeof BoldIcon; label: string }[] = [
  { action: "bold", icon: BoldIcon, label: "Bold" },
  { action: "italic", icon: ItalicIcon, label: "Italic" },
  { action: "h1", icon: Heading1Icon, label: "Heading 1" },
  { action: "h2", icon: Heading2Icon, label: "Heading 2" },
  { action: "h3", icon: Heading3Icon, label: "Heading 3" },
  { action: "bulletList", icon: ListIcon, label: "Bullet list" },
  { action: "numberList", icon: ListOrderedIcon, label: "Numbered list" },
  { action: "quote", icon: QuoteIcon, label: "Quote" },
  { action: "code", icon: CodeIcon, label: "Code" },
  { action: "link", icon: LinkIcon, label: "Link" },
];

export function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}) {
  function handleAction(action: MarkdownAction) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const result = applyMarkdownAction(action, {
      value,
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
    onChange(result.value);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.start, result.end);
    });
  }

  return (
    <div className="flex flex-wrap gap-0.5 rounded-t-md border border-b-0 bg-muted/40 p-1">
      {BUTTONS.map(({ action, icon: Icon, label }) => (
        <Button
          key={action}
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          title={label}
          aria-label={label}
          onClick={() => handleAction(action)}
        >
          <Icon className="size-4" />
        </Button>
      ))}
    </div>
  );
}
