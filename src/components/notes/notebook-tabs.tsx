"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ImagesIcon, NotebookPenIcon, UsersIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** Switches between your own notebook and the party's (and, for the DM,
 * the campaign's pictures). */
export function NotebookTabs({ campaignId, isDM }: { campaignId: string; isDM: boolean }) {
  const pathname = usePathname();
  const base = `/campaigns/${campaignId}/notes`;
  const tabs = [
    { href: base, label: isDM ? "DM notebook" : "My notebook", icon: NotebookPenIcon },
    { href: `${base}/party`, label: "Party notebook", icon: UsersIcon },
    ...(isDM ? [{ href: `${base}/pictures`, label: "Pictures", icon: ImagesIcon }] : []),
  ];

  return (
    <nav aria-label="Notebooks" className="inline-flex w-fit max-w-full flex-wrap gap-1 rounded-lg bg-muted p-1">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              active && "bg-background text-foreground shadow-sm",
            )}
          >
            <Icon className="size-4" /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
