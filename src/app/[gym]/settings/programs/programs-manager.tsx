"use client";

import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useOptimistic, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

import { ReadOnlyNote, SettingsSection } from "@/components/app/settings";
import { FormError, SubmitButton, TextField } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { type FormState, initialFormState } from "@/lib/forms";
import { TRACK_COLORS, trackColorLabel } from "@/lib/tracks";
import { cn } from "@/lib/utils";

import { reorderPrograms, saveTrack, setTrackArchived } from "./actions";

export type Track = { id: string; name: string; color: string | null; archived: boolean };

export function TrackDot({ color, className }: { color: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", !color && "border border-border-strong", className)}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

export function ProgramsManager({ slug, canManage, tracks }: { slug: string; canManage: boolean; tracks: Track[] }) {
  const [optimistic, setArchivedOptimistic] = useOptimistic(tracks, (state, change: { id: string; archived: boolean }) =>
    state.map((t) => (t.id === change.id ? { ...t, archived: change.archived } : t)),
  );
  // A new order shows at once; the server's order replaces it when it arrives.
  const [order, setOrder] = useState<string[] | null>(null);
  const [orderedFrom, setOrderedFrom] = useState(tracks);
  if (orderedFrom !== tracks) {
    setOrderedFrom(tracks);
    setOrder(null);
  }
  const shown = order ? order.flatMap((id) => optimistic.filter((t) => t.id === id)) : optimistic;
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<Track | "new" | null>(null);
  const [formKey, setFormKey] = useState(0);

  // ⌘K → "New program" arrives as ?new=1.
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const newRequested = canManage && searchParams.has("new");
  const openEditor = (target: Track | "new" | null) => {
    if (target) setFormKey((k) => k + 1);
    setEditing(target);
    if (!target && newRequested) router.replace(pathname, { scroll: false });
  };

  const active = shown.filter((t) => !t.archived);
  const archived = shown.filter((t) => t.archived);

  const onArchive = (track: Track, archive: boolean) =>
    startTransition(async () => {
      setArchivedOptimistic({ id: track.id, archived: archive });
      const result = await setTrackArchived(slug, track.id, archive);
      if (result.ok) toast.success(archive ? `${track.name} archived` : `${track.name} restored`);
      else toast.error(result.error);
    });

  // The order set here is the order everywhere (calendar columns, pickers). Archived programs follow, in theirs.
  const onMove = (track: Track, direction: -1 | 1) => {
    const ids = active.map((t) => t.id);
    const from = ids.indexOf(track.id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to]!, ids[from]!];
    const all = [...ids, ...archived.map((t) => t.id)];
    flushSync(() => setOrder(all));
    // The keyboard stays on the moved program: the same arrow, or the other one at either end.
    const arrow = (d: number) => document.querySelector<HTMLButtonElement>(`[data-order="${track.id}:${d}"]`);
    const same = arrow(direction);
    (same && !same.disabled ? same : arrow(-direction))?.focus();
    startTransition(async () => {
      const result = await reorderPrograms(slug, all);
      if (!result.ok) {
        toast.error(result.error);
        setOrder(null);
      }
    });
  };

  const rows = (list: Track[]) => (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {list.map((t, index) => (
        <li key={t.id} className="flex h-11 items-center gap-3 px-3">
          <TrackDot color={t.color} />
          <span className={cn("flex-1 truncate font-medium", t.archived && "text-muted-foreground")}>{t.name}</span>
          <span className="sr-only">Colour: {trackColorLabel(t.color)}</span>
          {t.archived && <Badge variant="outline">Archived</Badge>}
          {canManage && (
            <div className="flex gap-1">
              {!t.archived && list.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-order={`${t.id}:-1`}
                    disabled={index === 0}
                    onClick={() => onMove(t, -1)}
                    aria-label={`Move ${t.name} up`}
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    data-order={`${t.id}:1`}
                    disabled={index === list.length - 1}
                    onClick={() => onMove(t, 1)}
                    aria-label={`Move ${t.name} down`}
                  >
                    <ArrowDownIcon />
                  </Button>
                </>
              )}
              {!t.archived && (
                <Button variant="ghost" size="sm" onClick={() => openEditor(t)} aria-label={`Edit ${t.name}`}>
                  Edit
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled={!t.archived && active.length === 1}
                onClick={() => onArchive(t, !t.archived)}
                aria-label={`${t.archived ? "Restore" : "Archive"} ${t.name}`}
              >
                {t.archived ? "Restore" : "Archive"}
              </Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="grid grid-cols-1 gap-10">
      <SettingsSection
        title="Programs"
        description="The gym's programs that run side by side, each named as you like: Class, Strength club, Endurance. Their order here is their order everywhere."
        action={
          canManage && (
            <Button onClick={() => openEditor("new")}>
              <PlusIcon /> New program
            </Button>
          )
        }
      >
        {active.length === 0 ? (
          <div className="grid justify-items-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-8 text-center">
            <p className="font-medium">{archived.length > 0 ? "No active programs" : "No programs yet"}</p>
            <p className="max-w-sm text-muted-foreground">
              {canManage
                ? `Every workout belongs to a program. Create one${archived.length > 0 ? ", or restore an archived one below" : ""}.`
                : "An owner or head coach can create the gym's programs."}
            </p>
            {canManage && (
              <Button variant="outline" className="mt-2" onClick={() => openEditor("new")}>
                <PlusIcon /> Create a program
              </Button>
            )}
          </div>
        ) : (
          rows(active)
        )}
        {canManage && active.length === 1 && (
          <p className="text-xs text-muted-foreground">Every workout belongs to a program, so a gym always keeps at least one active.</p>
        )}
        {!canManage && <ReadOnlyNote>Owners and head coaches manage programs.</ReadOnlyNote>}
      </SettingsSection>

      {archived.length > 0 && (
        <SettingsSection title="Archived" description="Hidden from new programming. Their workouts are kept.">
          {rows(archived)}
        </SettingsSection>
      )}

      {canManage && (
        <TrackDialog
          key={formKey}
          slug={slug}
          track={editing === "new" || (newRequested && !editing) ? null : editing}
          open={editing !== null || newRequested}
          onOpenChange={(open) => !open && openEditor(null)}
        />
      )}
    </div>
  );
}

function TrackDialog({
  slug,
  track,
  open,
  onOpenChange,
}: {
  slug: string;
  track: Track | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, action] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await saveTrack(slug, track?.id ?? null, prev, formData);
    if (result.ok) {
      toast.success(track ? "Program saved" : `${result.values?.name} created`);
      onOpenChange(false);
    }
    return result;
  }, initialFormState);
  const [color, setColor] = useState(track?.color?.toUpperCase() ?? TRACK_COLORS[0]?.value ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{track ? `Edit ${track.name}` : "New program"}</DialogTitle>
          <DialogDescription>The colour marks this program&apos;s workouts in the calendar.</DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4" noValidate>
          <FormError>{state.error}</FormError>
          <TextField
            label="Name"
            name="name"
            autoFocus
            required
            placeholder="Class"
            defaultValue={state.values?.name ?? track?.name}
            error={state.fieldErrors?.name}
          />
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {TRACK_COLORS.map((c) => (
                <label
                  key={c.value}
                  className="relative flex size-8 cursor-pointer items-center justify-center rounded-md border border-border transition-colors duration-100 hover:bg-hover has-checked:border-ring has-checked:bg-hover has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring"
                  title={c.label}
                >
                  <input
                    type="radio"
                    name="color"
                    value={c.value}
                    checked={color === c.value}
                    onChange={() => setColor(c.value)}
                    className="sr-only"
                    aria-label={c.label}
                  />
                  <span className="size-4 rounded-full" style={{ backgroundColor: c.value }} aria-hidden />
                </label>
              ))}
            </div>
            {state.fieldErrors?.color && <FieldError className="text-xs">{state.fieldErrors.color}</FieldError>}
          </fieldset>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Cancel</DialogClose>
            <SubmitButton pendingLabel="Saving…">{track ? "Save program" : "Create program"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
