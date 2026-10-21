"use client";

import { useActionState } from "react";

import { signUp } from "@/app/(auth)/actions";
import { NextInput } from "@/components/auth/auth-page";
import { FormError, FormSuccess, SubmitButton, TextField } from "@/components/forms";
import { initialFormState } from "@/lib/forms";

/**
 * Create an account. On an invitation page the email is fixed to the invited
 * address and `next` points back to the invitation.
 */
export function SignUpForm({
  invitedEmail,
  next,
  submitLabel = "Create account",
}: {
  invitedEmail?: string;
  next?: string;
  submitLabel?: string;
}) {
  const [state, action] = useActionState(signUp, initialFormState);

  if (state.ok) {
    return (
      <FormSuccess>
        Check your email. We sent a link to <strong className="font-medium">{state.values?.email}</strong> to confirm
        your account.
      </FormSuccess>
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : <NextInput />}
      <FormError>{state.error}</FormError>
      <TextField
        label="Your name"
        name="displayName"
        autoComplete="name"
        autoFocus
        required
        description="Shown to the coaches in your gym."
        defaultValue={state.values?.displayName}
        error={state.fieldErrors?.displayName}
      />
      {invitedEmail ? (
        <TextField label="Email" name="email" type="email" value={invitedEmail} readOnly description="The invitation is for this address." />
      ) : (
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          error={state.fieldErrors?.email}
        />
      )}
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        description="At least 8 characters."
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Creating account…" size="lg">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
