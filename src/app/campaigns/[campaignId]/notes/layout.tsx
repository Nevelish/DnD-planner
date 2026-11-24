import { requireMembershipForPage } from "@/lib/permissions";
import { NotebookTabs } from "@/components/notes/notebook-tabs";

export default async function NotesLayout({
  params,
  children,
}: {
  params: Promise<{ campaignId: string }>;
  children: React.ReactNode;
}) {
  const { campaignId } = await params;
  const { membership } = await requireMembershipForPage(campaignId);

  return (
    <div className="flex flex-col gap-4">
      <NotebookTabs campaignId={campaignId} isDM={membership.role === "DM"} />
      {children}
    </div>
  );
}
