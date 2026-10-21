"use client";

import { useActionState, useId, useMemo, useState } from "react";

import { FormError, SubmitButton, TextField } from "@/components/forms";
import { useMounted } from "@/components/theme";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { countries } from "@/lib/countries";
import { initialFormState } from "@/lib/forms";
import { slugify } from "@/lib/slug";

import { createGym } from "./actions";

/** Name → address (follows the name until edited) → country. */
export function GymForm() {
  const [state, action] = useActionState(createGym, initialFormState);
  const [name, setName] = useState(state.values?.name ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(state.values?.slug));
  const [customSlug, setCustomSlug] = useState(state.values?.slug ?? "");
  const slug = slugEdited ? customSlug : slugify(name);

  const mounted = useMounted();
  const host = mounted ? window.location.host : "";
  const slugId = useId();
  const countryId = useId();
  const countryItems = useMemo(() => countries().map((c) => ({ value: c.code, label: c.name })), []);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormError>{state.error}</FormError>
      <TextField
        label="Gym name"
        name="name"
        autoFocus
        required
        autoComplete="organization"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={state.fieldErrors?.name}
      />

      <Field data-invalid={state.fieldErrors?.slug ? true : undefined} className="gap-1.5">
        <FieldLabel htmlFor={slugId}>Address</FieldLabel>
        <InputGroup>
          <InputGroupAddon className="pr-0 font-normal text-subtle-foreground">{host}/</InputGroupAddon>
          <InputGroupInput
            id={slugId}
            name="slug"
            required
            spellCheck={false}
            autoCapitalize="none"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
            }}
            aria-invalid={state.fieldErrors?.slug ? true : undefined}
            aria-describedby={`${slugId}-help`}
          />
        </InputGroup>
        {state.fieldErrors?.slug ? (
          <FieldError id={`${slugId}-help`} className="text-xs">
            {state.fieldErrors.slug}
          </FieldError>
        ) : (
          <FieldDescription id={`${slugId}-help`} className="text-xs">
            Your gym&apos;s pages live here, e.g. /{slug || "your-gym"}/builder.
          </FieldDescription>
        )}
      </Field>

      <Field className="gap-1.5">
        <FieldLabel htmlFor={countryId}>
          Country <span className="font-normal text-muted-foreground">(optional)</span>
        </FieldLabel>
        <Select name="country" items={countryItems} defaultValue={state.values?.country || null}>
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

      <SubmitButton pendingLabel="Creating gym…" size="lg">
        Create gym
      </SubmitButton>
    </form>
  );
}
