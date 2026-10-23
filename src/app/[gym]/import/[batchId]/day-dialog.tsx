"use client";

import { CheckIcon, CircleHelpIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { ImportDocument } from "@/lib/import/document";
import { columnLetter } from "@/lib/import/layout";
import type { ImportAnswers, ReadDay } from "@/lib/import/review";
import { cn } from "@/lib/utils";
import { dayLabel } from "@/lib/week";

/**
 * One day, the document next to what the app reads (source side by side):
 * the row of the sheet with the day's cell marked, or the lines of the text.
 * The coach can fix the text the app reads, or leave the day out.
 */
export function DayDialog({
  read,
  document,
  answers,
  setAnswers,
  onClose,
}: {
  read: ReadDay | null;
  document: ImportDocument;
  answers: ImportAnswers;
  setAnswers: (next: (a: ImportAnswers) => ImportAnswers) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={read !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">{read && <Day key={read.day.key} read={read} document={document} answers={answers} setAnswers={setAnswers} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Day({
  read,
  document,
  answers,
  setAnswers,
  onClose,
}: {
  read: ReadDay;
  document: ImportDocument;
  answers: ImportAnswers;
  setAnswers: (next: (a: ImportAnswers) => ImportAnswers) => void;
  onClose: () => void;
}) {
  const { day } = read;
  const [text, setText] = useState(answers.edits[day.key] ?? day.text);
  const edited = answers.edits[day.key] !== undefined;
  const skipped = answers.skip.includes(day.key);
  const source = day.source;

  const save = () => {
    setAnswers((a) => ({ ...a, edits: text.trim() === day.text.trim() ? withoutKey(a.edits, day.key) : { ...a.edits, [day.key]: text } }));
    onClose();
  };
  const toggleSkip = () => setAnswers((a) => ({ ...a, skip: skipped ? a.skip.filter((k) => k !== day.key) : [...a.skip, day.key] }));

  return (
    <>
      <DialogHeader>
        <DialogTitle>{day.date ? dayLabel(day.date) + ` ${day.date.slice(0, 4)}` : "A day without a date"}</DialogTitle>
        <DialogDescription>
          {"sheet" in source ? `Sheet ${source.sheet}, row ${source.row + 1}, column ${columnLetter(source.column)}` : `Lines ${source.line + 1}–${source.line + source.lines}`}
          {read.focus ? ` · Day focus: ${read.focus}` : ""}
          {read.closed ? ` · Closed: ${read.closed}` : ""}
          {read.benchmark ? ` · Benchmark: ${read.benchmark}` : ""}
        </DialogDescription>
      </DialogHeader>
      {day.problems.length > 0 && <p className="rounded-md bg-warning-subtle px-3 py-2 text-sm">{day.problems.join(" ")}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <section aria-label="In the document" className="grid content-start gap-1.5">
          <h3 className="text-sm font-semibold">In the document</h3>
          <Source document={document} read={read} />
        </section>
        <section aria-label="What the app reads" className="grid content-start gap-1.5">
          <h3 className="text-sm font-semibold">What the app reads</h3>
          {read.parsed ? (
            <ol className="grid gap-1 text-sm">
              {read.parsed.lines
                .filter((l) => l.status !== "blank")
                .map((l) => (
                  <li key={l.line} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-x-1.5">
                    {l.status === "ok" ? <CheckIcon className="mt-0.5 size-3.5 text-success" aria-label="Understood" /> : l.status === "note" ? <span aria-hidden /> : <CircleHelpIcon className="mt-0.5 size-3.5 text-warning" aria-label="Needs you" />}
                    <span>
                      <span className="text-muted-foreground">{l.text.trim()}</span>
                      <span className="block">{l.meaning}</span>
                      {l.problems.length > 0 && <span className="block text-xs text-muted-foreground">{l.problems.join("; ")}</span>}
                    </span>
                  </li>
                ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">{read.status === "not-planned" ? "Not planned yet in the document." : read.status === "skipped" ? "Left out of the import." : "No workout on this day."}</p>
          )}
        </section>
      </div>
      <div className="grid gap-1.5">
        <label htmlFor={`fix-${day.key}`} className="text-sm font-medium">
          The text the app reads {edited && <span className="font-normal text-muted-foreground">(changed by you)</span>}
        </label>
        <Textarea id={`fix-${day.key}`} rows={8} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-sm" />
      </div>
      <DialogFooter className="flex-wrap gap-2 sm:justify-between">
        <div className="flex gap-2">
          <Button variant="ghost" onClick={toggleSkip}>
            {skipped ? "Bring this day back" : "Leave this day out"}
          </Button>
          {edited && (
            <Button variant="ghost" onClick={() => (setAnswers((a) => ({ ...a, edits: withoutKey(a.edits, day.key) })), onClose())}>
              Use the document&apos;s text
            </Button>
          )}
        </div>
        <Button onClick={save}>Keep this text</Button>
      </DialogFooter>
    </>
  );
}

const withoutKey = (record: Record<string, string>, key: string) => Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));

/** The day where it is in the document: its row with the cell marked, or its lines with those around them. */
function Source({ document, read }: { document: ImportDocument; read: ReadDay }) {
  const source = read.day.source;
  if ("sheet" in source && document.kind === "grid") {
    const row = document.sheets.find((s) => s.name === source.sheet)?.rows[source.row] ?? [];
    return (
      <ul className="grid gap-1 text-sm">
        {row.map((cell, c) =>
          cell.trim() ? (
            <li key={c} className={cn("grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 rounded-md px-2 py-1", c === source.column ? "bg-primary-subtle" : "")}>
              <span className="text-xs text-muted-foreground">{columnLetter(c)}</span>
              <span className="whitespace-pre-wrap">{cell}</span>
            </li>
          ) : null,
        )}
      </ul>
    );
  }
  if ("line" in source && document.kind === "text") {
    const lines = document.text.split("\n");
    const from = Math.max(0, source.line - 2);
    const to = Math.min(lines.length, source.line + source.lines + 2);
    return (
      <ol className="grid font-mono text-xs" start={from + 1}>
        {lines.slice(from, to).map((line, i) => {
          const n = from + i;
          const inDay = n >= source.line && n < source.line + source.lines;
          return (
            <li key={n} className={cn("grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 px-2 py-0.5", inDay ? "bg-primary-subtle" : "text-muted-foreground")}>
              <span aria-hidden>{n + 1}</span>
              <span className="whitespace-pre-wrap">{line || " "}</span>
            </li>
          );
        })}
      </ol>
    );
  }
  return <pre className="whitespace-pre-wrap text-sm">{read.day.text}</pre>;
}
