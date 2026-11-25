import "server-only";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/userError";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 2400; // plenty for a battle map on a big screen
const MAX_STORED_BYTES_PER_CAMPAIGN = 500 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"]);

/** The address a notebook image is served from, used in page markdown. */
export const notebookImageUrl = (id: string) => `/api/notebook-images/${id}`;

/**
 * Decodes an uploaded picture and re-encodes it as WebP, at most 2400px on
 * its longest side. Only a clean image is ever stored or served: no hidden
 * metadata (EXIF, including phone GPS location), and nothing that isn't
 * really a picture (SVG, PDF and the like are refused).
 */
export async function processNotebookImage(file: Buffer) {
  try {
    const image = sharp(file, { limitInputPixels: 100_000_000 });
    const { format } = await image.metadata();
    if (!format || !ALLOWED_FORMATS.has(format)) throw new Error("unsupported");
    const { data, info } = await image
      .rotate() // apply the camera's orientation before the metadata is dropped
      .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(data), width: info.width, height: info.height };
  } catch {
    throw new UserError("That file isn't a picture we can read. Try a JPEG, PNG or WebP.");
  }
}

/** Refuses an upload that would take a campaign past its storage allowance. */
export async function checkCampaignImageSpace(campaignId: string, adding: number) {
  const [{ used }] = await prisma.$queryRaw<{ used: bigint | null }[]>`
    SELECT sum(octet_length("data"))::bigint AS used FROM "NotebookImage" WHERE "campaignId" = ${campaignId}`;
  if (Number(used ?? 0) + adding > MAX_STORED_BYTES_PER_CAMPAIGN) {
    throw new UserError("This campaign's notebooks are full of pictures. Remove some pages' images first.");
  }
}

/**
 * Whether someone may see a notebook image: the same rule as for the pages
 * of the notebook it was added to.
 */
export function canSeeNotebookImage(
  image: { kind: "DM" | "PERSONAL" | "PARTY"; ownerId: string | null },
  viewer: { userId: string; role: "DM" | "PLAYER" },
) {
  if (image.kind === "PARTY") return true;
  if (image.kind === "DM") return viewer.role === "DM";
  return image.ownerId === viewer.userId;
}
