"use client";

import { createContext, useContext, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { createNotebookPage, type NotebookName } from "@/lib/actions/notebook";
import { linkifyWikiLinks, normalizeTitle, wikiTargetFromHref } from "@/lib/wikiLinks";
import { errorMessage } from "@/lib/userError";

export type LinkablePage = { id: string; title: string };

// The source line of the checklist item being rendered, for its checkbox.
const TaskLine = createContext<number | null>(null);

function TaskCheckbox({ checked, onToggle }: { checked: boolean; onToggle?: (line: number) => void }) {
  const line = useContext(TaskLine);
  const clickable = !!onToggle && line !== null;
  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={!clickable}
      onChange={() => clickable && onToggle(line)}
      className={`me-1.5 align-middle ${clickable ? "cursor-pointer accent-primary" : ""}`}
    />
  );
}

/**
 * Markdown for DM notebook pages: like MarkdownRenderer, plus [[Page]]
 * links. A link to an existing page opens it; a link to a page that
 * doesn't exist yet is shown dashed, and clicking it creates the page.
 */
export function NotebookMarkdown({
  campaignId,
  content,
  pages,
  confirmLeave,
  notebook = "mine",
  basePath,
  onToggleTask,
}: {
  campaignId: string;
  content: string;
  pages: LinkablePage[];
  /** Returns false to stay put, e.g. when there are unsaved changes. */
  confirmLeave?: () => boolean;
  /** Which notebook the pages (and any page created from a link) are in. */
  notebook?: NotebookName;
  /** That notebook's page, e.g. /campaigns/x/notes or …/notes/party. */
  basePath?: string;
  /** Makes checklist boxes clickable: called with the item's source line. */
  onToggleTask?: (line: number) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const byTitle = useMemo(() => {
    const map = new Map<string, string>();
    // pages arrive newest first; keep the first (newest) for duplicate titles
    for (const p of pages)
      if (!map.has(normalizeTitle(p.title))) map.set(normalizeTitle(p.title), p.id);
    return map;
  }, [pages]);
  const markdown = useMemo(() => linkifyWikiLinks(content), [content]);

  if (!content.trim()) {
    return <p className="text-sm text-muted-foreground">Nothing here yet.</p>;
  }

  const pageHref = (id: string) => `${basePath ?? `/campaigns/${campaignId}/notes`}?page=${id}`;

  function createAndOpen(title: string) {
    if (confirmLeave && !confirmLeave()) return;
    const formData = new FormData();
    formData.set("title", title);
    startTransition(async () => {
      try {
        const { pageId } = await createNotebookPage(campaignId, notebook, formData);
        toast.success(`Created "${title}".`);
        router.push(`${pageHref(pageId)}&edit=1`);
      } catch (e) {
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    // Checklists: the box replaces the bullet; nested ones still indent.
    <div className="prose prose-sm dark:prose-invert max-w-none [&_li.task-list-item]:list-none [&_li_ul.contains-task-list]:ps-6 [&_ul.contains-task-list]:ps-1">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // [[links]] become ordinary links before parsing, which changes
          // lengths but never adds lines, so an item's line number is the
          // same in the original text.
          li({ node, children, className }) {
            const line = className?.includes("task-list-item") ? (node?.position?.start.line ?? null) : null;
            return (
              <li className={className}>
                <TaskLine.Provider value={line}>{children}</TaskLine.Provider>
              </li>
            );
          },
          // Pictures open full size in a new tab. Shown with a plain <img>:
          // they're private, served by the app's own route to signed-in
          // viewers, which next/image's optimizer would bypass.
          img({ src, alt }) {
            if (typeof src !== "string" || !src) return null;
            return (
              <a href={src} target="_blank" rel="noopener noreferrer" className="my-3 block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={alt ?? ""}
                  loading="lazy"
                  className="mx-auto my-0 max-h-[36rem] w-auto max-w-full rounded-md border"
                />
              </a>
            );
          },
          input({ type, checked }) {
            if (type !== "checkbox") return null;
            return <TaskCheckbox checked={!!checked} onToggle={onToggleTask} />;
          },
          a({ href, children }) {
            const target = wikiTargetFromHref(href);
            if (target === null) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              );
            }
            const id = byTitle.get(normalizeTitle(target));
            if (id) {
              return (
                <Link
                  href={pageHref(id)}
                  onClick={(e) => {
                    if (confirmLeave && !confirmLeave()) e.preventDefault();
                  }}
                >
                  {children}
                </Link>
              );
            }
            return (
              <button
                type="button"
                disabled={isPending}
                onClick={() => createAndOpen(target)}
                title={`"${target}" doesn't exist yet. Click to create it.`}
                className="cursor-pointer text-muted-foreground underline decoration-dashed underline-offset-2 hover:text-foreground"
              >
                {children}
              </button>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
