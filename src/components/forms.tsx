"use client";

import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { useId } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type InputProps = React.ComponentProps<typeof Input>;

/** Label, input, help text and error message, wired together for screen readers. */
export function TextField({
  label,
  description,
  error,
  className,
  ...input
}: InputProps & { label: string; description?: React.ReactNode; error?: string; name: string }) {
  const id = useId();
  const describedBy = [description && `${id}-description`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <Field data-invalid={error ? true : undefined} className={cn("gap-1.5", className)}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {description && (
        <FieldDescription id={`${id}-description`} className="text-xs">
          {description}
        </FieldDescription>
      )}
      {error && (
        <FieldError id={`${id}-error`} className="text-xs">
          {error}
        </FieldError>
      )}
    </Field>
  );
}

/** A form-level problem, announced to screen readers. */
export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** A confirmation that something happened (email sent, saved). */
export function FormSuccess({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div role="status" className="flex items-start gap-2 rounded-md bg-success-subtle px-3 py-2 text-sm text-success">
      <CircleCheckIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Submit button that says what it is doing while the form is sending. */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: React.ComponentProps<typeof Button> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-disabled={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
