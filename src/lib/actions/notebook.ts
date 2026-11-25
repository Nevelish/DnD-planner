"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireDM, requireMember } from "@/lib/permissions";
import { NOTE_TEMPLATES, templatesFor } from "@/lib/noteTemplates";
import {
  findUnlinkedMentions,
  linkMention,
  normalizeTitle,
  renameWikiLinks,
  wikiLinkTargets,
} from "@/lib/wikiLinks";
import { UserError } from "@/lib/userError";

const MAX_CONTENT_LENGTH = 100_000;
const MAX_PAGES_PER_NOTEBOOK = 500;

const titleSchema = z
  .string()
  .trim()
  .min(1, "Give the page a title.")
  .max(120, "Keep the title under 120 characters.");

const notebookSchema = z.enum(["mine", "party"]);

/** Which notebook a request is for, as the client names it: "mine" (the
 * DM's notebook for the DM, your private one for a player) or "party". */
export type NotebookName = z.infer<typeof notebookSchema>;

/**
 * Turns a notebook name into the exact set of pages the caller may use.
 * Every query below includes this `where`, so a page id from any other
 * notebook (another player's, the DM's, another campaign's) simply isn't
 * found. The client only picks *which* of its own notebooks; it can never
 * name someone else's.
 */
async function resolveNotebook(campaignId: string, name: NotebookName) {
  const notebook = notebookSchema.parse(name);
  const membership = await requireMember(campaignId);
  const isDM = membership.role === "DM";
  const userId = membership.userId;
  if (notebook === "party") {
    return { isDM, userId, kind: "PARTY" as const, where: { campaignId, kind: "PARTY" as const } };
  }
  return isDM
    ? {
        isDM,
        userId,
        kind: "DM" as const,
        where: { campaignId, kind: "DM" as const, ownerId: null },
      }
    : {
        isDM,
        userId,
        kind: "PERSONAL" as const,
        where: { campaignId, kind: "PERSONAL" as const, ownerId: userId },
      };
}

function revalidateNotebook(campaignId: string, sessionProposalId?: string | null) {
  revalidatePath(`/campaigns/${campaignId}/notes`);
  if (sessionProposalId) {
    revalidatePath(`/campaigns/${campaignId}/sessions/${sessionProposalId}`);
  }
}

export async function createNotebookPage(
  campaignId: string,
  notebook: NotebookName,
  formData: FormData,
) {
  const { isDM, userId, kind, where } = await resolveNotebook(campaignId, notebook);

  const title = titleSchema.safeParse(formData.get("title"));
  if (!title.success) {
    throw new UserError(title.error.issues[0]?.message ?? "Give the page a title.");
  }
  const template = formData.get("template");
  const allowed = templatesFor(kind === "DM" && isDM ? "dm" : "player");
  const content = allowed.find((t) => t === template)
    ? NOTE_TEMPLATES[template as (typeof allowed)[number]].content
    : "";

  const count = await prisma.notebookPage.count({ where });
  if (count >= MAX_PAGES_PER_NOTEBOOK) {
    throw new UserError("This notebook is full. Delete some old pages first.");
  }

  const page = await prisma.notebookPage.create({
    data: { ...where, createdById: userId, title: title.data, content },
    select: { id: true },
  });
  revalidateNotebook(campaignId);
  return { pageId: page.id };
}

/** Saves a page's text. Same overwrite protection as the other notes: the
 * editor sends the updatedAt it loaded, and a save from an outdated copy
 * (say, the same page open on a laptop and a phone) is refused. */
export async function saveNotebookPage(
  campaignId: string,
  notebook: NotebookName,
  pageId: string,
  formData: FormData,
) {
  const { where } = await resolveNotebook(campaignId, notebook);

  const content = String(formData.get("content") ?? "").replace(/\r\n?/g, "\n");
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new UserError("That page is too long.");
  }
  const expectedRaw = formData.get("expectedUpdatedAt");
  if (!expectedRaw) {
    throw new UserError("Reload the page and try again.");
  }

  const { count } = await prisma.notebookPage.updateMany({
    where: { ...where, id: pageId, updatedAt: new Date(String(expectedRaw)) },
    data: { content },
  });
  if (count === 0) {
    throw new UserError(
      "This page was changed somewhere else since you opened it. Reload to see that version, then make your edit again.",
    );
  }

  const saved = await prisma.notebookPage.findFirstOrThrow({
    where: { ...where, id: pageId },
    select: { updatedAt: true, sessionProposalId: true },
  });
  revalidateNotebook(campaignId, saved.sessionProposalId);
  return { updatedAt: saved.updatedAt.toISOString() };
}

