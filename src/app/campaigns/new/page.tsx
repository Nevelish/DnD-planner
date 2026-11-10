import { createCampaign } from "@/lib/actions/campaign";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function NewCampaignPage() {
  return (
    <div className="mx-auto w-full max-w-lg flex-1 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Create a campaign</CardTitle>
          <CardDescription>You&apos;ll be the DM of this campaign.</CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          <form action={createCampaign} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Campaign name</Label>
              <Input
                id="name"
                name="name"
                required
                placeholder="Curse of the Crimson Throne"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="What's this campaign about?"
              />
            </div>
            <Button type="submit">Create campaign</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
