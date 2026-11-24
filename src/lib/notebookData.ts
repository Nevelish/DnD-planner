import "server-only";

import { prisma } from "@/lib/prisma";
import { formatDateOnlyForUser, type DateTimePrefs } from "@/lib/sessionDateFormat";
import type {
  NotebookPage,
  NotebookSearch,
  NotebookSelected,
} from "@/components/notes/notebook";
import { findUnlinkedMentions, normalizeTitle, wikiLinkTargets } from "@/lib/wikiLinks";

type PageRow = {
  id: string;
  title: string;
  pinned: boolean;
  sessionProposal: { id: string; title: string | null; startsAt: Date } | null;
};

function toNotebookPage(campaignId: string, p: PageRow, prefs: DateTimePrefs): NotebookPage {
  const date = p.sessionProposal ? formatDateOnlyForUser(p.sessionProposal.startsAt, prefs) : undefined;
  return {
    id: p.id,
    label: p.sessionProposal ? (p.sessionProposal.title ?? date ?? p.title) : p.title,
    pinned: p.pinned,
    sessionHref: p.sessionProposal ? `/campaigns/${campaignId}/sessions/${p.sessionProposal.id}` : null,
    meta: p.sessionProposal?.title ? date : undefined,
  };
}

/** A line of context around the first match, for search results. */
function snippet(content: string, q: string): string {
  const flat = content.replace(/\s+/g, " ");
  const at = flat.toLowerCase().indexOf(q.toLowerCase());
  if (at < 0) return flat.slice(0, 120);
  const start = Math.max(0, at - 50);
  return `${start > 0 ? "…" : ""}${flat.slice(start, at + q.length + 70)}${at + q.length + 70 < flat.length ? "…" : ""}`;
}

/** Which pages make up a notebook, for whoever is looking. Mirrors
 * resolveNotebook in lib/actions/notebook.ts. */
export function notebookScope(
  campaignId: string,
  which: "mine" | "party",
  viewer: { userId: string; isDM: boolean },
) {
  if (which === "party") return { campaignId, kind: "PARTY" as const };
  return viewer.isDM
    ? { campaignId, kind: "DM" as const, ownerId: null }
    : { campaignId, kind: "PERSONAL" as const, ownerId: viewer.userId };
}

/** One notebook's pages. Every query here filters on `scope`, so pages
 * from another notebook can't appear, even if their id is put in the URL. */
export async function loadNotebook({
  scope,
  viewer,
  prefs,
  requestedId,
  rawQuery,
  startInEdit,
}: {
  scope: ReturnType<typeof notebookScope>;
  viewer: { userId: string; isDM: boolean };
  prefs: DateTimePrefs;
  requestedId: string | undefined;
  rawQuery: string | undefined;
  startInEdit: boolean;
}) {
  const { campaignId } = scope;
  const select = {
    id: true,
    title: true,
    pinned: true,
    updatedAt: true,
    sessionProposal: { select: { id: true, title: true, startsAt: true } },
  } as const;
  const rows = await prisma.notebookPage.findMany({
    where: scope,
    select,
    orderBy: { updatedAt: "desc" },
  });
  // Pinned and recently edited first; prep newest session first.
  rows.sort((a, b) => {
    if (a.sessionProposal && b.sessionProposal) {
      return b.sessionProposal.startsAt.getTime() - a.sessionProposal.startsAt.getTime();
    }
    return Number(b.pinned) - Number(a.pinned);
  });
  const pages = rows.map((r) => toNotebookPage(campaignId, r, prefs));
  // Session prep pages are all called "Session prep", so they can link out
  // but aren't link targets themselves. Newest first, for duplicates.
  const linkablePages = rows
    .filter((r) => !r.sessionProposal)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((r) => ({ id: r.id, title: r.title }));

  const q = rawQuery?.trim().slice(0, 100);
  let search: NotebookSearch | null = null;
  if (q) {
    const hits = await prisma.notebookPage.findMany({
      where: {
        ...scope,
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { content: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { ...select, content: true },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });
    search = {
      q,
      results: hits.map((h) => ({
        id: h.id,
        label: toNotebookPage(campaignId, h, prefs).label,
        snippet: snippet(h.content, q),
      })),
    };
  }

  let selected: NotebookSelected | null = null;
  const selectedId = pages.some((p) => p.id === requestedId) ? requestedId : pages[0]?.id;
  if (!search && selectedId) {
    const page = await prisma.notebookPage.findFirst({
      where: { ...scope, id: selectedId },
      select: { ...select, content: true, createdById: true },
    });
    if (page) {
      const key = normalizeTitle(page.title);
      // Other pages that link here, or name this page without linking it.
      // (Prep pages are all called "Session prep", so they get neither.)
      const firstWord = page.title.trim().split(/\s+/)[0];
      const others = page.sessionProposal
        ? []
        : await prisma.notebookPage.findMany({
            where: {
              ...scope,
              id: { not: page.id },
              OR: [
                { content: { contains: "[[" } },
                { content: { contains: firstWord, mode: "insensitive" } },
              ],
            },
            select: { ...select, content: true },
          });
      const linking = others.filter((p) => wikiLinkTargets(p.content).has(key));
      selected = {
        ...toNotebookPage(campaignId, page, prefs),
        title: page.title,
        content: page.content,
        updatedAt: page.updatedAt.toISOString(),
        startInEdit,
        // Shared party pages can only be deleted by their author or the DM.
        canDelete: scope.kind !== "PARTY" || viewer.isDM || page.createdById === viewer.userId,
        backlinks: linking.map((p) => ({
          id: p.id,
          label: toNotebookPage(campaignId, p, prefs).label,
        })),
        // Pages that already link here are listed above, not again here.
        mentions: others
          .filter((p) => !linking.includes(p))
          .filter((p) => findUnlinkedMentions(p.content, [page.title]).length > 0)
          .map((p) => ({ id: p.id, label: toNotebookPage(campaignId, p, prefs).label })),
      };
    }
  }

  return { pages, selected, search, linkablePages };
}
