"use client";

import Link from "next/link";
import { useActionState } from "react";

import { NextInput } from "@/components/auth/auth-page";
import { FormError, SubmitButton, TextField } from "@/components/forms";
import { initialFormState } from "@/lib/forms";

import { signIn } from "../actions";

export function SignInForm() {
  const [state, action] = useActionState(signIn, initialFormState);
  return (
    <form action={action} className="grid gap-4" noValidate>
      <NextInput />
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
      <div className="grid gap-1.5">
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />
        <Link
          href="/forgot-password"
          className="justify-self-end text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Forgot password?
        </Link>
      </div>
      <SubmitButton pendingLabel="Signing in…" size="lg">
        Sign in
      </SubmitButton>
    </form>
  );
}
