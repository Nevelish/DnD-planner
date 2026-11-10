import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function AuthErrorPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign-in error</CardTitle>
        <CardDescription>
          Something went wrong while signing you in. Please try again.
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-6">
        <Button asChild className="w-full">
          <Link href="/signin">Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
