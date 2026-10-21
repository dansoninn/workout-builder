"use client";

import { useTheme } from "next-themes";
import { useActionState } from "react";
import { toast } from "sonner";

import { FormError, SubmitButton, TextField } from "@/components/forms";
import { THEMES, useMounted } from "@/components/theme";
import { type FormState, initialFormState } from "@/lib/forms";
import { cn } from "@/lib/utils";

import { changePassword, updateProfile } from "./actions";

/** Runs a form action and confirms success with a toast. */
function useFormWithToast(
  run: (prev: FormState, formData: FormData) => Promise<FormState>,
  message: string,
): [FormState, (formData: FormData) => void, boolean] {
  return useActionState(async (prev: FormState, formData: FormData) => {
    const result = await run(prev, formData);
    if (result.ok) toast.success(message);
    return result;
  }, initialFormState);
}

export function NameForm({ displayName }: { displayName: string | null }) {
  const [state, action] = useFormWithToast(updateProfile, "Name saved");
  return (
    <form action={action} className="grid max-w-md gap-4" noValidate>
      <FormError>{state.error}</FormError>
      <TextField
        label="Your name"
        name="displayName"
        autoComplete="name"
        required
        description="Shown to the coaches in your gyms."
        defaultValue={state.values?.displayName ?? displayName ?? ""}
        error={state.fieldErrors?.displayName}
      />
      <div>
        <SubmitButton pendingLabel="Saving…">Save name</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useFormWithToast(changePassword, "Password changed");
  return (
    <form action={action} className="grid max-w-md gap-4" noValidate>
      <FormError>{state.error}</FormError>
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
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
      <div>
        <SubmitButton pendingLabel="Changing…" variant="outline">
          Change password
        </SubmitButton>
      </div>
    </form>
  );
}

export function ThemeChoice() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">Theme</legend>
      <div className="flex flex-wrap gap-2">
        {THEMES.map((t) => (
          <label
            key={t.value}
            className={cn(
              "flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium transition-colors duration-100 hover:bg-hover",
              "has-checked:border-ring has-checked:bg-primary-subtle has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
            )}
          >
            <input
              type="radio"
              name="theme"
              value={t.value}
              checked={mounted && theme === t.value}
              onChange={() => setTheme(t.value)}
              className="sr-only"
            />
            <t.icon className="size-4 text-muted-foreground" aria-hidden />
            {t.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
