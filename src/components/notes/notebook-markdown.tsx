"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { createNotebookPage, type NotebookName } from "@/lib/actions/notebook";
import { linkifyWikiLinks, normalizeTitle, wikiTargetFromHref } from "@/lib/wikiLinks";

export type LinkablePage = { id: string; title: string };

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
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
