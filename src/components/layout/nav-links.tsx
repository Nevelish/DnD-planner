"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/calendar", label: "Calendar" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav className={className}>
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Button key={link.href} variant="ghost" asChild size="sm">
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "text-muted-foreground hover:text-foreground",
                active && "nav-link-active text-foreground",
              )}
            >
              {link.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
