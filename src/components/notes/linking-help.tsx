"use client";

import { useRef, useState } from "react";
import { CircleHelpIcon, FileSymlinkIcon } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>;
}

/** A "?" next to the notebook editor explaining [[links]]. Opens on hover
 * with a mouse, and on tap or Enter everywhere else. It never takes focus
 * from the editor, so hovering mid-sentence doesn't interrupt typing. */
export function LinkingHelp() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const lastPointer = useRef<string>("");

  const hoverOpen = (e: React.PointerEvent) => {
    lastPointer.current = e.pointerType;
    if (e.pointerType !== "mouse") return;
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="How linking pages works"
          onPointerEnter={hoverOpen}
          onPointerLeave={hoverClose}
          onPointerDown={(e) => (lastPointer.current = e.pointerType)}
          onClick={(e) => {
            // With a mouse, hovering already opened it: a click shouldn't
            // toggle it shut again.
            if (lastPointer.current === "mouse") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <CircleHelpIcon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 text-sm"
        onPointerEnter={hoverOpen}
        onPointerLeave={hoverClose}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <h3 className="mb-2 font-semibold">Linking pages</h3>
        <ul className="flex list-disc flex-col gap-1.5 pl-4 marker:text-muted-foreground">
          <li>
            <Code>[[Baron Vex]]</Code> links to the page called Baron Vex. Capitals don&apos;t
            matter.
          </li>
          <li>
            <Code>[[Baron Vex|the baron]]</Code> links it with your own text.
          </li>
          <li>
            Type <Code>[[</Code> for suggestions: <kbd>↑</kbd> <kbd>↓</kbd> to choose, <kbd>Enter</kbd>{" "}
            to insert, <kbd>Esc</kbd> to close. Or use the{" "}
            <FileSymlinkIcon className="inline size-3.5 align-[-2px]" aria-label="link to a page" /> button
            in the toolbar.
          </li>
          <li>
            A <span className="underline decoration-dashed underline-offset-2">dashed link</span> means
            the page doesn&apos;t exist yet. Click it in Preview to create it.
          </li>
          <li>Links are clickable in Preview. &ldquo;Linked from&rdquo; under a page shows what links to it.</li>
          <li>Renaming a page updates the links to it.</li>
          <li>Session prep can link to pages, but can&apos;t be linked to itself.</li>
        </ul>
        <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">
          Formatting: <Code>**bold**</Code> <Code>*italic*</Code> <Code>## Heading</Code>{" "}
          <Code>- list</Code>, or use the toolbar.
        </p>
      </PopoverContent>
    </Popover>
  );
}
