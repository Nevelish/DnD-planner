import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getMembership } from "@/lib/permissions";
import { notebookScope } from "@/lib/notebookData";
import {
  MAX_UPLOAD_BYTES,
  checkCampaignImageSpace,
  notebookImageUrl,
  processNotebookImage,
} from "@/lib/notebookImages";
import { UserError } from "@/lib/userError";

/**
 * Adds a picture to one of the signed-in user's notebooks in a campaign
 * ("mine": the DM's or their own; "party"). A route rather than a server
 * action, because server actions only take 1 MB and maps are bigger.
 */
export async function POST(request: Request) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  try {
    const form = await request.formData();
    const campaignId = String(form.get("campaignId") ?? "");
    const notebook = form.get("notebook") === "party" ? "party" : "mine";
    const file = form.get("image");

    const membership = await getMembership(campaignId, userId);
    if (!membership) return NextResponse.json({ error: "You are not a member of this campaign." }, { status: 403 });
    if (!(file instanceof File) || file.size === 0) throw new UserError("Pick a picture to add.");
    if (file.size > MAX_UPLOAD_BYTES) throw new UserError("That picture is too large. The limit is 20 MB.");

    const image = await processNotebookImage(Buffer.from(await file.arrayBuffer()));
    await checkCampaignImageSpace(campaignId, image.data.length);

    const scope = notebookScope(campaignId, notebook, { userId, isDM: membership.role === "DM" });
    const saved = await prisma.notebookImage.create({
      data: {
        campaignId,
        kind: scope.kind,
        ownerId: "ownerId" in scope ? scope.ownerId : null,
        uploadedById: userId,
        ...image,
      },
      select: { id: true, width: true, height: true },
    });
    return NextResponse.json({ url: notebookImageUrl(saved.id), width: saved.width, height: saved.height });
  } catch (e) {
    if (e instanceof UserError) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error("Notebook image upload failed:", e);
    return NextResponse.json({ error: "Couldn't add that picture. Try again." }, { status: 500 });
  }
}
