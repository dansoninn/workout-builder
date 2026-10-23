"use client";

import { FileUpIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useDeferredValue, useId, useMemo, useState, useTransition } from "react";

import { SettingsSection } from "@/components/app/settings";
import { FormError } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fromCsv, fromDocx, fromText, fromXlsx, type ImportDocument, type SourceKind, sourceKindOf } from "@/lib/import/document";
import { type Layout, proposeLayout, reuseLayout } from "@/lib/import/layout";
import { findPersonalData, type PersonalData, removePersonalData } from "@/lib/import/privacy";

import type { TrackOption } from "../builder/builder";
import { startImport } from "./actions";

const KIND_WORDS: Record<PersonalData["kind"], [string, string]> = {
  email: ["email address", "email addresses"],
  phone: ["phone number", "phone numbers"],
  kennitala: ["kennitala", "kennitölur"],
  name: ["full name", "full names"],
};

function textOf(doc: ImportDocument): string {
  return doc.kind === "text" ? doc.text : doc.sheets.flatMap((s) => s.rows.flat()).filter(Boolean).join("\n");
}

function withoutPersonal(doc: ImportDocument, found: PersonalData[]): ImportDocument {
  if (found.length === 0) return doc;
  return doc.kind === "text"
    ? { ...doc, text: removePersonalData(doc.text, found) }
    : { ...doc, sheets: doc.sheets.map((s) => ({ ...s, rows: s.rows.map((r) => r.map((c) => (c ? removePersonalData(c, found) : c))) })) };
}

