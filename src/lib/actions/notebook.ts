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

const MAX_CONTENT_LENGTH = 100_000;
const MAX_PAGES_PER_NOTEBOOK = 500;

const titleSchema = z
  .string()
  .trim()
  .min(1, "Give the page a title.")
  .max(120, "Keep the title under 120 characters.");

/**
 * Whose notebook the caller works in for this campaign. The DM gets the
 * campaign's DM notebook (ownerId null); everyone else gets their own
 * private one. Every query below includes this `where`, so a page id from
 * someone else's notebook simply isn't found.
 */
async function myNotebook(campaignId: string) {
  const membership = await requireMember(campaignId);
  const isDM = membership.role === "DM";
  return {
    isDM,
    where: { campaignId, ownerId: isDM ? null : membership.userId },
  };
}

function revalidateNotebook(campaignId: string, sessionProposalId?: string | null) {
  revalidatePath(`/campaigns/${campaignId}/notes`);
  if (sessionProposalId) {
    revalidatePath(`/campaigns/${campaignId}/sessions/${sessionProposalId}`);
  }
}

export async function createNotebookPage(campaignId: string, formData: FormData) {
  const { isDM, where } = await myNotebook(campaignId);

  const title = titleSchema.safeParse(formData.get("title"));
  if (!title.success) {
    throw new Error(title.error.issues[0]?.message ?? "Give the page a title.");
  }
  const template = formData.get("template");
  const allowed = templatesFor(isDM ? "dm" : "player");
  const content = allowed.find((t) => t === template) ? NOTE_TEMPLATES[template as (typeof allowed)[number]].content : "";

  const count = await prisma.notebookPage.count({ where });
  if (count >= MAX_PAGES_PER_NOTEBOOK) {
    throw new Error("This notebook is full. Delete some old pages first.");
  }

  const page = await prisma.notebookPage.create({
    data: { ...where, title: title.data, content },
    select: { id: true },
  });
  revalidateNotebook(campaignId);
  return { pageId: page.id };
}

/** Saves a page's text. Same overwrite protection as the other notes: the
 * editor sends the updatedAt it loaded, and a save from an outdated copy
 * (say, the same page open on a laptop and a phone) is refused. */
export async function saveNotebookPage(campaignId: string, pageId: string, formData: FormData) {
  const { where } = await myNotebook(campaignId);

  const content = String(formData.get("content") ?? "").replace(/\r\n?/g, "\n");
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new Error("That page is too long.");
  }
  const expectedRaw = formData.get("expectedUpdatedAt");
  if (!expectedRaw) {
    throw new Error("Reload the page and try again.");
  }

  const { count } = await prisma.notebookPage.updateMany({
    where: { ...where, id: pageId, updatedAt: new Date(String(expectedRaw)) },
    data: { content },
  });
  if (count === 0) {
    throw new Error(
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

export async function renameNotebookPage(campaignId: string, pageId: string, rawTitle: string) {
  const { where } = await myNotebook(campaignId);
  const title = titleSchema.safeParse(rawTitle);
  if (!title.success) {
    throw new Error(title.error.issues[0]?.message ?? "Give the page a title.");
  }
  const page = await prisma.notebookPage.findFirst({
    where: { ...where, id: pageId },
    select: { title: true, updatedAt: true },
  });
  if (!page) throw new Error("Page not found.");

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

export async function setNotebookPagePinned(campaignId: string, pageId: string, pinned: boolean) {
  const { where } = await myNotebook(campaignId);
  const page = await prisma.notebookPage.findFirst({
    where: { ...where, id: pageId },
    select: { updatedAt: true },
  });
  if (!page) throw new Error("Page not found.");
  await prisma.notebookPage.update({
    where: { id: pageId },
    data: { pinned, updatedAt: page.updatedAt },
  });
  revalidateNotebook(campaignId);
}

export async function deleteNotebookPage(campaignId: string, pageId: string) {
  const { where } = await myNotebook(campaignId);
  const page = await prisma.notebookPage.findFirst({
    where: { ...where, id: pageId },
    select: { sessionProposalId: true },
  });
  if (!page) throw new Error("Page not found.");
  await prisma.notebookPage.delete({ where: { id: pageId } });
  revalidateNotebook(campaignId, page.sessionProposalId);
}

/** "Mentioned in": turns the first plain mention of `title` in another
 * page of the same notebook into a [[link]], keeping the wording. */
export async function linkMentionInPage(campaignId: string, pageId: string, title: string) {
  const { where } = await myNotebook(campaignId);
  const page = await prisma.notebookPage.findFirst({
    where: { ...where, id: pageId },
    select: { content: true, updatedAt: true, sessionProposalId: true },
  });
  if (!page) throw new Error("Page not found.");

  const mention = findUnlinkedMentions(page.content, [title])[0];
  if (!mention) throw new Error("That page doesn't mention it any more.");

  const { count } = await prisma.notebookPage.updateMany({
    where: { ...where, id: pageId, updatedAt: page.updatedAt },
    data: { content: linkMention(page.content, mention) },
  });
  if (count === 0) throw new Error("That page just changed. Try again.");
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
  if (!session) throw new Error("Session not found.");

  const select = { id: true, content: true, updatedAt: true } as const;
  const where = { sessionProposalId: proposalId, campaignId, ownerId: null };
  const existing = await prisma.notebookPage.findFirst({ where, select });
  const page =
    existing ??
    (await prisma.notebookPage
      .create({
        data: {
          campaignId,
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
