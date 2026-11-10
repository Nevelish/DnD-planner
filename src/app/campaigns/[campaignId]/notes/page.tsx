import { prisma } from "@/lib/prisma";
import { requireDMForPage } from "@/lib/permissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotesEditor } from "@/components/notes/notes-editor";

export default async function NotesPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  await requireDMForPage(campaignId);

  const notes = await prisma.campaignNote.findMany({
    where: { campaignId },
  });
  const general = notes.find((n) => n.type === "GENERAL")?.content ?? "";
  const prep = notes.find((n) => n.type === "NEXT_SESSION_PREP")?.content ?? "";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Campaign notes</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <NotesEditor campaignId={campaignId} type="GENERAL" initialContent={general} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Next session prep</CardTitle>
        </CardHeader>
        <CardContent className="pb-6">
          <NotesEditor
            campaignId={campaignId}
            type="NEXT_SESSION_PREP"
            initialContent={prep}
          />
        </CardContent>
      </Card>
    </div>
  );
}
