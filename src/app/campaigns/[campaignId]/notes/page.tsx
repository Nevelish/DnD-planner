import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
import { getDateTimePrefs } from "@/lib/sessionDateFormat";
import { loadNotebook, notebookScope } from "@/lib/notebookData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Notebook } from "@/components/notes/notebook";

/** Your own notebook: the DM notebook for the DM, a private one for a player. */
export default async function MyNotebookPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ page?: string; q?: string; edit?: string }>;
}) {
  const { campaignId } = await params;
  const { page, q, edit } = await searchParams;
  const { userId, membership } = await requireMembershipForPage(campaignId);
  const viewer = { userId, isDM: membership.role === "DM" };

  const notebook = await loadNotebook({
    scope: notebookScope(campaignId, "mine", viewer),
    viewer,
    prefs: await getDateTimePrefs(userId),
    requestedId: page,
    rawQuery: q,
    startInEdit: edit === "1",
  });
  // For "Reveal to party": which links would point at pages the party has.
  const partyTitles = viewer.isDM
    ? (await prisma.notebookPage.findMany({ where: { campaignId, kind: "PARTY" }, select: { title: true } })).map(
        (p) => p.title,
      )
    : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{viewer.isDM ? "DM notebook" : "My notebook"}</CardTitle>
        <CardDescription>
          {viewer.isDM
            ? "Only you can see this. NPCs, places, plot threads, and the prep for each session."
            : "Only you can see this, not even the DM. People you've met, places, clues, and notes from each session."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <Notebook
          campaignId={campaignId}
          notebook="mine"
          kind={viewer.isDM ? "dm" : "player"}
          pages={notebook.pages}
          selected={notebook.selected}
          search={notebook.search}
          linkablePages={notebook.linkablePages}
          partyTitles={partyTitles}
        />
      </CardContent>
    </Card>
  );
}
