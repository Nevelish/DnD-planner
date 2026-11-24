import { requireMembershipForPage } from "@/lib/permissions";
import { getDateTimePrefs } from "@/lib/sessionDateFormat";
import { loadNotebook, notebookScope } from "@/lib/notebookData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Notebook } from "@/components/notes/notebook";

/** The party notebook: shared by everyone in the campaign, DM included. */
export default async function PartyNotebookPage({
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
    scope: notebookScope(campaignId, "party", viewer),
    viewer,
    prefs: await getDateTimePrefs(userId),
    requestedId: page,
    rawQuery: q,
    startInEdit: edit === "1",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Party notebook</CardTitle>
        <CardDescription>
          Shared with the whole party, DM included. Anyone can add and edit pages; only a
          page&apos;s author or the DM can delete it.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <Notebook
          campaignId={campaignId}
          notebook="party"
          kind="party"
          pages={notebook.pages}
          selected={notebook.selected}
          search={notebook.search}
          linkablePages={notebook.linkablePages}
        />
      </CardContent>
    </Card>
  );
}
