import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PublicUrlForm } from "@/components/admin/public-url-form";

export default async function AdminSettingsPage() {
  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Public URL</CardTitle>
        <CardDescription>
          The address other people use to reach this server — your
          Cloudflare Tunnel domain, for example. Invite links and calendar
          subscription links are built from this instead of whatever address
          happens to be in the browser&apos;s URL bar. Leave blank to fall
          back to the NEXTAUTH_URL environment variable, or the incoming
          request&apos;s own address.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <PublicUrlForm currentUrl={settings?.publicUrl ?? ""} />
      </CardContent>
    </Card>
  );
}
