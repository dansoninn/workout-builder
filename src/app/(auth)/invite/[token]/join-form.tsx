"use client";

import { useActionState } from "react";

import { FormError, SubmitButton } from "@/components/forms";
import { initialFormState } from "@/lib/forms";

import { acceptInvitation } from "./actions";

export function JoinForm({ token, gymName }: { token: string; gymName: string }) {
  const [state, action] = useActionState(acceptInvitation, initialFormState);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <FormError>{state.error}</FormError>
      <SubmitButton pendingLabel="Joining…" size="lg" autoFocus>
        Join {gymName}
      </SubmitButton>
    </form>
  );
}
