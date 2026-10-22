"use client";

import { PlusIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { Estimate } from "@/components/design/estimate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { BlockIntent, Measure } from "@/lib/engine/types";
import { semanticColor } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { BlockParams } from "@/lib/workout/draft";
import type { LoggedResult } from "@/lib/workout/load-results";
import {
  finishText,
  parseFinish,
  parseRounds,
  type ResultMeasure,
  resultProblem,
  type RoundLine,
  resultText,
  roundsText,
} from "@/lib/workout/results";

import { saveResult, setResultRemoved } from "./actions";

export interface ResultsBlock {
  id: string;
  label: string;
  title: string;
  intent: BlockIntent;
  format: "amrap" | "for_time";
  params: BlockParams;
  /** "AMRAP 8:00", "For time · 3 rounds · cap 15:00" */
  heading: string;
  lines: string[];
  plan: { measure: Measure; unit: "rounds" | "clock" } | null;
  capSec: number | null;
  /** AMRAP: one round line by line, to read "7 + 12" (calc spec decision 16). */
  roundLines: RoundLine[] | null;
}

/** One AMRAP or For time block: its plan, what each class did, and the form to log it (phone-first). */
export function BlockResults({ slug, block, results, canLog }: { slug: string; block: ResultsBlock; results: LoggedResult[]; canLog: boolean }) {
  const headingId = useId();
  // "new", a result's id while it is being corrected, or nothing.
  const [editing, setEditing] = useState<string | null>(null);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const shown = results.filter((r) => !removed.has(r.id));

  const remove = (result: LoggedResult) => {
    setRemoved((s) => new Set(s).add(result.id));
    startTransition(async () => {
      const done = await setResultRemoved(slug, result.id, true);
      if (!done.ok) {
        setRemoved((s) => new Set([...s].filter((id) => id !== result.id)));
        toast.error(done.error);
        return;
      }
      toast.success(`Result removed${result.sessionLabel ? ` (${result.sessionLabel})` : ""}`, {
        action: {
          label: "Undo",
          onClick: () =>
            startTransition(async () => {
              const undone = await setResultRemoved(slug, result.id, false);
              if (!undone.ok) toast.error(undone.error);
              else setRemoved((s) => new Set([...s].filter((id) => id !== result.id)));
            }),
        },
      });
    });
  };

  return (
    <section aria-labelledby={headingId} data-block-results={block.label} className="rounded-lg border border-border bg-surface">
      <header className="flex items-start gap-3 px-4 pt-4">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold"
          style={{ backgroundColor: `color-mix(in oklch, ${semanticColor("intent", block.intent)} 16%, transparent)` }}
        >
          {block.label}
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <h2 id={headingId} className="font-semibold">
            <span className="sr-only">Block {block.label}: </span>
            {block.heading}
            {block.title && <span className="font-normal text-muted-foreground"> · {block.title}</span>}
          </h2>
          {block.lines.length > 0 && <p className="text-sm text-muted-foreground">{block.lines.join(" · ")}</p>}
        </div>
      </header>

      <p className="flex flex-wrap items-baseline gap-x-1.5 px-4 pt-2 pl-14 text-sm">
        <span className="text-muted-foreground">Planned</span>
        {block.plan ? (
          <>
            <Estimate measure={block.plan.measure} unit={block.plan.unit} className="font-medium" />
            {block.plan.unit === "rounds" && <span className="text-muted-foreground">rounds</span>}
          </>
        ) : (
          <span className="text-muted-foreground">— (a line has no amount or pace)</span>
        )}
      </p>

      <div className="grid gap-2 px-4 pt-3 pb-4">
        {shown.length === 0 && editing === null && <p className="text-sm text-muted-foreground">No results yet.</p>}
        {shown.length > 0 && (
          <ul aria-label={`Results for block ${block.label}`} className="grid divide-y divide-border rounded-md border border-border">
            {shown.map((result) =>
              editing === result.id ? (
                <li key={result.id} className="p-3">
                  <ResultForm slug={slug} block={block} result={result} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <li key={result.id} className="grid gap-1 px-3 py-2.5 sm:flex sm:items-start sm:gap-3">
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-medium tabular">{resultText(result, result.rawText)}</span>
                      {result.sessionLabel && <span className="text-sm text-muted-foreground">{result.sessionLabel}</span>}
                    </p>
                    {result.note && <p className="text-sm whitespace-pre-line">{result.note}</p>}
                    {result.loggedBy && <p className="text-xs text-muted-foreground">Logged by {result.loggedBy}</p>}
                  </div>
                  {canLog && (
                    <div className="-ml-2 flex gap-1 sm:ml-0">
                      <Button variant="ghost" size="sm" className="max-sm:h-9" onClick={() => setEditing(result.id)} disabled={editing !== null}>
                        Edit<span className="sr-only"> result {resultText(result, result.rawText)}</span>
                      </Button>
                      <Button variant="ghost" size="sm" className="max-sm:h-9" onClick={() => remove(result)} disabled={editing !== null}>
                        Remove<span className="sr-only"> result {resultText(result, result.rawText)}</span>
                      </Button>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        )}

        {canLog &&
          (editing === "new" ? (
            <div className="rounded-md border border-border p-3">
              <ResultForm slug={slug} block={block} result={null} onDone={() => setEditing(null)} />
            </div>
          ) : (
            <Button variant="outline" className="h-10 justify-self-start sm:h-8" onClick={() => setEditing("new")} disabled={editing !== null}>
              <PlusIcon /> Log a result<span className="sr-only"> for block {block.label}</span>
            </Button>
          ))}
      </div>
    </section>
  );
}

/** Fields are 44 px on phones (thumbs), 32 px on larger screens. */
const touch = "h-11 sm:h-8";

function ResultForm({ slug, block, result, onDone }: { slug: string; block: ResultsBlock; result: LoggedResult | null; onDone: () => void }) {
  const id = useId();
  const amrap = block.format === "amrap";
  const show = (n: number | null) => (n === null ? "" : amrap ? roundsText(n) : finishText(n));
  const [session, setSession] = useState(result?.sessionLabel ?? "");
  // Rounds come back as the coach wrote them ("7 + 12 – 9 + 3").
  const written = amrap && result?.rawText ? result.rawText.split(" – ") : null;
  const [low, setLow] = useState(written?.[0] ?? show(amrap ? (result?.rounds_low ?? null) : (result?.finish_low_s ?? null)));
  const [high, setHigh] = useState(() => {
    if (written) return written[1] ?? "";
    const [l, h] = amrap ? [result?.rounds_low, result?.rounds_high] : [result?.finish_low_s, result?.finish_high_s];
    return h === undefined || h === null || h === l ? "" : show(h);
  });
  const [note, setNote] = useState(result?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parse = amrap ? (text: string) => parseRounds(text, block.roundLines) : parseFinish;
  const lowParsed = parse(low);
  const highParsed = parse(high);
  const fieldError = !lowParsed.ok ? lowParsed.error : !highParsed.ok ? highParsed.error : null;

  /** What the two fields mean together: one number is the whole class. */
  const measure = (): ResultMeasure | null => {
    if (!lowParsed.ok || !highParsed.ok) return null;
    const a = lowParsed.value ?? highParsed.value;
    const b = highParsed.value ?? lowParsed.value;
    if (a === null || b === null) return null;
    return amrap
      ? { rounds_low: a, rounds_high: b, finish_low_s: null, finish_high_s: null }
      : { rounds_low: null, rounds_high: null, finish_low_s: a, finish_high_s: b };
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const m = measure();
    const problem = fieldError ?? (m ? resultProblem(block.format, block.params, m) : amrap ? "Enter the rounds the group reached" : "Enter the finish times");
    if (problem) {
      setError(problem);
      document.getElementById(`${id}-low`)?.focus();
      return;
    }
    setError(null);
    startTransition(async () => {
      const saved = await saveResult(slug, result?.id ?? null, { blockId: block.id, sessionLabel: session, note, ...m!, roundsText: amrap ? [low, high] : null });
      if (!saved.ok) {
        setError(saved.error);
        return;
      }
      toast.success(result ? "Result corrected" : `Result logged for block ${block.label}`);
      onDone();
    });
  };

  const labels = amrap ? (["Fewest rounds", "Most rounds"] as const) : (["Fastest", "Slowest"] as const);
  const hint = amrap
    ? "7 + 12 is seven rounds and 12 reps into the next (counted by the round's estimated time); 7.5 is seven and a half. One number if the whole class did the same."
    : `Minutes:seconds; on a phone, 1215 is 12:15.${block.capSec ? " Anyone capped counts as the cap." : ""} One time if the whole class finished together.`;

  return (
    <form onSubmit={submit} noValidate className="grid gap-3" aria-label={result ? "Correct the result" : `Log a result for block ${block.label}`}>
      <fieldset className="grid gap-1.5" aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}>
        <legend className="mb-1.5 text-sm font-medium">{amrap ? "Rounds the group reached" : "Finish times"}</legend>
        <div className="grid grid-cols-2 gap-2">
          {([
            [labels[0], low, setLow, `${id}-low`],
            [labels[1], high, setHigh, `${id}-high`],
          ] as const).map(([label, value, set, inputId], i) => (
            <div key={label} className="grid gap-1">
              <label htmlFor={inputId} className="text-xs text-muted-foreground">
                {label}
              </label>
              <Input
                id={inputId}
                value={value}
                // AMRAP: the phone pad has "+" and a comma, for "7 + 12" and "7,5".
                inputMode={amrap ? "tel" : "numeric"}
                autoComplete="off"
                autoFocus={i === 0}
                placeholder={amrap ? (i === 0 ? "6.5" : "8") : i === 0 ? "9:30" : block.capSec ? finishText(block.capSec) : "14:00"}
                aria-invalid={error ? true : undefined}
                onChange={(e) => set(e.target.value)}
                onBlur={() => {
                  // Show back what was understood: "1215" → "12:15", "7,5" → "7.5"; "7 + 12" stays as written.
                  const p = parse(value);
                  if (p.ok && p.value !== null && !value.includes("+")) set(show(p.value));
                }}
                className={cn(touch, "tabular")}
              />
            </div>
          ))}
        </div>
        {!amrap && block.capSec !== null && (
          <Button type="button" variant="ghost" size="xs" className="justify-self-end" onClick={() => setHigh(finishText(block.capSec!))}>
            Some were capped ({finishText(block.capSec)})
          </Button>
        )}
        {amrap && [low, high].some((t) => t.includes("+")) && lowParsed.ok && highParsed.ok && (
          <p aria-live="polite" className="text-xs tabular">
            {[low, high]
              .map((t, i) => (t.includes("+") ? `${t} ≈ ${roundsText((i === 0 ? lowParsed : highParsed).value ?? 0)}` : null))
              .filter(Boolean)
              .join(" · ")}{" "}
            rounds
          </p>
        )}
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      </fieldset>

      <div className="grid gap-1">
        <label htmlFor={`${id}-session`} className="text-xs text-muted-foreground">
          Class (optional)
        </label>
        <Input id={`${id}-session`} value={session} maxLength={40} placeholder="06:00" onChange={(e) => setSession(e.target.value)} className={touch} />
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-note`} className="text-xs text-muted-foreground">
          Note (optional)
        </label>
        <Textarea id={`${id}-note`} value={note} maxLength={2000} rows={2} placeholder="Scaled double-unders to singles" onChange={(e) => setNote(e.target.value)} />
      </div>

      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="h-11 flex-1 sm:h-8 sm:flex-none">
          {pending ? "Saving…" : result ? "Save correction" : "Save result"}
        </Button>
        <Button type="button" variant="ghost" className="h-11 sm:h-8" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
