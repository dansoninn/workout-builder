"use client";

import Link from "next/link";
import { useActionState } from "react";

import { AuthHeading } from "@/components/auth/auth-page";
import { FormError, FormSuccess, SubmitButton, TextField } from "@/components/forms";
import { initialFormState } from "@/lib/forms";

import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initialFormState);
  return (
    <>
      <AuthHeading title="Reset your password">We&apos;ll email you a link to choose a new one.</AuthHeading>
      {state.ok ? (
        <FormSuccess>
          If there is an account for <strong className="font-medium">{state.values?.email}</strong>, a link is on its
          way. It works once, for one hour.
        </FormSuccess>
      ) : (
        <form action={action} className="grid gap-4" noValidate>
          <FormError>{state.error}</FormError>
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            defaultValue={state.values?.email}
            error={state.fieldErrors?.email}
          />
          <SubmitButton pendingLabel="Sending…" size="lg">
            Send reset link
          </SubmitButton>
        </form>
      )}
      <p className="mt-6 text-muted-foreground">
        <Link href="/sign-in" className="font-medium text-primary-text underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
