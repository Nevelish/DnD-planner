import Link from "next/link";

import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { SkinToggle } from "@/components/layout/skin-toggle";
import { NavLinks } from "@/components/layout/nav-links";
import { D20Icon } from "@/components/icons/d20-icon";

export async function NavBar() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link
          href={user ? "/dashboard" : "/"}
          className="flex items-center gap-2 font-display font-semibold tracking-tight"
        >
          <D20Icon className="size-5 text-primary" />
          DnD Planner
        </Link>

        {user ? <NavLinks className="hidden items-center gap-1 sm:flex" /> : null}

        <div className="flex items-center gap-2">
          <SkinToggle />
          <ThemeToggle />
          {user ? (
            <>
              <NotificationBell />
              <UserMenu
                name={user.name}
                email={user.email}
                isAdmin={user.role === "ADMIN"}
              />
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
        <NavLinks className="flex items-center gap-1 overflow-x-auto border-t px-4 py-1.5 sm:hidden" />
      ) : null}
    </header>
  );
}
