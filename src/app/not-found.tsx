import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ROUTES } from "@/constants/routes";

export default function NotFound() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      action={
        <Link href={ROUTES.home}>
          <Button variant="outline">Back to home</Button>
        </Link>
      }
    />
  );
}
