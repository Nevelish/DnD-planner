import Link from "next/link";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/calendar", label: "Calendar" },
];

export async function NavBar() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href={user ? "/dashboard" : "/"} className="font-semibold tracking-tight">
          🎲 DnD Planner
        </Link>

        {user ? (
          <nav className="hidden items-center gap-1 sm:flex">
            {links.map((link) => (
              <Button key={link.href} variant="ghost" asChild size="sm">
                <Link href={link.href}>{link.label}</Link>
              </Button>
            ))}
          </nav>
        ) : null}

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <NotificationBell />
              <UserMenu name={user.name} email={user.email} />
            </>
          ) : (
            <>
              <Button variant="ghost" asChild size="sm">
                <Link href="/signin">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
      {user ? (
        <nav className="flex items-center gap-1 overflow-x-auto border-t px-4 py-1.5 sm:hidden">
          {links.map((link) => (
            <Button key={link.href} variant="ghost" asChild size="sm">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
