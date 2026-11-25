import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getMembership } from "@/lib/permissions";
import { canSeeNotebookImage } from "@/lib/notebookImages";

/** A notebook picture, for whoever may see that notebook's pages. */
export async function GET(_request: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { imageId } = await params;
  const image = await prisma.notebookImage.findUnique({
    where: { id: imageId },
    select: { campaignId: true, kind: true, ownerId: true, data: true },
  });
  const membership = image ? await getMembership(image.campaignId, userId) : null;
  // "Not found" either way, so the address doesn't confirm a hidden image exists.
  if (!image || !membership || !canSeeNotebookImage(image, { userId, role: membership.role })) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": "image/webp",
      // An image never changes (a new upload gets a new address), but it's
      // private: only this browser may keep it.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
