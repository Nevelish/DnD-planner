import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersTable } from "@/components/admin/users-table";
import { CreateUserDialog } from "@/components/admin/create-user-dialog";

export default async function AdminUsersPage() {
  const session = await auth();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      disabled: true,
      passwordHash: true,
      createdAt: true,
    },
  });

  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    disabled: u.disabled,
    hasPassword: u.passwordHash !== null,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "account" : "accounts"}
        </p>
        <CreateUserDialog />
      </div>
      <UsersTable users={rows} currentUserId={session?.user?.id ?? ""} />
    </div>
  );
}
