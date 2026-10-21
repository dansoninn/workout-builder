"use client";

import { useActionState, useEffect, useId, useMemo } from "react";
import { toast } from "sonner";

import { FormError, SubmitButton, TextField } from "@/components/forms";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countries } from "@/lib/countries";
import { initialFormState } from "@/lib/forms";

import { updateGym } from "./actions";

export function GymSettingsForm({ slug, name, country }: { slug: string; name: string; country: string | null }) {
  const [state, action] = useActionState(updateGym.bind(null, slug), initialFormState);
  const countryId = useId();
  const countryItems = useMemo(() => countries().map((c) => ({ value: c.code, label: c.name })), []);

  useEffect(() => {
    if (state.ok) toast.success("Gym settings saved");
  }, [state]);

  return (
    <form action={action} className="grid max-w-md gap-4" noValidate>
      <FormError>{state.error}</FormError>
      <TextField
        label="Gym name"
        name="name"
        required
        defaultValue={state.values?.name ?? name}
        error={state.fieldErrors?.name}
      />
      <Field className="gap-1.5">
        <FieldLabel htmlFor={countryId}>
          Country <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Select name="country" items={countryItems} defaultValue={state.values?.country || country}>
          <SelectTrigger id={countryId} className="w-full">
            <SelectValue placeholder="Choose a country" />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="max-h-72">
            {countryItems.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div>
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
