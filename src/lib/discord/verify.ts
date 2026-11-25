import "server-only";
import { createPublicKey, verify } from "node:crypto";

// DER prefix that turns a raw 32-byte Ed25519 public key into SPKI form,
// which is what Node's crypto accepts.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Checks that an interaction really came from Discord: it's signed with the
 * application's Ed25519 key over the timestamp header followed by the raw
 * body. Discord requires rejecting anything that fails with a 401.
 */
export function verifyDiscordSignature(
  rawBody: string,
  signatureHex: string | null,
  timestamp: string | null,
  publicKeyHex: string,
): boolean {
  if (!signatureHex || !timestamp || !/^[0-9a-f]{128}$/i.test(signatureHex)) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signatureHex, "hex"));
  } catch {
    return false;
  }
}
