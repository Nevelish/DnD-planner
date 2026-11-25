/**
 * Errors a server action throws for the user to read ("Only the DM can do
 * that.", "That date is already in the poll.").
 *
 * In production builds Next replaces the message of anything a server action
 * throws with a generic one ("Minified React error #441…"), so the browser
 * never sees a plain Error's message. An error's `digest` does reach the
 * browser unchanged, though, so a UserError carries its message there too,
 * and `errorMessage` reads it back out on the client.
 *
 * Imported by both server actions and client components: keep it free of
 * server-only code.
 */
const PREFIX = "user-error:";

export class UserError extends Error {
  readonly digest: string;

  constructor(message: string) {
    super(message);
    this.name = "UserError";
    this.digest = PREFIX + message;
  }
}

/** The message to show for an error caught from a server action. */
export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
  const digest = (error as { digest?: unknown } | null)?.digest;
  if (typeof digest === "string" && digest.startsWith(PREFIX)) return digest.slice(PREFIX.length);
  // Development builds keep the real message; production ones only have a
  // generic one, which is no use to anyone reading it.
  if (process.env.NODE_ENV !== "production" && error instanceof Error && error.message) return error.message;
  return fallback;
}
