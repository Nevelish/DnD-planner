import { requireDMForPage } from "@/lib/permissions";
import { loadPictureInventory } from "@/lib/notebookImages";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PictureInventory } from "@/components/notes/picture-inventory";

/** The DM's overview of the campaign's notebook pictures, for tidying up. */
export default async function PicturesPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  await requireDMForPage(campaignId);
  const inventory = await loadPictureInventory(campaignId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pictures</CardTitle>
        <CardDescription>
          Every picture in your notebook and the party notebook, and the pages that use them.
          Deleting a picture frees up space; pages that still show it will say it was removed.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <PictureInventory
          campaignId={campaignId}
          pictures={inventory.pictures}
          privateCount={inventory.private.count}
          privateBytes={inventory.private.bytes}
          usedBytes={inventory.usedBytes}
          limitBytes={inventory.limitBytes}
        />
      </CardContent>
    </Card>
  );
}