/** A CSV in UTF-8, or in the Windows encoding European Excel saves in. */
function decode(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** "4 programs side by side: Class, Strength …", in words, so the coach sees at once whether the app read it right. */
function describe(doc: ImportDocument, layout: Layout): string {
  if (layout.kind === "text") {
    const how = { date: "a date at the top of each day", weekday: "a weekday at the top of each day", "week-day": "\"Week 1 Day 1\" at the top of each day" }[layout.days.by];
    return `Text with ${how}.`;
  }
  const sheets = layout.sheets.length === 1 ? "One sheet" : `${layout.sheets.length} sheets (${layout.sheets[0]} … ${layout.sheets.at(-1)})`;
  const programs = layout.programs.length === 1 ? `one program` : `${layout.programs.length} programs: ${layout.programs.map((p) => p.name).join(", ")}`;
  return `${sheets}, a row per day, ${programs}${doc.kind === "grid" && layout.dates.from === "day-of-month" ? `, ${layout.dates.year}` : ""}.`;
}

export function StartImport({
  slug,
  tracks,
  today,
  earlier,
}: {
  slug: string;
  tracks: TrackOption[];
  today: string;
  /** Layouts of the gym's latest imports, as corrected there. */
  earlier: { sourceName: string; layout: Layout }[];
}) {
  const id = useId();
  const router = useRouter();
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? null);
  const [source, setSource] = useState<{ name: string; kind: SourceKind; doc: ImportDocument } | null>(null);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [keepPersonal, setKeepPersonal] = useState(false);
  const [useEarlier, setUseEarlier] = useState(true);
  const [programIndex, setProgramIndex] = useState(0);
  const [pending, startTransition] = useTransition();

  const typed = useDeferredValue(pasted);
  const doc = useMemo(() => source?.doc ?? (typed.trim() ? fromText("Pasted text", typed) : null), [source, typed]);
  const proposed = useMemo(() => (doc ? proposeLayout(doc, today) : null), [doc, today]);
  // The gym's own corrections from an import laid out the same way, offered (and on unless the coach says no).
  const reused = useMemo(() => {
    const first = proposed ? earlier.map((e) => ({ from: e.sourceName, layout: reuseLayout(proposed, e.layout) })).find((r) => r.layout !== null) : undefined;
    return first?.layout ? { from: first.from, layout: first.layout } : null;
  }, [proposed, earlier]);
  const layout = reused && useEarlier ? reused.layout : proposed;
  const found = useMemo(() => (doc ? findPersonalData(textOf(doc)) : []), [doc]);
  const track = tracks.find((t) => t.id === trackId);

  const read = async (file: File) => {
    setError(null);
    setSource(null);
    const kind = sourceKindOf(file.name);
    if (!kind) return setError("Use an Excel, Google Sheets (downloaded as .xlsx or .csv), CSV, Word (.docx) or text file.");
    if (kind === "pdf") return setError("PDF files cannot be read directly yet. Open the PDF, select all its text, copy it and paste it below.");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const next =
        kind === "xlsx" ? fromXlsx(file.name, bytes) : kind === "csv" ? fromCsv(file.name, decode(bytes)) : kind === "docx" ? fromDocx(file.name, bytes) : fromText(file.name, decode(bytes));
      setSource({ name: file.name, kind, doc: next });
      setPasted("");
      // The document's program with the same name as the chosen one, else its first.
      const proposed = proposeLayout(next, today);
      const same = proposed?.kind === "grid" ? proposed.programs.findIndex((p) => p.name.trim().toLowerCase() === track?.name.trim().toLowerCase()) : -1;
      setProgramIndex(Math.max(same, 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "This file could not be read.");
    }
  };

  const start = () => {
    if (!doc || !trackId) return;
    setError(null);
    startTransition(async () => {
      const result = await startImport(slug, {
        trackId,
        sourceName: source?.name ?? "Pasted text",
        sourceKind: source?.kind ?? "text",
        document: keepPersonal ? doc : withoutPersonal(doc, found),
        layout,
        programIndex,
        keepPersonal,
      });
      if (!result.ok) return setError(result.error);
      router.push(`/${slug}/import/${result.id}`);
    });
  };

  const counts = Object.entries(
    found.reduce<Record<string, number>>((n, f) => ({ ...n, [f.kind]: (n[f.kind] ?? 0) + 1 }), {}),
  ).map(([kind, n]) => `${n} ${KIND_WORDS[kind as PersonalData["kind"]][n === 1 ? 0 : 1]}`);

  return (
    <SettingsSection title="Start an import" description="One import fills one program. You check everything before it reaches the calendar, and can undo it in one step after.">
      <div className="grid gap-4 rounded-lg border border-border bg-surface p-4">
        <FormError>{error}</FormError>
        <div className="grid gap-1.5 sm:max-w-xs">
          <label htmlFor={`${id}-program`} className="text-sm font-medium">
            Into the program
          </label>
          <Select items={tracks.map((t) => ({ value: t.id, label: t.name }))} value={trackId} onValueChange={(v) => setTrackId(v ? String(v) : null)}>
            <SelectTrigger id={`${id}-program`} className="w-full">
              <SelectValue placeholder="Choose a program" />
            </SelectTrigger>
            <SelectContent>
              {tracks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor={`${id}-file`} className="text-sm font-medium">
            A file
          </label>
          <label
            htmlFor={`${id}-file`}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-border-strong px-4 py-5 text-sm text-muted-foreground transition-colors hover:bg-hover has-focus-visible:outline-2 has-focus-visible:outline-ring"
          >
            <FileUpIcon className="size-5 shrink-0" aria-hidden />
            <span>
              {source ? <span className="font-medium text-foreground">{source.name}</span> : "Choose an Excel, CSV, Word or text file"}
              <span className="block text-xs">.xlsx and .csv (also from Google Sheets), .docx, .txt. Read on this computer; only the text is kept.</span>
            </span>
            <input
              id={`${id}-file`}
              type="file"
              accept=".xlsx,.xlsm,.csv,.tsv,.docx,.txt,.md,.pdf"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void read(file);
              }}
            />
          </label>
        </div>

        {!source && (
          <div className="grid gap-1.5">
            <label htmlFor={`${id}-paste`} className="text-sm font-medium">
              Or paste the text
            </label>
            <Textarea
              id={`${id}-paste`}
              rows={6}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              placeholder={"Monday 5.1.2026\nAMRAP 12\n10 burpees\n15 air squats\n\nTuesday 6.1.2026\n…"}
            />
          </div>
        )}

        {doc && (
          <div className="grid gap-3" role="status">
            {layout ? (
              <p className="text-sm">
                <span className="font-medium">Found: </span>
                {describe(doc, layout)}
              </p>
            ) : (
              <p className="text-sm">
                <span className="font-medium">No days found yet.</span>{" "}
                <span className="text-muted-foreground">Each day needs a date (5.1.2026, Monday 5 January), a weekday, or &ldquo;Day 1&rdquo; / &ldquo;Week 1 Day 1&rdquo; above its workout, or a column of dates.</span>
              </p>
            )}
            {layout?.kind === "grid" && layout.programs.length > 1 && (
              <div className="grid gap-1.5 sm:max-w-xs">
                <label htmlFor={`${id}-column`} className="text-sm font-medium">
                  Which program in the document
                </label>
                <Select
                  items={layout.programs.map((p, i) => ({ value: String(i), label: p.name }))}
                  value={String(programIndex)}
                  onValueChange={(v) => setProgramIndex(Number(v))}
                >
                  <SelectTrigger id={`${id}-column`} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {layout.programs.map((p, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">The others can be imported into their own programs after.</p>
              </div>
            )}
            {reused && (
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={useEarlier} onChange={(e) => setUseEarlier(e.target.checked)} className="accent-[var(--primary)]" />
                Laid out like “{reused.from}”: use the corrections made there (columns, months)
              </label>
            )}
            {found.length > 0 && (
              <div className="grid gap-1.5 rounded-md bg-warning-subtle px-3 py-2 text-sm">
                <p>
                  <span className="font-medium">Personal data: </span>
                  {counts.join(", ")}. {keepPersonal ? "They will be kept in the import." : "They are taken out before the document is kept."}
                </p>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={keepPersonal} onChange={(e) => setKeepPersonal(e.target.checked)} className="accent-[var(--primary)]" />
                  Keep them (only if the people agreed)
                </label>
              </div>
            )}
          </div>
        )}

        <div>
          <Button onClick={start} disabled={!doc || !layout || !trackId || pending}>
            {pending ? "Starting…" : "Start the import"}
          </Button>
        </div>
      </div>
    </SettingsSection>
  );
}
