"use client";

import { Tabs } from "@base-ui/react/tabs";
import { CircleAlertIcon } from "lucide-react";

import { Bars } from "@/components/design/bars";
import { Estimate } from "@/components/design/estimate";
import { PatternTag } from "@/components/design/tags";
import type { Measure, WorkoutResult } from "@/lib/engine/types";
import { formatMeasure } from "@/lib/format";
import { MODALITY_LABELS, MUSCLE_LABELS } from "@/lib/labels";
import type { ModalityKey, MuscleKey } from "@/lib/taxonomy";
import { PATTERNS } from "@/lib/taxonomy";
import { blockLabel, type DraftWorkout, FORMAT_LABELS } from "@/lib/workout/draft";

export type PanelIssue = { key: string; text: string; lines: { id: string; label: string }[] };

/**
 * The live load panel (calc spec §6): session length and planned load as
 * honest ranges, each block's share, the three other lenses, and warnings
 * that link to their line. Recomputed on every change, in the browser.
 */
export function LoadPanel({
  result,
  draft,
  issues,
  onShowLine,
}: {
  result: WorkoutResult;
  draft: DraftWorkout;
  issues: PanelIssue[];
  onShowLine: (itemId: string) => void;
}) {
  const restMin = result.sessionMin && result.durationMin ? result.sessionMin.mid - result.durationMin.mid : 0;
  return (
    <div className="grid gap-5 p-4" aria-live="polite" aria-atomic="false">
      <section aria-label="Session" className="grid grid-cols-2 gap-3">
        <Stat label="Session length" measure={result.sessionMin} unit="min" note={restMin > 0 ? `incl. ${formatNumber(restMin)} min rest between blocks` : undefined} />
        <Stat label="Planned load" measure={result.sRpe} unit="AU" note="RPE × minutes (planned)" />
      </section>

      <section aria-label="Blocks">
        <table className="w-full text-sm">
          <thead className="sr-only">
            <tr>
              <th>Block</th>
              <th>Duration</th>
              <th>Planned load</th>
            </tr>
          </thead>
          <tbody>
            {result.blocks.map((b, i) => (
              <tr key={draft.blocks[i]?.id ?? i} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-2">
                  <span className="font-medium">{blockLabel(i)}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{draft.blocks[i] && FORMAT_LABELS[draft.blocks[i].format]}</span>
                  {b.rounds && draft.blocks[i]?.format === "amrap" && (
                    <span className="ml-1.5 text-xs text-muted-foreground">
                      <Estimate measure={b.rounds} unit="rounds" /> rounds
                    </span>
                  )}
                </td>
                <td className="py-1.5 text-right text-muted-foreground">{b.durationMin ? <Estimate measure={b.durationMin} unit="min" /> : "—"}</td>
                <td className="w-24 py-1.5 text-right">
                  {b.sRpe ? <Estimate measure={b.sRpe} unit="AU" /> : <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {issues.length > 0 && (
        <section aria-label="Warnings" className="grid gap-1.5">
          <h3 className="text-2xs font-medium tracking-wide text-muted-foreground uppercase">To check</h3>
          <ul className="grid gap-1">
            {issues.map((issue) => (
              <li key={issue.key} className="flex items-start gap-2 rounded-md bg-warning-subtle px-2 py-1.5 text-xs">
                <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
                <span className="min-w-0 flex-1">
                  {issue.lines.map((line) => (
                    <button
                      key={line.id}
                      type="button"
                      onClick={() => onShowLine(line.id)}
                      className="mr-1 rounded-sm font-medium text-foreground underline underline-offset-2"
                    >
                      {line.label}
                    </button>
                  ))}
                  {issue.text}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Tabs.Root defaultValue="strength" className="grid gap-3">
        <Tabs.List className="flex gap-1 border-b border-border" aria-label="Lenses">
          {[
            ["strength", "Strength"],
            ["movement", "Movement"],
            ["conditioning", "Conditioning"],
          ].map(([value, label]) => (
            <Tabs.Tab
              key={value}
              value={value}
              className="-mb-px h-8 border-b-2 border-transparent px-2 text-sm font-medium text-muted-foreground hover:text-foreground data-active:border-primary data-active:text-foreground"
            >
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="strength" className="grid gap-4">
          <Bars
            title="Hard sets by pattern"
            empty="No hard sets: no line has Load Moderate or Hard."
            rows={PATTERNS.flatMap((p) => (result.hardSets.byPattern[p] ? [{ key: p, label: <PatternTag pattern={p} />, measure: result.hardSets.byPattern[p]! }] : []))}
            unit="sets"
          />
          <Bars
            title="Hard sets by muscle"
            rows={(Object.entries(result.hardSets.byMuscle) as [MuscleKey, Measure][])
              .sort((a, b) => b[1].mid - a[1].mid)
              .slice(0, 8)
              .map(([m, measure]) => ({ key: m, label: MUSCLE_LABELS[m], measure }))}
            unit="sets"
          />
          {result.volumeLoadKg && (
            <p className="flex justify-between text-sm">
              <span className="text-muted-foreground">Volume load</span>
              <Estimate measure={result.volumeLoadKg} unit="kg" />
            </p>
          )}
          {result.intensityZones.length > 0 && (
            <ul className="grid gap-1 text-sm">
              {result.intensityZones.map((z, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{z.exercise}</span>
                  <span className="text-muted-foreground tabular">
                    {z.minPercent === z.maxPercent ? `${z.minPercent}%` : `${z.minPercent}–${z.maxPercent}%`} × {formatMeasure(z.sets, "sets").main}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="movement" className="grid gap-4">
          <Bars
            title="Reps by pattern"
            empty="No movement reps yet."
            rows={PATTERNS.flatMap((p) => (result.exposure.reps[p] ? [{ key: p, label: <PatternTag pattern={p} />, measure: result.exposure.reps[p]! }] : []))}
            unit="reps"
          />
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {[
              ["Push : pull", result.ratios.pushPull],
              ["Knee : hip", result.ratios.kneeHip],
              ["Upper : lower", result.ratios.upperLower],
            ].map(([label, measure]) => (
              <div key={label as string} className="grid gap-0.5 rounded-md border border-border px-2 py-1.5">
                <dt className="text-xs text-muted-foreground">{label as string}</dt>
                <dd className="font-medium">{measure ? <Estimate measure={measure as Measure} unit="ratio" /> : "—"}</dd>
              </div>
            ))}
          </dl>
        </Tabs.Panel>

        <Tabs.Panel value="conditioning" className="grid gap-2">
          {Object.keys(result.monostructural).length === 0 ? (
            <p className="text-sm text-muted-foreground">No running, rowing, biking, skiing, rope or swimming.</p>
          ) : (
            (Object.entries(result.monostructural) as [ModalityKey, NonNullable<WorkoutResult["monostructural"][ModalityKey]>][]).map(([modality, t]) => (
              <div key={modality} className="flex items-baseline justify-between gap-2 border-b border-border py-1.5 text-sm last:border-0">
                <span className="font-medium">{MODALITY_LABELS[modality]}</span>
                <span className="flex gap-3 text-right">
                  {t.distanceM && <Estimate measure={t.distanceM} unit="m" />}
                  {t.calories && <Estimate measure={t.calories} unit="cal" />}
                  {t.reps && <Estimate measure={t.reps} unit="reps" />}
                </span>
              </div>
            ))
          )}
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  );
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function Stat({ label, measure, unit, note }: { label: string; measure: Measure | null; unit: "min" | "AU"; note?: string }) {
  return (
    <div className="grid content-start gap-0.5 rounded-lg border border-border bg-surface px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold" data-testid={unit === "AU" ? "planned-load" : "session-length"}>
        {measure ? <Estimate measure={measure} unit={unit} /> : <span className="text-muted-foreground">—</span>}
      </span>
      {note && <span className="text-2xs text-muted-foreground">{note}</span>}
    </div>
  );
}