export async function renameNotebookPage(
  campaignId: string,
  notebook: NotebookName,
  pageId: string,
  rawTitle: string,
) {
  const { where } = await resolveNotebook(campaignId, notebook);
  const title = titleSchema.safeParse(rawTitle);
  if (!title.success) {
    throw new UserError(title.error.issues[0]?.message ?? "Give the page a title.");
  }
  const page = await prisma.notebookPage.findFirst({
    where: { ...where, id: pageId },
    select: { title: true, updatedAt: true },
  });
  if (!page) throw new UserError("Page not found.");

  // Other pages' [[Old title]] links (in the same notebook) follow the page
  // to its new title. Only when the title really changed, and only if no
  // other page still has the old title (those links still have a target).
  const oldKey = normalizeTitle(page.title);
  const titleChanged = oldKey !== normalizeTitle(title.data);
  const stillTaken =
    titleChanged &&
    (
      await prisma.notebookPage.findMany({
        where: { ...where, sessionProposalId: null, id: { not: pageId } },
        select: { title: true },
      })
    ).some((p) => normalizeTitle(p.title) === oldKey);
  const linking =
    titleChanged && !stillTaken
      ? (
          await prisma.notebookPage.findMany({
            where: { ...where, id: { not: pageId }, content: { contains: "[[" } },
            select: { id: true, content: true },
          })
        ).filter((p) => wikiLinkTargets(p.content).has(oldKey))
      : [];

  await prisma.$transaction([
    // A rename shouldn't count as an edit to this page's text, or it would
    // trip the overwrite check for an editor that's open on it.
    prisma.notebookPage.update({
      where: { id: pageId },
      data: { title: title.data, updatedAt: page.updatedAt },
    }),
    ...linking.map((p) =>
      prisma.notebookPage.update({
        where: { id: p.id },
        data: { content: renameWikiLinks(p.content, page.title, title.data) },
      }),
    ),
  ]);
  revalidateNotebook(campaignId);
  return { updatedLinks: linking.length };
}

export async function setNotebookPagePinned(
  campaignId: string,
  notebook: NotebookName,
  pageId: string,
  pinned: boolean,
) {
  const { where } = await resolveNotebook(campaignId, notebook);
  const page = await prisma.notebookPage.findFirst({
    where: { ...where, id: pageId },
    select: { updatedAt: true },
  });
  if (!page) throw new UserError("Page not found.");
  await prisma.notebookPage.update({
    where: { id: pageId },
    data: { pinned, updatedAt: page.updatedAt },
  });
  revalidateNotebook(campaignId);
}

export async function deleteNotebookPage(
  campaignId: string,
  notebook: NotebookName,
  pageId: string,
) {
  const { isDM, userId, kind, where } = await resolveNotebook(campaignId, notebook);
  const page = await prisma.notebookPage.findFirst({
    where: { ...where, id: pageId },
    select: { sessionProposalId: true, createdById: true },
  });
  if (!page) throw new UserError("Page not found.");
  // In the shared party notebook anyone can edit, but only the page's
  // author or the DM can delete it, so nobody wipes the loot list by accident.
  if (kind === "PARTY" && !isDM && page.createdById !== userId) {
    throw new UserError("Only the person who made this page, or the DM, can delete it.");
  }
  await prisma.notebookPage.delete({ where: { id: pageId } });
  revalidateNotebook(campaignId, page.sessionProposalId);
}

/** "Mentioned in": turns the first plain mention of `title` in another
 * page of the same notebook into a [[link]], keeping the wording. */
export async function linkMentionInPage(
  campaignId: string,
  notebook: NotebookName,
  pageId: string,
  title: string,
) {
  const { where } = await resolveNotebook(campaignId, notebook);
  const page = await prisma.notebookPage.findFirst({
    where: { ...where, id: pageId },
    select: { content: true, updatedAt: true, sessionProposalId: true },
  });
  if (!page) throw new UserError("Page not found.");

  const mention = findUnlinkedMentions(page.content, [title])[0];
  if (!mention) throw new UserError("That page doesn't mention it any more.");

  const { count } = await prisma.notebookPage.updateMany({
    where: { ...where, id: pageId, updatedAt: page.updatedAt },
    data: { content: linkMention(page.content, mention) },
  });
  if (count === 0) throw new UserError("That page just changed. Try again.");
  revalidateNotebook(campaignId, page.sessionProposalId);
}

/** Returns a session's prep page (DM notebook only), creating it from the
 * prep template the first time the DM asks for it. */
export async function ensureSessionPrep(campaignId: string, proposalId: string) {
  await requireDM(campaignId);

  const session = await prisma.sessionProposal.findFirst({
    where: { id: proposalId, campaignId },
    select: { id: true },
  });
  if (!session) throw new UserError("Session not found.");

  const select = { id: true, content: true, updatedAt: true } as const;
  const where = { sessionProposalId: proposalId, campaignId, kind: "DM" as const, ownerId: null };
  const existing = await prisma.notebookPage.findFirst({ where, select });
  const page =
    existing ??
    (await prisma.notebookPage
      .create({
        data: {
          campaignId,
          kind: "DM",
          ownerId: null,
          title: "Session prep",
          content: NOTE_TEMPLATES.sessionPrep.content,
          sessionProposalId: proposalId,
        },
        select,
      })
      // Double-click: the other request created it first.
      .catch(() => prisma.notebookPage.findFirstOrThrow({ where, select })));

  revalidateNotebook(campaignId, proposalId);
  return { id: page.id, content: page.content, updatedAt: page.updatedAt.toISOString() };
}
