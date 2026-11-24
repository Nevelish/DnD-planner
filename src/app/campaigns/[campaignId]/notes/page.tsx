import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
import { formatDateOnlyForUser, getDateTimePrefs, type DateTimePrefs } from "@/lib/sessionDateFormat";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NotesEditor } from "@/components/notes/notes-editor";
import {
  DmNotebook,
  type NotebookPage,
  type NotebookSearch,
  type NotebookSelected,
} from "@/components/notes/dm-notebook";
import { normalizeTitle, wikiLinkTargets } from "@/lib/wikiLinks";

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

async function loadNotebook(
  campaignId: string,
  prefs: DateTimePrefs,
  requestedId: string | undefined,
  rawQuery: string | undefined,
  startInEdit: boolean,
) {
  const select = {
    id: true,
    title: true,
    pinned: true,
    updatedAt: true,
    sessionProposal: { select: { id: true, title: true, startsAt: true } },
  } as const;
  const rows = await prisma.dmPage.findMany({
    where: { campaignId },
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
    const hits = await prisma.dmPage.findMany({
      where: {
        campaignId,
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
    const page = await prisma.dmPage.findFirst({
      where: { id: selectedId, campaignId },
      select: { ...select, content: true },
    });
    if (page) {
      const key = normalizeTitle(page.title);
      const linking = page.sessionProposal
        ? []
        : await prisma.dmPage.findMany({
            where: { campaignId, id: { not: page.id }, content: { contains: "[[" } },
            select: { ...select, content: true },
          });
      selected = {
        ...toNotebookPage(campaignId, page, prefs),
        title: page.title,
        content: page.content,
        updatedAt: page.updatedAt.toISOString(),
        startInEdit,
        backlinks: linking
          .filter((p) => wikiLinkTargets(p.content).has(key))
          .map((p) => ({ id: p.id, label: toNotebookPage(campaignId, p, prefs).label })),
      };
    }
  }

  return { pages, selected, search, linkablePages };
}

export default async function NotesPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ page?: string; q?: string; edit?: string }>;
}) {
  const { campaignId } = await params;
  const { page: requestedPage, q, edit } = await searchParams;
  const { userId, membership } = await requireMembershipForPage(campaignId);
  const isDM = membership.role === "DM";

  const [partyNote, playerNote, notebook] = await Promise.all([
    prisma.campaignNote.findUnique({
      where: { campaignId_type: { campaignId, type: "PARTY" } },
    }),
    isDM
      ? Promise.resolve(null)
      : prisma.playerNote.findUnique({
          where: { campaignId_userId: { campaignId, userId } },
        }),
    // The DM's notebook is only ever loaded for the DM.
    isDM
      ? getDateTimePrefs(userId).then((prefs) => loadNotebook(campaignId, prefs, requestedPage, q, edit === "1"))
      : Promise.resolve(null),
  ]);

  return (
    <div className="flex flex-col gap-6">
      {notebook && (
        <Card>
          <CardHeader>
            <CardTitle>DM notebook</CardTitle>
            <CardDescription>
              Only you can see this. NPCs, places, plot threads, and the prep
              for each session.
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <DmNotebook
              campaignId={campaignId}
              pages={notebook.pages}
              selected={notebook.selected}
              search={notebook.search}
              linkablePages={notebook.linkablePages}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Party notes</CardTitle>
          <CardDescription>
            Shared with the whole party — anyone can edit this.
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          <NotesEditor
            campaignId={campaignId}
            type="PARTY"
            initialContent={partyNote?.content ?? ""}
            initialUpdatedAt={partyNote?.updatedAt.toISOString()}
            placeholder="Shared loot, party decisions, lore everyone should know…"
          />
        </CardContent>
      </Card>

      {!isDM && (
        <Card>
          <CardHeader>
            <CardTitle>My notes</CardTitle>
            <CardDescription>Private — only you can see this.</CardDescription>
          </CardHeader>
          <CardContent className="pb-6">
            <NotesEditor
              campaignId={campaignId}
              initialContent={playerNote?.content ?? ""}
              initialUpdatedAt={playerNote?.updatedAt.toISOString()}
              placeholder="Personal notes just for you…"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
