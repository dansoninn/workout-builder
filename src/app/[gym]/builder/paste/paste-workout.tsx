"use client";

import { CheckIcon, CircleHelpIcon, MinusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Library } from "@/lib/workout/library";
import { type Answers, type ParsedItem, type ParsedLine, parseWorkoutText } from "@/lib/workout/parse";

import type { TrackOption } from "../builder";
import { ExerciseField } from "../exercise-field";
import { createFromText } from "./actions";

const EXAMPLE = `WOD 1
A. E3M x 5: 5 back squat @75-80%
B. E2M x 4: 8-10 DB bench, 8/8 SA DB row
C. AMRAP 8: 5 KB swing, 10 air squat, 15 DU`;

const storageKey = (slug: string) => `wb:paste:${slug}`;
const subscribeNothing = () => () => {};
function readKept(slug: string): string {
  try {
    return localStorage.getItem(storageKey(slug)) ?? "";
  } catch {
    return "";
  }
}

/**
 * Paste a workout as text (PLAN-step-4 4c): the text on the left, what the app
 * understood on the right, line by line, as you type. A generic word is asked
 * once and becomes the gym's name for it; an unknown exercise is picked (and,
 * for owners and head coaches, can be remembered); a line the app cannot
 * place is kept as a note. Missing numbers must be written before the
 * workout is made. The text is kept in this browser until then.
 */
