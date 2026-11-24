"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/permissions";

// The browser already crops and shrinks the picture before sending it, so
// this stays well under Next's 1 MB server-action limit.
const MAX_UPLOAD_BYTES = 900_000;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif"]);

/**
 * Saves a new profile picture. Whatever arrives is decoded and re-encoded
 * here as a 256×256 WebP, so only a clean image is ever stored or served:
 * no hidden metadata (EXIF, including phone GPS location), and nothing
 * that isn't really a picture (SVG, PDF and the like are refused).
 */
export async function uploadAvatar(formData: FormData) {
  const userId = await requireUserId();

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Pick a picture to upload.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That picture is too large.");
  }

  let data: Uint8Array<ArrayBuffer>;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), {
      limitInputPixels: 40_000_000,
    });
    const { format } = await image.metadata();
    if (!format || !ALLOWED_FORMATS.has(format)) throw new Error("unsupported");
    const encoded = await image
      .rotate() // apply the camera's orientation before the metadata is dropped
      .resize(256, 256, { fit: "cover" })
      .webp({ quality: 85 })
      .toBuffer();
    data = new Uint8Array(encoded);
  } catch {
    throw new Error("That file isn't a picture we can read. Try a JPEG or PNG.");
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.userAvatar.upsert({
      where: { userId },
      create: { userId, data },
      update: { data },
    }),
    prisma.user.update({ where: { id: userId }, data: { avatarUpdatedAt: now } }),
  ]);

  // The picture shows in the nav on every page.
  revalidatePath("/", "layout");
  return { avatarUpdatedAt: now.toISOString() };
}

export async function removeAvatar() {
  const userId = await requireUserId();
  await prisma.$transaction([
    prisma.userAvatar.deleteMany({ where: { userId } }),
    prisma.user.update({ where: { id: userId }, data: { avatarUpdatedAt: null } }),
  ]);
  revalidatePath("/", "layout");
}
