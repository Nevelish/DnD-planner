/** What's needed to draw someone's picture: an uploaded avatar wins, then
 * the picture from their Discord sign-in, then their initials. */
export type AvatarUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  avatarUpdatedAt?: Date | string | null;
};

export function avatarSrc(user: AvatarUser): string | null {
  if (user.avatarUpdatedAt) {
    // The version in the URL lets browsers cache the image for good and
    // still pick up a new upload straight away.
    return `/api/avatar/${user.id}?v=${new Date(user.avatarUpdatedAt).getTime()}`;
  }
  if (user.image?.startsWith("https://")) return user.image;
  return null;
}

/** "Dana the DM" → "DD", "Rin" → "RI", "sam.berg@example.com" → "SB". */
export function avatarInitials(user: AvatarUser): string {
  const source = (user.name?.trim() || user.email?.split("@")[0] || "?").trim();
  const words = source.split(/[\s._-]+/).filter(Boolean);
  const letters =
    words.length > 1 ? words[0][0] + words[words.length - 1][0] : source.slice(0, 2);
  return letters.toUpperCase();
}
