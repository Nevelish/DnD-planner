import { requireAdminForPage } from "@/lib/permissions";
import { TabNav } from "@/components/layout/tab-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminForPage();

  const tabs = [
    { href: "/admin/settings", label: "Settings" },
    { href: "/admin/users", label: "Users" },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight">Admin</h1>
      <TabNav tabs={tabs} />
      {children}
    </div>
  );
}
