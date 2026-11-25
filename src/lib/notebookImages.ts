import "server-only";
import { randomBytes } from "node:crypto";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { UserError } from "@/lib/userError";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 2400; // plenty for a battle map on a big screen
export const MAX_STORED_BYTES_PER_CAMPAIGN = 500 * 1024 * 1024;
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
    return { data: new Uint8Array(data), width: info.width, height: info.height, size: data.length };
  } catch {
    throw new UserError("That file isn't a picture we can read. Try a JPEG, PNG or WebP.");
  }
}

/** Refuses an upload that would take a campaign past its storage allowance. */
export async function checkCampaignImageSpace(campaignId: string, adding: number) {
  const { _sum } = await prisma.notebookImage.aggregate({ where: { campaignId }, _sum: { size: true } });
  if ((_sum.size ?? 0) + adding > MAX_STORED_BYTES_PER_CAMPAIGN) {
    throw new UserError("This campaign's notebooks are full of pictures. The DM can clear out unused ones under Notes → Pictures.");
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

export type InventoryPicture = {
  id: string;
  url: string;
  notebook: "DM" | "PARTY";
  width: number;
  height: number;
  size: number;
  createdAt: string;
  addedBy: string | null;
  usedOn: { title: string; href: string }[];
  /** Also used in a player's private notebook (which page isn't shown). */
  usedPrivately: boolean;
};

/**
 * Everything the DM's Pictures page shows: the pictures in the DM's
 * notebook and the party notebook, with the pages that use each one, and
 * how much of the campaign's allowance is used. Players' private notebooks
 * only appear as a total: the DM can't see or remove those pictures.
 */
export async function loadPictureInventory(campaignId: string) {
  const [images, pages, privatePages, privateTotals] = await Promise.all([
    prisma.notebookImage.findMany({
      where: { campaignId, kind: { in: ["DM", "PARTY"] } },
      select: {
        id: true,
        kind: true,
        width: true,
        height: true,
        size: true,
        createdAt: true,
        uploadedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Pages the DM can see that mention any picture at all.
    prisma.notebookPage.findMany({
      where: {
        campaignId,
        OR: [{ kind: "DM", ownerId: null }, { kind: "PARTY" }],
        content: { contains: "/api/notebook-images/" },
      },
      select: { id: true, title: true, kind: true, content: true },
    }),
    // Players' private pages: only to know a picture is still used there.
    prisma.notebookPage.findMany({
      where: { campaignId, kind: "PERSONAL", content: { contains: "/api/notebook-images/" } },
      select: { content: true },
    }),
    prisma.notebookImage.aggregate({
      where: { campaignId, kind: "PERSONAL" },
      _count: true,
      _sum: { size: true },
    }),
  ]);

  const notesUrl = `/campaigns/${campaignId}/notes`;
  const pictures: InventoryPicture[] = images.map((image) => ({
    id: image.id,
    url: notebookImageUrl(image.id),
    notebook: image.kind as "DM" | "PARTY",
    width: image.width,
    height: image.height,
    size: image.size,
    createdAt: image.createdAt.toISOString(),
    addedBy: image.uploadedBy ? (image.uploadedBy.name ?? image.uploadedBy.email) : null,
    usedOn: pages
      .filter((page) => page.content.includes(notebookImageUrl(image.id)))
      .map((page) => ({
        title: page.title,
        href: `${notesUrl}${page.kind === "PARTY" ? "/party" : ""}?page=${page.id}`,
      })),
    usedPrivately: privatePages.some((page) => page.content.includes(notebookImageUrl(image.id))),
  }));

  const shownBytes = pictures.reduce((sum, p) => sum + p.size, 0);
  const privateBytes = privateTotals._sum.size ?? 0;
  return {
    pictures,
    private: { count: privateTotals._count, bytes: privateBytes },
    usedBytes: shownBytes + privateBytes,
    limitBytes: MAX_STORED_BYTES_PER_CAMPAIGN,
  };
}

/**
 * For a page the DM is revealing: gives every DM-notebook picture in the text
 * a copy in the party notebook, and points the text at the copies. The DM's
 * originals stay DM-only, and deleting one later doesn't break the party's
 * page. Pictures from elsewhere are left as they are.
 */
export async function sharePicturesWithParty(campaignId: string, content: string) {
  const ids = [...new Set([...content.matchAll(/\/api\/notebook-images\/([a-z0-9]+)/gi)].map((m) => m[1]))];
  if (ids.length === 0) return content;
  const dmPictures = await prisma.notebookImage.findMany({
    where: { id: { in: ids }, campaignId, kind: "DM" },
    select: { id: true, size: true },
  });
  await checkCampaignImageSpace(campaignId, dmPictures.reduce((sum, p) => sum + p.size, 0));

  let shared = content;
  for (const picture of dmPictures) {
    const copyId = `c${randomBytes(12).toString("hex")}`;
    // Copied inside the database, so the picture never passes through here.
    await prisma.$executeRaw`
      INSERT INTO "NotebookImage" (id, "campaignId", kind, "ownerId", "uploadedById", data, width, height, size, "createdAt")
      SELECT ${copyId}, "campaignId", 'PARTY', NULL, "uploadedById", data, width, height, size, now()
      FROM "NotebookImage" WHERE id = ${picture.id}`;
    shared = shared.split(notebookImageUrl(picture.id)).join(notebookImageUrl(copyId));
  }
  return shared;
}
