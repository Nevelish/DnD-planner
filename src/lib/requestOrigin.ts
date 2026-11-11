import "server-only";
import { headers } from "next/headers";

/** The app's own origin, for building absolute URLs from a Server
 * Component (which has no request URL the way a Route Handler does).
 * Prefers NEXTAUTH_URL (already required config); falls back to the
 * incoming request's own Host header otherwise. */
export async function getRequestOrigin(): Promise<string> {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
