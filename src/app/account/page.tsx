import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/permissions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default async function AccountPage() {
  const userId = await requireUserId();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
      <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight">Account</h1>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 pb-6 text-sm">
            <p>{user.name}</p>
            <p className="text-muted-foreground">{user.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            {!user.passwordHash && (
              <CardDescription>
                This account signs in with Discord and has no password to
                change.
              </CardDescription>
            )}
          </CardHeader>
          {user.passwordHash && (
            <CardContent className="pb-6">
              <ChangePasswordForm />
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
