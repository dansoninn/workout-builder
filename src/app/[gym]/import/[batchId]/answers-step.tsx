"use client";

import { useId, useState } from "react";

import { SettingsSection } from "@/components/app/settings";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BlockIntent } from "@/lib/engine/types";
import type { ImportChoices } from "@/lib/import/plan";
import type { ImportAnswers, ImportReading, LabelMeaning, QueueItem } from "@/lib/import/review";
import { INTENT_LABELS } from "@/lib/labels";
import { dayLabel } from "@/lib/week";
import type { Library } from "@/lib/workout/library";

import { ExerciseField } from "../../builder/exercise-field";

const KIND_LABELS: Record<QueueItem["kind"], string> = {
  generic: "Which exercise?",
  unknown: "Not in the library",
  problem: "Cannot be read as written",
  date: "The date",
  note: "Read this way",
};

/** Step 2: everything that needs the coach, each answered once for the whole import, most lines first. */
export function AnswersStep({
  reading,
  answers,
  setAnswers,
  choices,
  setChoices,
  library,
  focusNames,
  canManage,
  onOpenDay,
  onNext,
}: {
  reading: ImportReading;
  answers: ImportAnswers;
  setAnswers: (next: (a: ImportAnswers) => ImportAnswers) => void;
  choices: ImportChoices;
  setChoices: (next: (c: ImportChoices) => ImportChoices) => void;
  library: Library;
  focusNames: string[];
  canManage: boolean;
  onOpenDay: (key: string) => void;
  onNext: () => void;
}) {
  const [shown, setShown] = useState(20);
  const queue = reading.queue.filter((q) => q.kind !== "note");
  const notes = reading.queue.filter((q) => q.kind === "note");
  const dateOf = (key: string) => reading.days.find((r) => r.day.key === key)?.day.date ?? null;
  const answer = (term: string, exerciseId: string | null) =>
    setAnswers((a) => {
      const words = { ...a.words };
      if (exerciseId) words[term] = exerciseId;
      else delete words[term];
      return { ...a, words };
    });
  const leaveOut = (keys: string[]) => setAnswers((a) => ({ ...a, skip: [...new Set([...a.skip, ...keys])] }));
  const answered = Object.entries(answers.words);
  const nameOf = (id: string) => library.exercises.find((e) => e.id === id)?.name ?? "an exercise";

  return (
    <div className="grid gap-10">
      <SettingsSection
        title={queue.length ? `${queue.length} things need you` : "Nothing needs you"}
        description="Answered once, for every day of the import. The ones that fix the most lines come first."
      >
        {queue.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-muted-foreground">Every line is understood.</p>
        ) : (
          <ol className="grid gap-2">
            {queue.slice(0, shown).map((item) => (
              <li key={item.key} className="grid gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-xs font-medium text-muted-foreground">{KIND_LABELS[item.kind]}</span>
                  <span className="font-medium">{item.kind === "generic" || item.kind === "unknown" ? `“${item.label}”` : item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {item.lines ? `${item.lines} ${item.lines === 1 ? "line" : "lines"} on ` : "on "}
                    {item.days.length} {item.days.length === 1 ? "day" : "days"}
                  </span>
                </div>
                {item.kind === "generic" && (
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Which “${item.label}” does your gym mean?`}>
                    {item.candidates.map((e) => (
                      <Button key={e.id} variant="outline" size="sm" onClick={() => answer(item.label, e.id)}>
                        {e.name}
                      </Button>
                    ))}
                  </div>
                )}
                {item.kind === "unknown" && <UnknownWord item={item} library={library} onAnswer={(id) => answer(item.label, id)} />}
                {(item.kind === "problem" || item.kind === "date") && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {item.days.slice(0, 8).map((key) => (
                      <Button key={key} variant="ghost" size="xs" onClick={() => onOpenDay(key)}>
                        {dateOf(key) ? dayLabel(dateOf(key)!) : key}
                      </Button>
                    ))}
                    {item.days.length > 8 && <span className="text-xs text-muted-foreground">and {item.days.length - 8} more</span>}
                    <Button variant="link" size="xs" onClick={() => leaveOut(item.days)}>
                      Leave {item.days.length === 1 ? "this day" : `these ${item.days.length} days`} out
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
        {queue.length > shown && (
          <Button variant="outline" onClick={() => setShown((n) => n + 20)}>
            Show {Math.min(20, queue.length - shown)} more
          </Button>
        )}
        {queue.length > 0 && <p className="text-xs text-muted-foreground">Lines still unanswered at the import become drafts to finish in the builder.</p>}
      </SettingsSection>

      {answered.length > 0 && (
        <SettingsSection title="Your answers" description={canManage ? "Answers for generic words become your gym's; tick an unknown word to keep it as the gym's name for the exercise." : "Answers for generic words become your gym's."}>
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
            {answered.map(([term, id]) => {
              const generic = library.ambiguous[term] !== undefined;
              return (
                <li key={term} className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1">
                    “{term}” = <span className="font-medium">{nameOf(id)}</span>
                  </span>
                  {!generic && canManage && (
                    <label className="flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="accent-[var(--primary)]"
                        checked={choices.remember.includes(term)}
                        onChange={(e) => setChoices((c) => ({ ...c, remember: e.target.checked ? [...c.remember, term] : c.remember.filter((t) => t !== term) }))}
                      />
                      Keep as the gym&apos;s name<span className="sr-only"> for “{term}”</span>
                    </label>
                  )}
                  <Button variant="link" size="xs" onClick={() => answer(term, null)}>
                    Change<span className="sr-only"> the answer for “{term}”</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        </SettingsSection>
      )}

      {reading.labels.length > 0 && (
        <Labels reading={reading} answers={answers} setAnswers={setAnswers} focusNames={focusNames} canManage={canManage} />
      )}

      {reading.headings.length > 0 && <Headings reading={reading} setAnswers={setAnswers} />}

      {notes.length > 0 && (
        <details className="grid gap-2">
          <summary className="cursor-pointer text-sm font-medium">How some lines were read ({notes.length}): check if you like</summary>
          <ul className="mt-2 grid gap-1 text-sm">
            {notes.map((n) => (
              <li key={n.key} className="flex flex-wrap items-baseline gap-x-2">
                <span>{n.label}</span>
                <span className="text-xs text-muted-foreground">
                  {n.lines} lines ·{" "}
                  <Button variant="link" size="xs" className="h-auto p-0" onClick={() => onOpenDay(n.days[0]!)}>
                    see one
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div>
        <Button onClick={onNext}>Next: preview</Button>
      </div>
    </div>
  );
}

function UnknownWord({ item, library, onAnswer }: { item: QueueItem; library: Library; onAnswer: (exerciseId: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {item.candidates.slice(0, 3).map((e) => (
        <Button key={e.id} variant="outline" size="sm" onClick={() => onAnswer(e.id)}>
          {e.name}
        </Button>
      ))}
      <div className="w-56 rounded-md border border-input">
        <ExerciseField library={library} value={null} lineId={`import-${id}`} label={`Pick the exercise for “${item.label}”`} onChange={(exerciseId) => exerciseId && onAnswer(exerciseId)} />
      </div>
    </div>
  );
}

/** What each day label means: a day focus, a closed day, both, or nothing. */
function Labels({
  reading,
  answers,
  setAnswers,
  focusNames,
  canManage,
}: {
  reading: ImportReading;
  answers: ImportAnswers;
  setAnswers: (next: (a: ImportAnswers) => ImportAnswers) => void;
  focusNames: string[];
  canManage: boolean;
}) {
  const set = (key: string, meaning: LabelMeaning) => setAnswers((a) => ({ ...a, labels: { ...a.labels, [key]: meaning } }));
  const known = new Set(focusNames.map((n) => n.toLowerCase()));
  return (
    <SettingsSection
      title="Day labels"
      description={
        canManage
          ? "The short words on each day: a day focus (new ones are added to Settings → Days), a closed day, or nothing."
          : "The short words on each day. New day focuses and closed days are added by an owner or head coach; until then they are left out."
      }
    >
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="h-8 px-3 font-medium">Label</th>
              <th scope="col" className="h-8 px-3 font-medium">Days</th>
              <th scope="col" className="h-8 px-3 font-medium">Day focus</th>
              <th scope="col" className="h-8 px-3 font-medium">Closed day</th>
            </tr>
          </thead>
          <tbody>
            {reading.labels.map((l) => {
              const options = [...new Set([...focusNames, l.proposed.focus, l.meaning.focus].filter((n): n is string => Boolean(n)))];
              return (
                <tr key={l.key} className="border-b border-border last:border-0">
                  <th scope="row" className="px-3 py-1.5 text-left font-medium">
                    {l.text}
                    <span className="block text-xs font-normal text-muted-foreground">{l.column === "own" ? "the program's column" : "every program's column"}</span>
                  </th>
                  <td className="px-3 py-1.5 tabular">{l.days}</td>
                  <td className="px-3 py-1.5">
                    <select
                      aria-label={`Day focus for “${l.text}”`}
                      value={l.meaning.focus ?? ""}
                      onChange={(e) => set(l.key, { ...l.meaning, focus: e.target.value || null })}
                      className="h-8 w-44 rounded-md border border-input bg-surface px-2 text-sm"
                    >
                      <option value="">No focus</option>
                      {options.map((n) => (
                        <option key={n} value={n}>
                          {known.has(n.toLowerCase()) ? n : `${n} (new${canManage ? "" : ": needs an owner"})`}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        className="accent-[var(--primary)]"
                        checked={l.meaning.closed !== null}
                        onChange={(e) => set(l.key, { ...l.meaning, closed: e.target.checked ? l.proposed.closed ?? l.text : null })}
                      />
                      <span className="text-xs">{l.meaning.closed ?? "Closed"}</span>
                      <span className="sr-only"> on “{l.text}” days</span>
                    </label>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {Object.keys(answers.labels).length > 0 && (
        <Button variant="link" size="xs" className="justify-self-start" onClick={() => setAnswers((a) => ({ ...a, labels: {} }))}>
          Back to what the app proposed
        </Button>
      )}
    </SettingsSection>
  );
}

/** A rule for a heading: "every Metcon is conditioning". */
function Headings({ reading, setAnswers }: { reading: ImportReading; setAnswers: (next: (a: ImportAnswers) => ImportAnswers) => void }) {
  const intents = Object.entries(INTENT_LABELS) as [BlockIntent, string][];
  return (
    <SettingsSection title="Block headings" description="A rule for a heading applies to every block with it: “every Metcon is conditioning”.">
      <ul className="grid gap-1 sm:grid-cols-2">
        {reading.headings.slice(0, 30).map((h) => (
          <li key={h.title} className="flex items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-1.5 text-sm">
            <span className="min-w-0 truncate">
              <span className="font-medium">{h.title}</span> <span className="text-xs text-muted-foreground">×{h.count}</span>
            </span>
            <Select
              items={[{ value: "read", label: "As read" }, ...intents.map(([value, label]) => ({ value, label }))]}
              value={h.intent ?? "read"}
              onValueChange={(v) =>
                setAnswers((a) => {
                  const headings = { ...a.headings };
                  if (!v || v === "read") delete headings[h.title.toLowerCase()];
                  else headings[h.title.toLowerCase()] = v as BlockIntent;
                  return { ...a, headings };
                })
              }
            >
              <SelectTrigger aria-label={`Every “${h.title}” block is`} className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">As read</SelectItem>
                {intents.map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}
