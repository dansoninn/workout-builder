"use client";

import { ArchiveIcon, PencilIcon, PlusIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { PageBody, PageHeader } from "@/components/app/page";
import { PatternTag } from "@/components/design/tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EQUIPMENT } from "@/lib/library/equipment";
import { MODALITY_LABELS, MUSCLE_LABELS, PATTERN_LABELS } from "@/lib/labels";
import { normalizeAlias } from "@/lib/normalize-alias";
import { type PatternKey, PATTERNS } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import { type Library, type LibraryExercise, searchExercises } from "@/lib/workout/library";
import { paceFields, paceText } from "@/lib/workout/pace-text";

import { addGymAlias, archiveGymExercise, removeGymAlias } from "./actions";
import { ExerciseForm } from "./exercise-form";

const UNIT_LABELS: Record<string, string> = { reps: "Reps", distance_m: "Metres", calories: "Calories", time_s: "Time" };

export function ExercisesManager({ slug, library, canEdit }: { slug: string; library: Library; canEdit: boolean }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"all" | "core" | "gym">("all");
  const [pattern, setPattern] = useState<PatternKey | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<LibraryExercise | "new" | null>(null);
  const [formKey, setFormKey] = useState(0);

  const shown = useMemo(() => {
    const base = query.trim() ? searchExercises(library, query, 200).results.map((r) => r.exercise) : library.exercises;
    return base.filter(
      (e) => (source === "all" || (source === "gym") === (e.orgId !== null)) && (!pattern || (e.patterns[pattern] ?? 0) > 0),
    );
  }, [library, query, source, pattern]);
  const selected = library.exercises.find((e) => e.id === selectedId) ?? null;
  const openForm = (target: LibraryExercise | "new") => {
    setFormKey((k) => k + 1);
    setEditing(target);
  };

  return (
    <PageBody>
      <PageHeader
        title="Exercises"
        description={`${library.exercises.filter((e) => !e.orgId).length} in the core library, ${library.exercises.filter((e) => e.orgId).length} of your gym's own.`}
        actions={
          canEdit && (
            <Button onClick={() => openForm("new")}>
              <PlusIcon /> New exercise
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <SearchIcon className="pointer-events-none absolute top-2 left-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input aria-label="Search exercises" placeholder="Search by name or alias" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
        </div>
        <div role="group" aria-label="Source" className="flex rounded-md border border-border bg-surface p-0.5">
          {(["all", "core", "gym"] as const).map((s) => (
            <button key={s} type="button" aria-pressed={source === s} onClick={() => setSource(s)}
              className={cn("h-7 rounded-sm px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground", source === s && "bg-hover text-foreground")}>
              {s === "all" ? "All" : s === "core" ? "Core library" : "Your gym"}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Pattern" className="flex flex-wrap gap-1">
          {PATTERNS.map((p) => (
            <button key={p} type="button" aria-pressed={pattern === p} onClick={() => setPattern(pattern === p ? null : p)}
              className={cn("rounded-sm ring-offset-1", pattern === p ? "ring-2 ring-ring" : "opacity-80 hover:opacity-100")}>
              <PatternTag pattern={p} />
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="h-8 px-3 font-medium">Exercise</th>
              <th scope="col" className="hidden h-8 px-3 font-medium md:table-cell">Counts toward</th>
              <th scope="col" className="hidden h-8 px-3 font-medium sm:table-cell">Counted in</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0 hover:bg-hover/50">
                <th scope="row" className="px-3 py-1.5 text-left font-normal">
                  <button type="button" onClick={() => setSelectedId(e.id)} className="rounded-sm text-left font-medium hover:underline">
                    {e.name}
                  </button>
                  {e.orgId && <Badge variant="outline" className="ml-2 h-4 px-1 text-2xs">Gym</Badge>}
                  {e.aliases.length > 0 && (
                    <span className="ml-2 hidden text-xs text-muted-foreground lg:inline">
                      {e.aliases.slice(0, 3).map((a) => `“${a.text}”`).join(", ")}
                      {e.aliases.length > 3 && ` +${e.aliases.length - 3}`}
                    </span>
                  )}
                </th>
                <td className="hidden px-3 py-1.5 md:table-cell">
                  <span className="flex flex-wrap gap-1">
                    {e.kind === "monostructural"
                      ? <span className="text-muted-foreground">{e.modality ? MODALITY_LABELS[e.modality] : "Cardio"}</span>
                      : (Object.entries(e.patterns) as [PatternKey, number][]).map(([p, w]) => (
                          <PatternTag key={p} pattern={p} className={w < 1 ? "" : undefined} />
                        ))}
                  </span>
                </td>
                <td className="hidden px-3 py-1.5 text-muted-foreground sm:table-cell">{UNIT_LABELS[e.defaultUnit]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="px-3 py-6 text-center text-muted-foreground">No exercise matches.</p>}
      </div>

      <Sheet open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-md">
          {selected && <ExerciseDetail slug={slug} exercise={selected} canEdit={canEdit} onEdit={() => openForm(selected)} />}
        </SheetContent>
      </Sheet>

      {canEdit && editing !== null && (
        <ExerciseForm key={formKey} slug={slug} exercise={editing === "new" ? null : editing} open onOpenChange={(open) => !open && setEditing(null)} />
      )}
    </PageBody>
  );
}

function ExerciseDetail({ slug, exercise, canEdit, onEdit }: { slug: string; exercise: LibraryExercise; canEdit: boolean; onEdit: () => void }) {
  const [alias, setAlias] = useState("");
  const [pending, startTransition] = useTransition();
  const fields = paceFields(exercise);
  const gymAliases = exercise.aliases.filter((a) => a.gym);
  const coreAliases = exercise.aliases.filter((a) => !a.gym);

  const add = () =>
    startTransition(async () => {
      const result = await addGymAlias(slug, exercise.id, alias);
      if (!result.ok) return void toast.error(result.error);
      toast.success(`“${normalizeAlias(alias)}” now finds ${exercise.name}`);
      setAlias("");
    });

  return (
    <div className="grid gap-5 p-5">
      <SheetHeader className="p-0">
        <SheetTitle className="text-lg">{exercise.name}</SheetTitle>
        <SheetDescription>{exercise.orgId ? "Your gym's own exercise" : "Core library"}</SheetDescription>
      </SheetHeader>

      <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Counts toward</dt>
        <dd className="flex flex-wrap gap-1">
          {exercise.kind === "monostructural"
            ? exercise.modality && MODALITY_LABELS[exercise.modality]
            : (Object.entries(exercise.patterns) as [PatternKey, number][]).map(([p, w]) => (
                <span key={p} className="inline-flex items-center gap-1">
                  <PatternTag pattern={p} />
                  <span className="text-xs text-muted-foreground tabular">{w.toFixed(2)}</span>
                </span>
              ))}
        </dd>
        <dt className="text-muted-foreground">Primary muscles</dt>
        <dd>{exercise.primaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ") || "—"}</dd>
        <dt className="text-muted-foreground">Secondary</dt>
        <dd>{exercise.secondaryMuscles.map((m) => MUSCLE_LABELS[m]).join(", ") || "—"}</dd>
        <dt className="text-muted-foreground">Equipment</dt>
        <dd>{exercise.equipment.map((k) => EQUIPMENT.find((e) => e.key === k)?.label ?? k).join(", ") || "—"}</dd>
        <dt className="text-muted-foreground">Counted in</dt>
        <dd>
          {UNIT_LABELS[exercise.defaultUnit]}
          {exercise.implementCount > 1 && ` · ${exercise.implementCount} implements`}
          {exercise.unilateral && " · one side at a time"}
        </dd>
        {fields.length > 0 && (
          <>
            <dt className="text-muted-foreground">Pace at Hard</dt>
            <dd>
              {exercise.gymPace ? (
                <>
                  <span className="font-medium">{paceText(exercise.gymPace, fields)}</span> <span className="text-muted-foreground">(your gym; default {paceText(exercise.defaultPace, fields)})</span>
                </>
              ) : (
                paceText(exercise.defaultPace, fields)
              )}
              {canEdit && (
                <Link href={`/${slug}/settings/paces`} className="ml-2 text-xs text-primary-text underline-offset-2 hover:underline">
                  Set your gym&apos;s pace
                </Link>
              )}
            </dd>
          </>
        )}
      </dl>

      <section aria-labelledby="names" className="grid gap-2">
        <h3 id="names" className="text-sm font-medium">
          Names that find it
        </h3>
        <p className="text-xs text-muted-foreground">What coaches type in the builder. Your gym&apos;s names come first.</p>
        <ul className="flex flex-wrap gap-1">
          {gymAliases.map((a) => (
            <li key={a.id} className="inline-flex h-6 items-center gap-1 rounded-sm bg-primary-subtle pr-0.5 pl-2 text-xs">
              {a.text}
              {canEdit && (
                <button type="button" aria-label={`Remove the name “${a.text}”`} className="rounded-sm p-0.5 hover:bg-hover"
                  onClick={() => startTransition(async () => {
                    const result = await removeGymAlias(slug, a.id);
                    if (!result.ok) toast.error(result.error);
                  })}>
                  <XIcon className="size-3" />
                </button>
              )}
            </li>
          ))}
          {coreAliases.map((a) => (
            <li key={a.id} className="inline-flex h-6 items-center rounded-sm border border-border px-2 text-xs text-muted-foreground">
              {a.text}
            </li>
          ))}
        </ul>
        {canEdit && (
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); add(); }}>
            <Input aria-label="Add a name your gym uses" placeholder="e.g. bs" value={alias} onChange={(e) => setAlias(e.target.value)} className="max-w-48" />
            <Button type="submit" variant="outline" disabled={pending || !alias.trim()}>
              Add name
            </Button>
          </form>
        )}
      </section>

      {canEdit && exercise.orgId && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit}>
            <PencilIcon /> Edit
          </Button>
          <Button variant="ghost" onClick={() => startTransition(async () => {
            const result = await archiveGymExercise(slug, exercise.id);
            if (!result.ok) toast.error(result.error);
            else toast.success(`${exercise.name} archived; old workouts keep it`);
          })}>
            <ArchiveIcon /> Archive
          </Button>
        </div>
      )}
      {!exercise.orgId && <p className="text-xs text-muted-foreground">Core exercises are shared by every gym and can&apos;t be edited. Add your own names for them above.</p>}
      {exercise.patterns && Object.keys(exercise.patterns).length > 0 && (
        <p className="sr-only">Patterns: {(Object.keys(exercise.patterns) as PatternKey[]).map((p) => PATTERN_LABELS[p]).join(", ")}</p>
      )}
    </div>
  );
}