export function PasteWorkout({
  slug,
  library,
  tracks,
  initialDate,
  initialTrackId,
  canNameWords,
}: {
  slug: string;
  library: Library;
  tracks: TrackOption[];
  initialDate: string;
  initialTrackId: string | null;
  canNameWords: boolean;
}) {
  const router = useRouter();
  const textId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  // The text survives a reload until the workout is made.
  const kept = useSyncExternalStore(subscribeNothing, () => readKept(slug), () => "");
  const [edited, setText] = useState<string | null>(null);
  const text = edited ?? kept;
  const [date, setDate] = useState(initialDate);
  const [trackId, setTrackId] = useState(initialTrackId);
  const [answers, setAnswers] = useState<Answers>({});
  const [remember, setRemember] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreating] = useTransition();

  useEffect(() => {
    if (edited === null) return;
    const timer = window.setTimeout(() => {
      try {
        if (text) localStorage.setItem(storageKey(slug), text);
        else localStorage.removeItem(storageKey(slug));
      } catch {}
    }, 400);
    return () => window.clearTimeout(timer);
  }, [slug, text, edited]);

  const deferredText = useDeferredValue(text);
  const parsed = useMemo(() => parseWorkoutText(deferredText, library, answers), [deferredText, library, answers]);
  const shown = parsed.lines.filter((l) => l.status !== "blank");
  const count = (status: ParsedLine["status"]) => shown.filter((l) => l.status === status).length;
  const blocking = shown.filter((l) => l.blocking);
  const trackItems = tracks.filter((t) => !t.archived).map((t) => ({ value: t.id, label: t.name }));

  const answer = (term: string, exerciseId: string | null) =>
    setAnswers((current) => {
      const next = { ...current };
      if (exerciseId) next[term] = exerciseId;
      else delete next[term];
      return next;
    });

  /** Selects a line of the text, so the coach can fix it where it is. */
  const showLine = (line: number) => {
    const area = textarea.current;
    if (!area) return;
    const lines = area.value.split("\n");
    const start = lines.slice(0, line).reduce((n, l) => n + l.length + 1, 0);
    area.focus();
    area.setSelectionRange(start, start + (lines[line]?.length ?? 0));
  };

  const create = () => {
    setError(null);
    if (blocking.length > 0) {
      setError(`Write the missing numbers first (line ${blocking.map((l) => l.line + 1).join(", ")}).`);
      showLine(blocking[0]!.line);
      return;
    }
    startCreating(async () => {
      const result = await createFromText(slug, { text, date, trackId, answers, remember: [...remember] });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      try {
        localStorage.removeItem(storageKey(slug));
      } catch {}
      toast.success("Workout made from your text. Check it and save.");
      router.push(`/${slug}/builder/${result.id}`);
    });
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-12 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur lg:top-0 lg:px-6">
        <h1 className="flex-1 text-lg font-semibold">Paste a workout</h1>
        <Button size="sm" onClick={create} disabled={creating || shown.length === 0}>
          {creating ? "Making the workout…" : "Make workout"}
        </Button>
      </header>

      <div className="grid flex-1 gap-6 px-4 py-5 lg:grid-cols-2 lg:px-6">
        <div className="grid content-start gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`${textId}-date`}>
                Date
              </label>
              <input
                id={`${textId}-date`}
                type="date"
                value={date}
                required
                onChange={(e) => setDate(e.target.value || initialDate)}
                className="h-8 rounded-md border border-input bg-surface px-2 text-sm tabular focus-visible:border-ring focus-visible:outline-none max-sm:text-base"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={`${textId}-track`}>
                Track
              </label>
              <Select items={trackItems} value={trackId} onValueChange={(v) => setTrackId(v ?? null)}>
                <SelectTrigger id={`${textId}-track`} size="default" className="w-44">
                  <SelectValue placeholder="No track" />
                </SelectTrigger>
                <SelectContent>
                  {trackItems.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <label htmlFor={textId} className="text-sm font-medium">
            The workout, as you would write it on the whiteboard
          </label>
          <textarea
            id={textId}
            ref={textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={EXAMPLE}
            spellCheck={false}
            aria-describedby={`${textId}-hint`}
            className="min-h-[24rem] w-full resize-y rounded-md border border-input bg-surface px-3 py-2 font-mono text-sm leading-6 placeholder:text-subtle-foreground focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_color-mix(in_oklch,var(--ring)_22%,transparent)] focus-visible:outline-none max-sm:text-base"
          />
          <p id={`${textId}-hint`} className="text-xs text-muted-foreground">
            One exercise per line, or after a colon separated by commas. Blocks start with a letter (A., B.), a word (Strength, Metcon) or a
            format: AMRAP 12 · EMOM 10 · E3M x 5 · Every 2:00 x 6 · For time · 3 RFT · 21-15-9 · Tabata · 4 rounds 90/30. Loads: @75-80%,
            (22.5/15 kg), 2 x 22.5 kg, bw. Efforts in the app&apos;s words: Pace Hard, Load Moderate.
          </p>
        </div>

        <section className="grid content-start gap-3" aria-labelledby={`${textId}-understood`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id={`${textId}-understood`} className="text-sm font-medium">
              What the app understood{parsed.title && <span className="font-normal text-muted-foreground"> · {parsed.title}</span>}
            </h2>
            {shown.length > 0 && (
              <p role="status" className="text-xs text-muted-foreground">
                {count("ok")} understood · {count("ask")} for you · {count("note")} kept as {count("note") === 1 ? "a note" : "notes"}
              </p>
            )}
          </div>
          {error && (
            <p role="alert" className="rounded-md bg-destructive-subtle px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {shown.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border-strong px-4 py-8 text-center text-muted-foreground">
              Paste or type a workout on the left. Each line shows here with what the app read from it.
            </p>
          ) : (
            <ol className="grid gap-1.5" aria-label="Lines">
              {shown.map((line) => (
                <PreviewLine
                  key={line.line}
                  line={line}
                  library={library}
                  answers={answers}
                  onAnswer={answer}
                  canNameWords={canNameWords}
                  remember={remember}
                  onRemember={(term, on) =>
                    setRemember((current) => {
                      const next = new Set(current);
                      if (on) next.add(term);
                      else next.delete(term);
                      return next;
                    })
                  }
                  onShow={() => showLine(line.line)}
                />
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

const STATUS = {
  ok: { icon: CheckIcon, label: "Understood", tone: "text-success" },
  ask: { icon: CircleHelpIcon, label: "For you", tone: "text-warning" },
  note: { icon: MinusIcon, label: "Kept as a note", tone: "text-muted-foreground" },
  blank: { icon: MinusIcon, label: "", tone: "" },
} as const;

function PreviewLine({
  line,
  library,
  answers,
  onAnswer,
  canNameWords,
  remember,
  onRemember,
  onShow,
}: {
  line: ParsedLine;
  library: Library;
  answers: Answers;
  onAnswer: (term: string, exerciseId: string | null) => void;
  canNameWords: boolean;
  remember: Set<string>;
  onRemember: (term: string, on: boolean) => void;
  onShow: () => void;
}) {
  const status = STATUS[line.status];
  const Icon = status.icon;
  return (
    <li
      data-status={line.status}
      className={cn("grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 rounded-md border px-3 py-2", line.status === "ask" ? "border-warning/50 bg-warning-subtle/40" : "border-border bg-surface")}
    >
      <Icon className={cn("mt-0.5 size-4", status.tone)} aria-hidden />
      <div className="grid min-w-0 gap-1">
        <p className="flex items-baseline gap-2 text-sm">
          <span className="sr-only">{status.label}: </span>
          <button type="button" onClick={onShow} className="shrink-0 font-mono text-xs text-muted-foreground tabular hover:text-foreground">
            <span className="sr-only">Show line </span>
            {line.line + 1}
          </button>
          <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">{line.text.trim()}</span>
        </p>
        <p className={cn("text-sm", line.status === "note" && "text-muted-foreground")}>{line.meaning}</p>
        {line.problems.map((problem) => (
          <p key={problem} className={cn("text-xs", line.blocking ? "text-destructive" : "text-warning")}>
            {problem}
          </p>
        ))}
        {line.items.map((item) => (
          <Question
            key={item.itemId}
            item={item}
            library={library}
            answers={answers}
            onAnswer={onAnswer}
            canNameWords={canNameWords}
            remember={remember}
            onRemember={onRemember}
          />
        ))}
      </div>
    </li>
  );
}

/** "Which squat does your gym mean?" · "Not in the library: pick the exercise" · an answer, to change. */
function Question({
  item,
  library,
  answers,
  onAnswer,
  canNameWords,
  remember,
  onRemember,
}: {
  item: ParsedItem;
  library: Library;
  answers: Answers;
  onAnswer: (term: string, exerciseId: string | null) => void;
  canNameWords: boolean;
  remember: Set<string>;
  onRemember: (term: string, on: boolean) => void;
}) {
  const r = item.resolution;
  const id = useId();
  if (!r) return null;
  const generic = library.ambiguous[r.term] !== undefined;

  if (r.kind === "matched" && r.via === "answer" && answers[r.term]) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>
          “{r.term}” = {r.exercise.name}
          {generic ? " · becomes your gym's name for it" : !canNameWords ? " · this workout only" : ""}
        </span>
        {!generic && canNameWords && (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={remember.has(r.term)} onChange={(e) => onRemember(r.term, e.target.checked)} className="accent-[var(--primary)]" />
            Remember “{r.term}” as your gym&apos;s name for it
          </label>
        )}
        <Button variant="link" size="xs" className="h-auto p-0 text-xs" onClick={() => onAnswer(r.term, null)}>
          Change<span className="sr-only"> the answer for “{r.term}”</span>
        </Button>
      </div>
    );
  }
  if (r.kind === "ambiguous") {
    return (
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-xs font-medium">Which “{r.term}” does your gym mean? Answered once, for every workout.</legend>
        <div className="flex flex-wrap gap-1.5">
          {r.candidates.map((exercise) => (
            <Button key={exercise.id} variant="outline" size="sm" onClick={() => onAnswer(r.term, exercise.id)}>
              {exercise.name}
            </Button>
          ))}
        </div>
      </fieldset>
    );
  }
  if (r.kind === "unmatched") {
    return (
      <div className="grid gap-1.5">
        <p className="text-xs font-medium">“{item.words}” is not in the library. Pick the exercise, or leave it to pick in the builder.</p>
        <div className="flex flex-wrap items-center gap-1.5">
          {r.suggestions.slice(0, 3).map((exercise) => (
            <Button key={exercise.id} variant="outline" size="sm" onClick={() => onAnswer(r.term, exercise.id)}>
              {exercise.name}
            </Button>
          ))}
          <div className="w-56 rounded-md border border-input">
            <ExerciseField
              library={library}
              value={null}
              lineId={`paste-${id}`}
              label={`Pick the exercise for “${item.words}”`}
              onChange={(exerciseId) => onAnswer(r.term, exerciseId)}
            />
          </div>
        </div>
      </div>
    );
  }
  return null;
}
