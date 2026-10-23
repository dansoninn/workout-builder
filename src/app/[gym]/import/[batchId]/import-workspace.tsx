"use client";

import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { PageBody, PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { extractDays } from "@/lib/import/days";
import type { ImportDocument } from "@/lib/import/document";
import { type Layout, proposeLayout } from "@/lib/import/layout";
import { type ImportChoices, planImport } from "@/lib/import/plan";
import { type ImportAnswers, readImport } from "@/lib/import/review";
import { cn } from "@/lib/utils";
import { dayLabel } from "@/lib/week";
import type { Library } from "@/lib/workout/library";

import { commitImport, discardImport, saveImport } from "../actions";
import { AnswersStep } from "./answers-step";
import { DayDialog } from "./day-dialog";
import { ImportStep } from "./import-step";
import { LayoutStep } from "./layout-step";
import { PreviewStep } from "./preview-step";

type Step = "layout" | "answers" | "preview" | "import";

export interface WorkspaceData {
  layout: Layout | null;
  programIndex: number;
  answers: ImportAnswers;
  choices: ImportChoices;
}

/**
 * The Import workspace (BACKLOG "Program import"): the whole import happens
 * here and nothing reaches the calendar until the coach imports. Four steps:
 * how the document is laid out, what needs the coach (one queue, most lines
 * first), a preview of the calendar and the numbers, and the import itself.
 * Every answer is kept as it is given, so a year can be finished another day.
 */
export function ImportWorkspace({
  slug,
  batchId,
  sourceName,
  programName,
  today,
  document,
  initial,
  library,
  focusNames,
  existing,
  canManage,
  country,
}: {
  slug: string;
  batchId: string;
  sourceName: string;
  programName: string;
  today: string;
  document: ImportDocument;
  initial: WorkspaceData;
  library: Library;
  focusNames: string[];
  existing: { id: string; date: string; title: string | null }[];
  canManage: boolean;
  country: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initial.layout ? "answers" : "layout");
  const [layout, setLayoutState] = useState<Layout | null>(() => initial.layout ?? proposeLayout(document, today));
  const [programIndex, setProgramIndexState] = useState(initial.programIndex);
  const [answers, setAnswersState] = useState(initial.answers);
  const [choices, setChoicesState] = useState(initial.choices);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [saved, setSaved] = useState<"saved" | "saving" | "error">("saved");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  // Every change is kept a moment after it is made.
  const changed = () => setSaved("saving");
  const setLayout = (next: Layout) => (changed(), setLayoutState(next));
  const setProgramIndex = (next: number) => (changed(), setProgramIndexState(next));
  const setAnswers = (next: (a: ImportAnswers) => ImportAnswers) => (changed(), setAnswersState(next));
  const setChoices = (next: (c: ImportChoices) => ImportChoices) => (changed(), setChoicesState(next));
  const current = useRef({ layout, programIndex, answers, choices });
  const first = useRef(true);
  useEffect(() => {
    current.current = { layout, programIndex, answers, choices };
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(async () => {
      const result = await saveImport(slug, batchId, current.current);
      setSaved(result.ok ? "saved" : "error");
    }, 700);
    return () => clearTimeout(timer);
  }, [slug, batchId, layout, programIndex, answers, choices]);

  const days = useMemo(() => (layout ? extractDays(document, layout, programIndex) : []), [document, layout, programIndex]);
  const read = useDeferredValue(answers);
  const reading = useMemo(() => readImport(days, library, read, { country, firstProgram: programIndex === 0 }), [days, library, read, country, programIndex]);
  const plan = useMemo(() => {
    let n = 0;
    return planImport(reading, { trackId: "preview", library, focusNames, canManage, existing, choices, newId: () => `preview-${++n}` });
  }, [reading, library, focusNames, canManage, existing, choices]);

  const commit = () =>
    startTransition(async () => {
      const kept = await saveImport(slug, batchId, current.current);
      if (!kept.ok) return void toast.error(kept.error);
      const result = await commitImport(slug, batchId);
      if (!result.ok) return void toast.error(result.error);
      setConfirming(false);
      toast.success(`${result.workouts} workouts imported into ${programName}`);
      router.push(`/${slug}/import/${batchId}/report`);
    });

  const discard = () =>
    startTransition(async () => {
      const result = await discardImport(slug, batchId);
      if (!result.ok) return void toast.error(result.error);
      router.push(`/${slug}/import`);
    });

  const { progress } = reading;
  const toAnswer = reading.queue.filter((q) => q.kind !== "note").length;
  const steps: { key: Step; label: string; note?: string }[] = [
    { key: "layout", label: "Layout" },
    { key: "answers", label: "Needs you", note: toAnswer ? String(toAnswer) : undefined },
    { key: "preview", label: "Preview" },
    { key: "import", label: "Import" },
  ];
  const dated = days.filter((d) => d.date).map((d) => d.date!).sort();
  const opened = reading.days.find((r) => r.day.key === openDay) ?? null;

  return (
    <PageBody className="max-w-6xl">
      <PageHeader
        title={sourceName}
        description={`Into ${programName}${dated.length ? ` · ${dayLabel(dated[0]!)} – ${dayLabel(dated.at(-1)!)}` : ""} · ${progress.workouts} workouts`}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground" role="status">
              {saved === "saving" ? "Saving…" : saved === "error" ? "Not saved: check your connection" : "All changes kept"}
            </span>
            <Link href={`/${slug}/import`} className="text-sm underline underline-offset-2">
              All imports
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-3">
        <Progress label="Lines understood" value={progress.understood} of={progress.lines} />
        <p className="text-sm text-muted-foreground">
          {progress.ready} of {progress.workouts} workouts ready
          {plan.summary.cannotSave ? ` · ${plan.summary.cannotSave} to fix before they can be imported` : ""}. Workouts that still need you can be imported as drafts and finished in the builder.
        </p>
        <nav aria-label="Import steps" className="flex flex-wrap gap-1 border-b border-border">
          {steps.map((s, i) => (
            <button
              key={s.key}
              type="button"
              aria-current={step === s.key ? "step" : undefined}
              onClick={() => setStep(s.key)}
              className={cn(
                "-mb-px flex h-9 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm text-muted-foreground transition-colors hover:text-foreground",
                step === s.key && "border-primary font-medium text-foreground",
              )}
            >
              <span className="tabular">{i + 1}.</span> {s.label}
              {s.note && <span className="rounded-full bg-hover px-1.5 text-xs tabular">{s.note}</span>}
            </button>
          ))}
        </nav>
      </div>

      {step === "layout" && (
        <LayoutStep document={document} layout={layout} setLayout={setLayout} programIndex={programIndex} setProgramIndex={setProgramIndex} days={days} onNext={() => setStep("answers")} />
      )}
      {step === "answers" && (
        <AnswersStep
          reading={reading}
          answers={answers}
          setAnswers={setAnswers}
          choices={choices}
          setChoices={setChoices}
          library={library}
          focusNames={focusNames}
          canManage={canManage}
          onOpenDay={setOpenDay}
          onNext={() => setStep("preview")}
        />
      )}
      {step === "preview" && <PreviewStep reading={reading} plan={plan} library={library} existing={existing} onOpenDay={setOpenDay} onNext={() => setStep("import")} />}
      {step === "import" && (
        <ImportStep
          reading={reading}
          plan={plan}
          choices={choices}
          setChoices={setChoices}
          canManage={canManage}
          programName={programName}
          onOpenDay={setOpenDay}
          onImport={() => setConfirming(true)}
          onDiscard={discard}
          pending={pending}
        />
      )}

      <DayDialog
        read={opened}
        document={document}
        answers={answers}
        setAnswers={setAnswers}
        onClose={() => setOpenDay(null)}
      />

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import {plan.summary.workouts} workouts into {programName}?</DialogTitle>
            <DialogDescription>
              {plan.summary.published ? `${plan.summary.published} published, ${plan.summary.drafts} as drafts. ` : "All as drafts. "}
              {plan.summary.replaced ? `${plan.summary.replaced} workouts already on those days are replaced. ` : ""}
              You can undo the whole import in one step after.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="ghost" />}>Not yet</DialogClose>
            <Button onClick={commit} disabled={pending}>
              {pending ? (
                "Importing…"
              ) : (
                <>
                  <CheckIcon /> Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageBody>
  );
}

/** How much is understood: a bar and the numbers, also for screen readers. */
export function Progress({ label, value, of }: { label: string; value: number; of: number }) {
  const percent = of ? Math.round((value / of) * 100) : 100;
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular text-muted-foreground">
          {value.toLocaleString("en-US")} of {of.toLocaleString("en-US")} ({percent}%)
        </span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-hover">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
