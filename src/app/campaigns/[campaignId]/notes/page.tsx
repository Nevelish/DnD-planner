import { prisma } from "@/lib/prisma";
import { requireMembershipForPage } from "@/lib/permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NotesEditor } from "@/components/notes/notes-editor";

export default async function NotesPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const { userId, membership } = await requireMembershipForPage(campaignId);
  const isDM = membership.role === "DM";

  const [notes, playerNote] = await Promise.all([
    prisma.campaignNote.findMany({ where: { campaignId } }),
    isDM
      ? Promise.resolve(null)
      : prisma.playerNote.findUnique({
          where: { campaignId_userId: { campaignId, userId } },
        }),
  ]);

  const generalNote = notes.find((n) => n.type === "GENERAL");
  const prepNote = notes.find((n) => n.type === "NEXT_SESSION_PREP");
  const partyNote = notes.find((n) => n.type === "PARTY");

  return (
    <div className="flex flex-col gap-6">
      {isDM && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Campaign notes</CardTitle>
              <CardDescription>Only you can see this.</CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <NotesEditor
                campaignId={campaignId}
                type="GENERAL"
                initialContent={generalNote?.content ?? ""}
                initialUpdatedAt={generalNote?.updatedAt.toISOString()}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Next session prep</CardTitle>
              <CardDescription>Only you can see this.</CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
              <NotesEditor
                campaignId={campaignId}
                type="NEXT_SESSION_PREP"
                initialContent={prepNote?.content ?? ""}
                initialUpdatedAt={prepNote?.updatedAt.toISOString()}
              />
            </CardContent>
          </Card>
        </>
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
