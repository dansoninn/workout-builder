"use client";

import { PlusIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useActionState, useOptimistic, useState, useTransition } from "react";
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

import { saveTrack, setTrackArchived } from "./actions";

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

export function TracksManager({ slug, canManage, tracks }: { slug: string; canManage: boolean; tracks: Track[] }) {
  const [shown, setArchivedOptimistic] = useOptimistic(tracks, (state, change: { id: string; archived: boolean }) =>
    state.map((t) => (t.id === change.id ? { ...t, archived: change.archived } : t)),
  );
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<Track | "new" | null>(null);
  const [formKey, setFormKey] = useState(0);

  // ⌘K → "New track" arrives as ?new=1.
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

  const rows = (list: Track[]) => (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
      {list.map((t) => (
        <li key={t.id} className="flex h-11 items-center gap-3 px-3">
          <TrackDot color={t.color} />
          <span className={cn("flex-1 truncate font-medium", t.archived && "text-muted-foreground")}>{t.name}</span>
          <span className="sr-only">Colour: {trackColorLabel(t.color)}</span>
          {t.archived && <Badge variant="outline">Archived</Badge>}
          {canManage && (
            <div className="flex gap-1">
              {!t.archived && (
                <Button variant="ghost" size="sm" onClick={() => openEditor(t)} aria-label={`Edit ${t.name}`}>
                  Edit
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
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
        title="Tracks"
        description="Programming streams that run side by side, like Class, Strength club or Endurance."
        action={
          canManage && (
            <Button onClick={() => openEditor("new")}>
              <PlusIcon /> New track
            </Button>
          )
        }
      >
        {active.length === 0 ? (
          <div className="grid justify-items-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-8 text-center">
            <p className="font-medium">No tracks yet</p>
            <p className="max-w-sm text-muted-foreground">
              {canManage
                ? "Most gyms start with one track for their classes. Every workout belongs to a track."
                : "An owner or head coach can create the gym's tracks."}
            </p>
            {canManage && (
              <Button variant="outline" className="mt-2" onClick={() => openEditor("new")}>
                <PlusIcon /> Create the first track
              </Button>
            )}
          </div>
        ) : (
          rows(active)
        )}
        {!canManage && <ReadOnlyNote>Owners and head coaches manage tracks.</ReadOnlyNote>}
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
      toast.success(track ? "Track saved" : `${result.values?.name} created`);
      onOpenChange(false);
    }
    return result;
  }, initialFormState);
  const [color, setColor] = useState(track?.color?.toUpperCase() ?? TRACK_COLORS[0]?.value ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{track ? `Edit ${track.name}` : "New track"}</DialogTitle>
          <DialogDescription>The colour marks this track&apos;s workouts in the calendar.</DialogDescription>
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
            <SubmitButton pendingLabel="Saving…">{track ? "Save track" : "Create track"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
