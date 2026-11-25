import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getMembership } from "@/lib/permissions";
import { canSeeNotebookImage } from "@/lib/notebookImages";

/** A notebook picture, for whoever may see that notebook's pages. */
export async function GET(request: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const userId = await getCurrentUserId();
  if (!userId) return new NextResponse("Unauthorized", { status: 401 });

  const { imageId } = await params;
  const image = await prisma.notebookImage.findUnique({
    where: { id: imageId },
    select: { campaignId: true, kind: true, ownerId: true },
  });
  const membership = image ? await getMembership(image.campaignId, userId) : null;
  // "Not found" either way, so the address doesn't confirm a hidden image exists.
  if (!image || !membership || !canSeeNotebookImage(image, { userId, role: membership.role })) {
    return new NextResponse("Not found", { status: 404 });
  }

  // A picture never changes (a new upload gets a new address), so its id is
  // its version. Browsers keep a copy but ask each time ("no-cache"), so a
  // deleted picture, or one this person may no longer see, stops showing;
  // an unchanged one costs a tiny "not modified" reply.
  const headers = {
    ETag: `"${imageId}"`,
    "Cache-Control": "private, no-cache",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'",
  };
  if (request.headers.get("if-none-match") === headers.ETag) {
    return new NextResponse(null, { status: 304, headers });
  }

  const { data } = await prisma.notebookImage.findUniqueOrThrow({ where: { id: imageId }, select: { data: true } });
  return new NextResponse(new Uint8Array(data), { headers: { ...headers, "Content-Type": "image/webp" } });
}
