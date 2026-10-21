import { z } from "zod";

/**
 * What a form's Server Action returns to `useActionState`: a message for the
 * whole form, messages per field, and the values to put back after an error.
 */
export type FormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string | undefined>;
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};

/** First message per field, from a failed zod parse. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}

/** The form's text fields (never passwords) to refill after an error. */
export function keepValues(formData: FormData, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((n) => [n, String(formData.get(n) ?? "")]));
}

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address" }));

export const newPasswordSchema = z
  .string()
  .min(8, { error: "Use at least 8 characters" })
  .max(72, { error: "Use at most 72 characters" });

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Enter your name" })
  .max(80, { error: "Use at most 80 characters" });
