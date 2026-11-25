import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

import type { RsvpAnswer } from "@/lib/rsvp";

/**
 * The link the bot gives someone who clicked a button without being in the
 * campaign yet. It carries who clicked (their Discord id) and what they
 * clicked: an RSVP (the session and their answer) or a poll's Vote button.
 * Signed so it can't be altered, and expires after a day.
 */
export type JoinLinkData = {
  discordId: string;
  campaignId: string;
  expiresAt: number;
} & ({ sessionId: string; status: RsvpAnswer; pollId?: never } | { pollId: string; sessionId?: never; status?: never });

const LIFETIME_MS = 24 * 60 * 60_000;

function secret() {
  const value = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("NEXTAUTH_SECRET isn't set.");
  return value;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(`discord-join:${payload}`).digest("base64url");

/** What a join link is for: an RSVP, or a poll's Vote button. */
export type JoinTarget = { sessionId: string; status: RsvpAnswer } | { pollId: string };
type JoinLinkInput = { discordId: string; campaignId: string } & JoinTarget;

export function createJoinToken(data: JoinLinkInput, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ ...data, expiresAt: now + LIFETIME_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** The link's contents, or null if it was altered or has expired. */
export function readJoinToken(token: string | undefined, now = Date.now()): JoinLinkData | null {
  const [payload, signature] = (token ?? "").split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as JoinLinkData;
    if (typeof data.expiresAt !== "number" || data.expiresAt < now) return null;
    const isRsvp = typeof data.sessionId === "string" && ["YES", "MAYBE", "NO"].includes(data.status ?? "");
    const isPoll = typeof data.pollId === "string" && !data.sessionId;
    if (!isRsvp && !isPoll) return null;
    return data;
  } catch {
    return null;
  }
}
