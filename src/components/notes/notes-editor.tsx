"use client";

import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { LinkIcon, XIcon } from "lucide-react";

import { upsertCampaignNote, upsertPlayerNote } from "@/lib/actions/notes";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarkdownRenderer } from "@/components/notes/markdown-renderer";
import { MarkdownToolbar } from "@/components/notes/markdown-toolbar";
import { LinkingHelp } from "@/components/notes/linking-help";
import {
  findUnlinkedMentions,
  linkMention,
  normalizeTitle,
  openWikiLinkQuery,
  wikiLinkTargets,
} from "@/lib/wikiLinks";
import { caretCoordinates } from "@/lib/caretCoordinates";
import type { CampaignNoteType } from "@prisma/client";

const MAX_SUGGESTIONS = 6;
const MAX_MENTION_CHIPS = 3;
const SUGGESTION_WIDTH = 256;

export function NotesEditor({
  campaignId,
  type,
  initialContent,
  initialUpdatedAt,
  placeholder,
  save,
  onSaved,
  onCancel,
  onDirtyChange,
  linkTargets,
  renderPreview,
  defaultTab = "edit",
  linkHelp = "dm",
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
  /** Lets a parent warn before navigating away from unsaved changes (the
   * beforeunload guard below only covers closing or reloading the tab). */
  onDirtyChange?: (dirty: boolean) => void;
  /** Page titles to suggest after typing [[ (DM notebook only). */
  linkTargets?: string[];
  /** Replaces the plain markdown preview (e.g. to resolve [[links]]). */
  renderPreview?: (content: string) => ReactNode;
  defaultTab?: "edit" | "preview";
  /** Which notebook the "?" help describes. */
  linkHelp?: "dm" | "player";
}) {
  const [content, setContent] = useState(initialContent);
  const [lastSavedContent, setLastSavedContent] = useState(initialContent);
  const [expectedUpdatedAt, setExpectedUpdatedAt] = useState(initialUpdatedAt);
  const [isPending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const listboxId = useId();

  // [[link]] autocomplete: the partial title being typed, if any.
  const [linkQuery, setLinkQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(() => {
    if (linkQuery === null || !linkTargets) return [];
    const q = linkQuery.trim().toLowerCase();
    const starts = linkTargets.filter((t) => t.toLowerCase().startsWith(q));
    const contains = linkTargets.filter(
      (t) => !t.toLowerCase().startsWith(q) && t.toLowerCase().includes(q),
    );
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [linkQuery, linkTargets]);
  const showSuggestions = linkTargets !== undefined && linkQuery !== null;

  // Where the [[ suggestions pop up: just under the caret.
  const [popupAt, setPopupAt] = useState({ top: 0, left: 0 });

  function refreshLinkQuery(value: string, caret: number) {
    if (!linkTargets) return;
    const q = openWikiLinkQuery(value.slice(0, caret));
    setLinkQuery(q);
    if (q !== linkQuery) setActiveIndex(0);
    const textarea = textareaRef.current;
    if (q !== null && textarea) {
      const { top, left, lineHeight } = caretCoordinates(textarea, caret);
      setPopupAt({
        top: top - textarea.scrollTop + lineHeight + 4,
        left: Math.max(4, Math.min(left, textarea.clientWidth - SUGGESTION_WIDTH - 4)),
      });
    }
  }

  // Plain-text mentions of other pages, offered as "Link X?" chips. Worked
  // out from a deferred copy of the text so typing never waits on it.
  const deferredContent = useDeferredValue(content);
  const [dismissedMentions, setDismissedMentions] = useState<Set<string>>(() => new Set());
  const mentionChips = useMemo(() => {
    if (!linkTargets) return [];
    // Like a wiki: once a page is linked somewhere on this page, later
    // plain mentions of it don't need a link too.
    const linked = wikiLinkTargets(deferredContent);
    return findUnlinkedMentions(deferredContent, linkTargets)
      .filter((m) => !linked.has(normalizeTitle(m.title)))
      .filter((m) => !dismissedMentions.has(normalizeTitle(m.title)))
      .slice(0, MAX_MENTION_CHIPS);
  }, [deferredContent, linkTargets, dismissedMentions]);

  function linkPlainMention(title: string) {
    const mention = findUnlinkedMentions(content, [title])[0];
    if (mention) setContent(linkMention(content, mention));
  }

  function acceptSuggestion(title: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const caret = textarea.selectionStart;
    const before = content.slice(0, caret);
    const after = content.slice(caret);
    const start = before.lastIndexOf("[[");
    if (start < 0) return;
    // The toolbar button already typed the closing ]].
    const next = `${before.slice(0, start)}[[${title}]]${after.startsWith("]]") ? after.slice(2) : after}`;
    const pos = start + title.length + 4;
    // Update the text and move the caret in one go, so keys typed straight
    // after accepting land after the link rather than at the old position.
    flushSync(() => {
      setContent(next);
      setLinkQuery(null);
    });
    textarea.focus();
    textarea.setSelectionRange(pos, pos);
  }

  function startPageLink() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart: start, selectionEnd: end } = textarea;
    const selected = content.slice(start, end);
    const next = `${content.slice(0, start)}[[${selected}]]${content.slice(end)}`;
    const pos = start + 2 + selected.length;
    flushSync(() => {
      setContent(next);
      refreshLinkQuery(next, pos);
    });
    textarea.focus();
    textarea.setSelectionRange(pos, pos);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showSuggestions) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setLinkQuery(null);
    } else if (suggestions.length > 0 && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i + step + suggestions.length) % suggestions.length);
    } else if (suggestions.length > 0 && (e.key === "Enter" || e.key === "Tab")) {
      e.preventDefault();
      acceptSuggestion(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
    }
  }

  const isDirty = content !== lastSavedContent;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

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
    <Tabs defaultValue={defaultTab}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          {linkTargets && <LinkingHelp kind={linkHelp} />}
        </div>
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
        <MarkdownToolbar
          textareaRef={textareaRef}
          value={content}
          onChange={setContent}
          onPageLink={linkTargets ? startPageLink : undefined}
        />
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              refreshLinkQuery(e.target.value, e.target.selectionStart);
            }}
            onKeyDown={handleKeyDown}
            onKeyUp={(e) => {
              if (!["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) {
                refreshLinkQuery(e.currentTarget.value, e.currentTarget.selectionStart);
              }
            }}
            onClick={(e) => refreshLinkQuery(e.currentTarget.value, e.currentTarget.selectionStart)}
            onBlur={() => setLinkQuery(null)}
            onScroll={(e) => {
              if (showSuggestions)
                refreshLinkQuery(e.currentTarget.value, e.currentTarget.selectionStart);
            }}
            rows={14}
            placeholder={placeholder ?? "Markdown supported — headings, lists, bold, links…"}
            className="rounded-t-none font-mono text-sm"
            aria-autocomplete={linkTargets ? "list" : undefined}
            aria-controls={showSuggestions ? listboxId : undefined}
            aria-expanded={linkTargets ? showSuggestions : undefined}
          />
          {showSuggestions && (
            <div
              className="absolute z-20 rounded-md border bg-popover p-1 text-sm shadow-md"
              style={{
                top: popupAt.top,
                left: popupAt.left,
                width: SUGGESTION_WIDTH,
              }}
            >
              {suggestions.length > 0 ? (
                <ul id={listboxId} role="listbox" aria-label="Link to a page">
                  {suggestions.map((title, i) => (
                    <li
                      key={title}
                      role="option"
                      aria-selected={i === activeIndex}
                      // mousedown, not click: keep focus in the textarea
                      onMouseDown={(e) => {
                        e.preventDefault();
                        acceptSuggestion(title);
                      }}
                      className={`cursor-pointer rounded-sm px-2 py-1 ${i === activeIndex ? "bg-muted font-medium" : ""}`}
                    >
                      {title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-2 py-1 text-muted-foreground">
                  {linkQuery?.trim()
                    ? `No page called “${linkQuery.trim()}” yet. Close it with ]] and you can create it from the preview.`
                    : "No other pages to link to yet. Type a title and close it with ]]."}
                </p>
              )}
            </div>
          )}
        </div>
        {!showSuggestions && mentionChips.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
            {mentionChips.map((m) => (
              <span
                key={m.title}
                className="inline-flex items-center rounded-full border bg-muted/40"
              >
                <button
                  type="button"
                  onClick={() => linkPlainMention(m.title)}
                  className="inline-flex items-center gap-1.5 rounded-l-full py-0.5 pr-1 pl-2.5 hover:bg-muted"
                >
                  <LinkIcon className="size-3.5 text-muted-foreground" />
                  Link “{m.text}”?
                </button>
                <button
                  type="button"
                  aria-label={`Don't suggest linking ${m.title}`}
                  onClick={() =>
                    setDismissedMentions((prev) => new Set(prev).add(normalizeTitle(m.title)))
                  }
                  className="rounded-r-full py-0.5 pr-2 pl-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </TabsContent>
      <TabsContent value="preview">
        <div className="min-h-[21rem] rounded-md border p-4">
          {renderPreview ? renderPreview(content) : <MarkdownRenderer content={content} />}
        </div>
      </TabsContent>
    </Tabs>
  );
}
