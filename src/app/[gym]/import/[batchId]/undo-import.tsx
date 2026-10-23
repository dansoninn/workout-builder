"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { undoImport } from "../actions";

/** Undo the whole import in one step, after saying what that does. */
export function UndoImport({ slug, batchId, workouts }: { slug: string; batchId: string; workouts: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const undo = () =>
    startTransition(async () => {
      const result = await undoImport(slug, batchId);
      if (!result.ok) return void toast.error(result.error);
      setOpen(false);
      toast.success(`Import undone: ${result.removed} workouts taken off${result.restored ? `, ${result.restored} brought back` : ""}`);
    });
  return (
    <div>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Undo the whole import
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Undo the import?</DialogTitle>
            <DialogDescription>
              Its {workouts} workouts are taken off the calendar (as when you delete a workout), also any you changed since; workouts it replaced come back, and its day focuses and closed
              days are cleared. Names it taught the gym for words stay.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Keep it</DialogClose>
            <Button variant="destructive" onClick={undo} disabled={pending}>
              {pending ? "Undoing…" : "Undo the import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
