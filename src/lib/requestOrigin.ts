import "server-only";
import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";

/** The app's own origin, for building absolute URLs from a Server
 * Component (which has no request URL the way a Route Handler does).
 * Prefers the admin-configured public URL (/admin/settings) — the right
 * answer when the app sits behind a tunnel/reverse proxy, since neither
 * NEXTAUTH_URL nor the Host header is guaranteed to be the public address —
 * then NEXTAUTH_URL, then falls back to the incoming request's own Host
 * header. */
export async function getRequestOrigin(): Promise<string> {
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { publicUrl: true },
  });
  if (settings?.publicUrl) return settings.publicUrl;

  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
