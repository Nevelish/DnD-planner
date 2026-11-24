"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireDM } from "@/lib/permissions";
import { NOTE_TEMPLATES, isNoteTemplateKey } from "@/lib/noteTemplates";
import { normalizeTitle, renameWikiLinks, wikiLinkTargets } from "@/lib/wikiLinks";

// Everything here is DM-only: every action starts with requireDM and every
// query is scoped to that campaign.

const MAX_CONTENT_LENGTH = 100_000;
const MAX_PAGES_PER_CAMPAIGN = 500;

const titleSchema = z
  .string()
  .trim()
  .min(1, "Give the page a title.")
  .max(120, "Keep the title under 120 characters.");

function revalidateNotebook(campaignId: string, sessionProposalId?: string | null) {
  revalidatePath(`/campaigns/${campaignId}/notes`);
  if (sessionProposalId) {
    revalidatePath(`/campaigns/${campaignId}/sessions/${sessionProposalId}`);
  }
}

export async function createDmPage(campaignId: string, formData: FormData) {
  await requireDM(campaignId);

  const title = titleSchema.safeParse(formData.get("title"));
  if (!title.success) {
    throw new Error(title.error.issues[0]?.message ?? "Give the page a title.");
  }
  const template = formData.get("template");
  const content = isNoteTemplateKey(template) ? NOTE_TEMPLATES[template].content : "";

  const count = await prisma.dmPage.count({ where: { campaignId } });
  if (count >= MAX_PAGES_PER_CAMPAIGN) {
    throw new Error("This notebook is full. Delete some old pages first.");
  }

  const page = await prisma.dmPage.create({
    data: { campaignId, title: title.data, content },
    select: { id: true },
  });
  revalidateNotebook(campaignId);
  return { pageId: page.id };
}

/** Saves a page's text. Same overwrite protection as the other notes: the
 * editor sends the updatedAt it loaded, and a save from an outdated copy
 * (say, the same page open on a laptop and a phone) is refused. */
export async function saveDmPage(campaignId: string, pageId: string, formData: FormData) {
  await requireDM(campaignId);

  const content = String(formData.get("content") ?? "").replace(/\r\n?/g, "\n");
  if (content.length > MAX_CONTENT_LENGTH) {
    throw new Error("That page is too long.");
  }
  const expectedRaw = formData.get("expectedUpdatedAt");
  if (!expectedRaw) {
    throw new Error("Reload the page and try again.");
  }

  const { count } = await prisma.dmPage.updateMany({
    where: { id: pageId, campaignId, updatedAt: new Date(String(expectedRaw)) },
    data: { content },
  });
  if (count === 0) {
    throw new Error(
      "This page was changed somewhere else since you opened it. Reload to see that version, then make your edit again.",
    );
  }

  const saved = await prisma.dmPage.findUniqueOrThrow({
    where: { id: pageId },
    select: { updatedAt: true, sessionProposalId: true },
  });
  revalidateNotebook(campaignId, saved.sessionProposalId);
  return { updatedAt: saved.updatedAt.toISOString() };
}

export async function renameDmPage(campaignId: string, pageId: string, rawTitle: string) {
  await requireDM(campaignId);
  const title = titleSchema.safeParse(rawTitle);
  if (!title.success) {
    throw new Error(title.error.issues[0]?.message ?? "Give the page a title.");
  }
  const page = await prisma.dmPage.findFirst({
    where: { id: pageId, campaignId },
    select: { title: true, updatedAt: true },
  });
  if (!page) throw new Error("Page not found.");

  // Other pages' [[Old title]] links follow the page to its new title.
  // Only when the title really changed, and only if no other page still
  // has the old title (those links would still have somewhere to go).
  const oldKey = normalizeTitle(page.title);
  const titleChanged = oldKey !== normalizeTitle(title.data);
  const stillTaken =
    titleChanged &&
    (await prisma.dmPage.findMany({
      where: { campaignId, sessionProposalId: null, id: { not: pageId } },
      select: { title: true },
    })).some((p) => normalizeTitle(p.title) === oldKey);
  const linking =
    titleChanged && !stillTaken
      ? (
          await prisma.dmPage.findMany({
            where: { campaignId, id: { not: pageId }, content: { contains: "[[" } },
            select: { id: true, content: true },
          })
        ).filter((p) => wikiLinkTargets(p.content).has(oldKey))
      : [];

  await prisma.$transaction([
    // A rename shouldn't count as an edit to this page's text, or it would
    // trip the overwrite check for an editor that's open on it.
    prisma.dmPage.update({
      where: { id: pageId },
      data: { title: title.data, updatedAt: page.updatedAt },
    }),
    ...linking.map((p) =>
      prisma.dmPage.update({
        where: { id: p.id },
        data: { content: renameWikiLinks(p.content, page.title, title.data) },
      }),
    ),
  ]);
  revalidateNotebook(campaignId);
  return { updatedLinks: linking.length };
}

export async function setDmPagePinned(campaignId: string, pageId: string, pinned: boolean) {
  await requireDM(campaignId);
  const page = await prisma.dmPage.findFirst({
    where: { id: pageId, campaignId },
    select: { updatedAt: true },
  });
  if (!page) throw new Error("Page not found.");
  await prisma.dmPage.update({
    where: { id: pageId },
    data: { pinned, updatedAt: page.updatedAt },
  });
  revalidateNotebook(campaignId);
}

export async function deleteDmPage(campaignId: string, pageId: string) {
  await requireDM(campaignId);
  const page = await prisma.dmPage.findFirst({
    where: { id: pageId, campaignId },
    select: { sessionProposalId: true },
  });
  if (!page) throw new Error("Page not found.");
  await prisma.dmPage.delete({ where: { id: pageId } });
  revalidateNotebook(campaignId, page.sessionProposalId);
}

/** Returns a session's prep page, creating it from the prep template the
 * first time the DM asks for it. */
export async function ensureSessionPrep(campaignId: string, proposalId: string) {
  await requireDM(campaignId);

  const session = await prisma.sessionProposal.findFirst({
    where: { id: proposalId, campaignId },
    select: { id: true },
  });
  if (!session) throw new Error("Session not found.");

  const select = { id: true, content: true, updatedAt: true } as const;
  const existing = await prisma.dmPage.findUnique({
    where: { sessionProposalId: proposalId },
    select,
  });
  const page =
    existing ??
    (await prisma.dmPage
      .create({
        data: {
          campaignId,
          title: "Session prep",
          content: NOTE_TEMPLATES.sessionPrep.content,
          sessionProposalId: proposalId,
        },
        select,
      })
      // Double-click: the other request created it first.
      .catch(() => prisma.dmPage.findUniqueOrThrow({ where: { sessionProposalId: proposalId }, select })));

  revalidateNotebook(campaignId, proposalId);
  return { id: page.id, content: page.content, updatedAt: page.updatedAt.toISOString() };
}
