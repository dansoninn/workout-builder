"use client";

import { useActionState } from "react";

import { AuthHeading } from "@/components/auth/auth-page";
import { FormError, SubmitButton, TextField } from "@/components/forms";
import { initialFormState } from "@/lib/forms";

import { resetPassword } from "../actions";

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPassword, initialFormState);
  return (
    <>
      <AuthHeading title="Choose a new password" />
      <form action={action} className="grid gap-4" noValidate>
        <FormError>{state.error}</FormError>
        <TextField
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          minLength={8}
          description="At least 8 characters."
          error={state.fieldErrors?.password}
        />
        <TextField
          label="Repeat the new password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          error={state.fieldErrors?.confirm}
        />
        <SubmitButton pendingLabel="Saving…" size="lg">
          Save and continue
        </SubmitButton>
      </form>
    </>
  );
}
