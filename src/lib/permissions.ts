import "server-only";
import { redirect, notFound } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Use in Server Actions / route handlers, where throwing a plain Error is
 * preferable to a Next.js redirect so the caller can surface a form error.
 */
export class PermissionError extends Error {}

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** For Server Components/pages: bounces an unauthenticated visitor to sign-in. */
export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/signin");
  return userId;
}

export async function getMembership(campaignId: string, userId: string) {
  return prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId, userId } },
  });
}

// ---------- Server Action guards (throw, so the action can report the error) ----------

export async function requireMember(campaignId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new PermissionError("You must be signed in.");
  }
  const membership = await getMembership(campaignId, session.user.id);
  if (!membership) {
    throw new PermissionError("You are not a member of this campaign.");
  }
  return membership;
}

export async function requireDM(campaignId: string) {
  const membership = await requireMember(campaignId);
  if (membership.role !== "DM") {
    throw new PermissionError("Only the DM can do that.");
  }
  return membership;
}

export async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new PermissionError("You must be signed in.");
  }
  if (session.user.role !== "ADMIN") {
    throw new PermissionError("Only an admin can do that.");
  }
  return session.user.id;
}

// ---------- Page guards (redirect/404, for Server Components) ----------

export async function requireMembershipForPage(campaignId: string) {
  const userId = await requireUserId();
  const membership = await getMembership(campaignId, userId);
  if (!membership) notFound();
  return { userId, membership };
}

export async function requireDMForPage(campaignId: string) {
  const { userId, membership } = await requireMembershipForPage(campaignId);
  if (membership.role !== "DM") notFound();
  return { userId, membership };
}

export async function requireAdminForPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");
  if (session.user.role !== "ADMIN") notFound();
  return { userId: session.user.id };
}
