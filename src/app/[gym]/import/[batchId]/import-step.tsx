"use client";

import { SettingsSection } from "@/components/app/settings";
import { Button } from "@/components/ui/button";
import type { ImportChoices, ImportPlan } from "@/lib/import/plan";
import type { ImportReading } from "@/lib/import/review";
import { dayLabel } from "@/lib/week";

/** Step 4: the choices that are the coach's alone, what the import makes, and the import. */
export function ImportStep({
  reading,
  plan,
  choices,
  setChoices,
  canManage,
  programName,
  onOpenDay,
  onImport,
  onDiscard,
  pending,
}: {
  reading: ImportReading;
  plan: ImportPlan;
  choices: ImportChoices;
  setChoices: (next: (c: ImportChoices) => ImportChoices) => void;
  canManage: boolean;
  programName: string;
  onOpenDay: (key: string) => void;
  onImport: () => void;
  onDiscard: () => void;
  pending: boolean;
}) {
  const s = plan.summary;
  const conflicts = choices.conflicts === "skip" ? s.keptExisting : choices.conflicts === "replace" ? s.replaced : 0;
  const meets = s.keptExisting + s.replaced > 0 || choices.conflicts === "add";
  return (
    <div className="grid gap-10">
      {meets && (
        <SettingsSection title="Days that already have a workout" description={`${programName} already has workouts on some of these days.`}>
          <fieldset className="grid gap-2">
            <legend className="sr-only">Days that already have a workout</legend>
            {(
              [
                ["skip", "Keep the program's workout; leave the document's day out"],
                ["replace", "Replace it with the document's (it comes back if you undo the import)"],
                ["add", "Add the document's alongside it"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 text-sm">
                <input type="radio" name="conflicts" value={value} checked={choices.conflicts === value} onChange={() => setChoices((c) => ({ ...c, conflicts: value }))} className="accent-[var(--primary)]" />
                {label}
              </label>
            ))}
          </fieldset>
          {conflicts > 0 && <p className="text-xs text-muted-foreground">{conflicts} days.</p>}
        </SettingsSection>
      )}

      <SettingsSection title="Drafts or published">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={choices.publish} onChange={(e) => setChoices((c) => ({ ...c, publish: e.target.checked }))} className="accent-[var(--primary)]" />
          Publish the {s.ready} ready workouts; the others are drafts to finish in the builder
        </label>
      </SettingsSection>

      {reading.repeated.length > 0 && (
        <SettingsSection title="The same workout on several days" description="Keep one as a template, to use again.">
          <ul className="grid gap-1.5">
            {reading.repeated.slice(0, 20).map((r) => (
              <li key={r.days[0]}>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-[var(--primary)]"
                    checked={choices.templates.includes(r.days[0]!)}
                    onChange={(e) => setChoices((c) => ({ ...c, templates: e.target.checked ? [...c.templates, r.days[0]!] : c.templates.filter((k) => k !== r.days[0]) }))}
                  />
                  <span>
                    <span className="font-medium">{r.text.split("\n")[0]}</span>
                    <span className="text-muted-foreground"> · {r.days.length} days</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </SettingsSection>
      )}

      {plan.cannotSave.length > 0 && (
        <SettingsSection title={`${plan.cannotSave.length} days cannot be saved as written`} description="Fix them, or they are left out of the import.">
          <ul className="grid gap-1 text-sm">
            {plan.cannotSave.slice(0, 30).map((c) => (
              <li key={c.dayKey} className="flex flex-wrap items-baseline gap-x-2">
                <Button variant="link" size="xs" className="h-auto p-0" onClick={() => onOpenDay(c.dayKey)}>
                  {dayLabel(c.date)}
                </Button>
                <span className="text-muted-foreground">{c.message}</span>
              </li>
            ))}
          </ul>
        </SettingsSection>
      )}

      <SettingsSection title="The import" description={`Into ${programName}, in one step that can be undone in one step.`}>
        <ul className="grid gap-1 text-sm" aria-label="What the import makes">
          <li>
            <span className="font-medium tabular">{s.workouts}</span> workouts{s.from && s.to ? `, ${dayLabel(s.from)} ${s.from.slice(0, 4)} – ${dayLabel(s.to)} ${s.to.slice(0, 4)}` : ""}:{" "}
            {s.published ? `${s.published} published, ${s.drafts} drafts` : "all drafts"}
          </li>
          {s.templates > 0 && <li><span className="font-medium tabular">{s.templates}</span> templates</li>}
          {s.days > 0 && <li><span className="font-medium tabular">{s.days}</span> days with a day focus</li>}
          {s.closed > 0 && <li><span className="font-medium tabular">{s.closed}</span> closed days</li>}
          {s.replaced > 0 && <li><span className="font-medium tabular">{s.replaced}</span> workouts of the program replaced</li>}
          {s.keptExisting > 0 && <li><span className="font-medium tabular">{s.keptExisting}</span> days left out: the program already has a workout then</li>}
          {s.leftOut > 0 && !canManage && <li>{s.leftOut} new day focuses or closed days left out: an owner or head coach adds them</li>}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onImport} disabled={pending || s.workouts + s.templates === 0}>
            Import {s.workouts} workouts
          </Button>
          <Button variant="ghost" onClick={onDiscard} disabled={pending}>
            Throw this import away
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
