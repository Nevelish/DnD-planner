import { avatarInitials, avatarSrc, type AvatarUser } from "@/lib/avatar";
import { cn } from "@/lib/utils";

/** A round profile picture, falling back to initials. Decorative: the
 * person's name is always shown next to it (or given by the parent). */
export function UserAvatar({ user, className }: { user: AvatarUser; className?: string }) {
  const src = avatarSrc(user);
  const base = "size-8 shrink-0 rounded-full";

  if (src) {
    return (
      // Served by our own route or Discord's CDN, both already sized for
      // this; next/image would need Discord on its remote-host allowlist.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={cn(base, "border bg-muted object-cover", className)} />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        base,
        "inline-flex select-none items-center justify-center bg-muted text-xs font-semibold text-muted-foreground",
        className,
      )}
    >
      {avatarInitials(user)}
    </span>
  );
}
