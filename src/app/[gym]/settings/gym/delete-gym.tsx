"use client";

import { useActionState, useState } from "react";

import { FormError, SubmitButton, TextField } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { initialFormState } from "@/lib/forms";

import { deleteGym } from "./actions";

/** Deleting the gym, behind a confirmation that asks for its name (PLAN-step-6 6c). */
export function DeleteGym({ slug, name }: { slug: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteGym.bind(null, slug), initialFormState);
  return (
    <>
      <Button variant="destructive" className="w-fit" onClick={() => setOpen(true)}>
        Delete this gym…
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>
              The gym disappears for everyone in it at once. For 30 days its owners can bring it back, as it was. After that it is
              erased for good, with its programs, workouts, results, exercises and history.
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="grid gap-4" noValidate>
            <FormError>{state.error}</FormError>
            <TextField
              label={`Type ${name} to confirm`}
              name="confirm"
              autoComplete="off"
              autoFocus
              defaultValue={state.values?.confirm}
              error={state.fieldErrors?.confirm}
            />
            <DialogFooter>
              <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
              <SubmitButton variant="destructive" pendingLabel="Deleting…">
                Delete the gym
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
