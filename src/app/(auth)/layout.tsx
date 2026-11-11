import Link from "next/link";

import { D20Icon } from "@/components/icons/d20-icon";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-muted/40 px-4 py-16">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 font-display text-xl font-semibold tracking-tight"
      >
        <D20Icon className="size-6 text-primary" />
        DnD Planner
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
