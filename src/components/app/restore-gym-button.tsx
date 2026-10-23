"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { restoreGym } from "@/app/(auth)/onboarding/actions";
import { Button } from "@/components/ui/button";

export function RestoreGymButton({ gymId, name }: { gymId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      aria-label={`Bring back ${name}`}
      onClick={() =>
        startTransition(async () => {
          const result = await restoreGym(gymId);
          if (result) toast.error(result.error);
        })
      }
    >
      {pending ? "Bringing back…" : "Bring back"}
    </Button>
  );
}
