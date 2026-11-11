"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  KeyRoundIcon,
  MoreVerticalIcon,
  ShieldIcon,
  ShieldOffIcon,
  UserCheckIcon,
  UserXIcon,
} from "lucide-react";

import { setUserDisabled, setUserRole } from "@/lib/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: "ADMIN" | "USER";
  disabled: boolean;
  hasPassword: boolean;
  createdAt: string;
};

export function UsersTable({
  users,
  currentUserId,
}: {
  users: UserRow[];
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);

  function run(action: () => Promise<void>, successMessage: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  }

  return (
    <>
      <ul className="flex flex-col divide-y rounded-lg border">
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <li
              key={user.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {user.name ?? user.email}
                  {isSelf && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      (you)
                    </span>
                  )}
                </span>
                {user.email && user.name && (
                  <span className="text-xs text-muted-foreground">
                    {user.email}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                  {user.role === "ADMIN" ? "Admin" : "User"}
                </Badge>
                <Badge variant="outline">
                  {user.hasPassword ? "Email" : "Discord"}
                </Badge>
                {user.disabled && <Badge variant="destructive">Disabled</Badge>}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" disabled={isPending}>
                      <MoreVerticalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {user.role === "USER" ? (
                      <DropdownMenuItem
                        onSelect={() =>
                          run(() => setUserRole(user.id, "ADMIN"), "Promoted to admin.")
                        }
                      >
                        <ShieldIcon /> Make admin
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onSelect={() =>
                          run(
                            () => setUserRole(user.id, "USER"),
                            "Admin rights removed.",
                          )
                        }
                      >
                        <ShieldOffIcon /> Remove admin
                      </DropdownMenuItem>
                    )}
                    {user.hasPassword && (
                      <DropdownMenuItem onSelect={() => setResetTarget(user)}>
                        <KeyRoundIcon /> Reset password
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    {user.disabled ? (
                      <DropdownMenuItem
                        onSelect={() =>
                          run(
                            () => setUserDisabled(user.id, false),
                            "Account re-enabled.",
                          )
                        }
                      >
                        <UserCheckIcon /> Enable account
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={isSelf}
                        onSelect={() =>
                          run(
                            () => setUserDisabled(user.id, true),
                            "Account disabled.",
                          )
                        }
                      >
                        <UserXIcon /> Disable account
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>

      <ResetPasswordDialog
        user={resetTarget}
        onOpenChange={(open) => !open && setResetTarget(null)}
      />
    </>
  );
}
