import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  // Pictures are for people using the app, not the open internet.
  if (!(await getCurrentUserId())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { userId } = await params;
  const avatar = await prisma.userAvatar.findUnique({
    where: { userId },
    select: { data: true },
  });
  if (!avatar) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": "image/webp",
      // URLs carry ?v=<upload time>, so a cached copy never goes stale.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
