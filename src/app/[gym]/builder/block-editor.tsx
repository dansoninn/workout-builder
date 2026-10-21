"use client";

import { ArrowDownIcon, ArrowUpIcon, EllipsisIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useId } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { defaultEfforts } from "@/lib/engine/effort";
import type { BlockIntent } from "@/lib/engine/types";
import { INTENT_LABELS, semanticColor } from "@/lib/labels";
import type { EffortKey } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";
import { blockLabel, type DraftBlock, type DraftItem, type DraftProblem, FORMAT_LABELS, isAlternating } from "@/lib/workout/draft";
import type { Library } from "@/lib/workout/library";
import { BLOCK_FORMATS, type BlockFormat } from "@/lib/workout/rules";

import { DurationInput, EffortPicker, NumberInput, SmallField } from "./controls";
import { type LineKeys, LineRow } from "./line-row";
import type { DraftAction } from "./use-draft";

const INTENTS = Object.keys(INTENT_LABELS) as BlockIntent[];

export function BlockEditor({
  block,
  index,
  count,
  library,
  problems,
  readOnly,
  highlightedItem,
  dispatch,
  lineKeys,
  onAddLine,
}: {
  block: DraftBlock;
  index: number;
  count: number;
  library: Library;
  problems: DraftProblem[];
  readOnly: boolean;
  highlightedItem: string | null;
  dispatch: (action: DraftAction) => void;
  lineKeys: (item: DraftItem) => LineKeys;
  onAddLine: (slot: number | null) => void;
}) {
  const label = blockLabel(index);
  const titleId = useId();
  const notesId = useId();
  const set = (patch: Partial<Omit<DraftBlock, "id" | "items" | "format">>) => dispatch({ type: "block", id: block.id, patch });
  const setParam = (key: string, value: number | boolean | undefined) => set({ params: { ...block.params, [key]: value } });
  const defaults = defaultEfforts({ intent: block.intent, format: block.format });
  const alternating = isAlternating(block);
  const blockProblem = problems.find((p) => p.item === null);

  // Alternating EMOM: lines grouped by minute, in order.
  const slots = alternating ? Math.max(1, ...block.items.map((i) => i.slot ?? 1)) : null;
  const groups: { slot: number | null; items: { item: DraftItem; index: number }[] }[] = alternating
    ? Array.from({ length: slots! }, (_, s) => ({
        slot: s + 1,
        items: block.items.flatMap((item, i) => ((item.slot ?? 1) === s + 1 ? [{ item, index: i }] : [])),
      }))
    : [{ slot: null, items: block.items.map((item, i) => ({ item, index: i })) }];

  return (
    <section
      aria-labelledby={titleId}
      data-block={block.id}
      className="rounded-lg border border-border bg-surface"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <span
          id={titleId}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold"
          style={{ backgroundColor: `color-mix(in oklch, ${semanticColor("intent", block.intent)} 16%, transparent)` }}
        >
          <span className="sr-only">Block </span>
          {label}
        </span>
        <input
          aria-label={`Block ${label} title`}
          value={block.title}
          placeholder="Title (optional)"
          disabled={readOnly}
          onChange={(e) => set({ title: e.target.value })}
          className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-sm font-medium placeholder:font-normal placeholder:text-subtle-foreground hover:border-border focus-visible:border-ring focus-visible:outline-none disabled:hover:border-transparent"
        />
        <Select
          items={INTENTS.map((i) => ({ value: i, label: INTENT_LABELS[i] }))}
          value={block.intent}
          onValueChange={(intent) => intent && set({ intent: intent as BlockIntent })}
          disabled={readOnly}
        >
          <SelectTrigger size="sm" className="w-36" aria-label={`Block ${label} intent`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTENTS.map((i) => (
              <SelectItem key={i} value={i}>
                {INTENT_LABELS[i]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={BLOCK_FORMATS.map((f) => ({ value: f, label: FORMAT_LABELS[f] }))}
          value={block.format}
          onValueChange={(format) => format && dispatch({ type: "format", id: block.id, format: format as BlockFormat })}
          disabled={readOnly}
        >
          <SelectTrigger size="sm" className="w-36" aria-label={`Block ${label} format`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLOCK_FORMATS.map((f) => (
              <SelectItem key={f} value={f}>
                {FORMAT_LABELS[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!readOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Block ${label} options`} />}>
              <EllipsisIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem disabled={index === 0} onClick={() => dispatch({ type: "moveBlock", id: block.id, delta: -1 })}>
                <ArrowUpIcon /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem disabled={index === count - 1} onClick={() => dispatch({ type: "moveBlock", id: block.id, delta: 1 })}>
                <ArrowDownIcon /> Move down
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => dispatch({ type: "removeBlock", id: block.id })}>
                <Trash2Icon /> Delete block
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 border-b border-border px-3 py-3">
        <FormatFields block={block} readOnly={readOnly} setParam={setParam} set={set} dispatch={dispatch} />
        <div className="ml-auto grid gap-1.5">
          <EffortPicker<EffortKey>
            axis="pace"
            value={block.paceEffort}
            onChange={(paceEffort) => set({ paceEffort })}
            fallback={defaults.pace}
            disabled={readOnly}
          />
          <EffortPicker<Exclude<EffortKey, "max">>
            axis="load"
            value={block.loadEffort}
            onChange={(loadEffort) => set({ loadEffort })}
            fallback={defaults.load as Exclude<EffortKey, "max"> | null}
            disabled={readOnly}
          />
        </div>
      </div>
      {blockProblem && <p className="px-3 pt-2 text-xs text-warning">{blockProblem.message}</p>}

      <div className="grid gap-0.5 p-2" role="group" aria-label={`Block ${label} lines`}>
        {groups.map((group) => (
          <div key={group.slot ?? "all"} className={cn(group.slot !== null && "rounded-md border border-dashed border-border p-1")}>
            {group.slot !== null && (
              <p className="px-2 pt-0.5 pb-1 text-2xs font-medium tracking-wide text-muted-foreground uppercase">
                Minute {group.slot}
                {group.slot === 1 && <span className="font-normal normal-case"> (then repeats)</span>}
              </p>
            )}
            {group.items.map(({ item, index: i }) => (
              <LineRow
                key={item.id}
                block={block}
                item={item}
                label={`${label}${i + 1}`}
                library={library}
                problems={problems.filter((p) => p.item === i)}
                slots={slots}
                readOnly={readOnly}
                highlighted={highlightedItem === item.id}
                onChange={(patch) => dispatch({ type: "item", blockId: block.id, id: item.id, patch })}
                onFocusField={(field) => focusField(item.id, field)}
                keys={lineKeys(item)}
              />
            ))}
            {!readOnly && group.slot !== null && (
              <Button variant="ghost" size="xs" className="ml-9 text-muted-foreground" onClick={() => onAddLine(group.slot)}>
                <PlusIcon /> Line in minute {group.slot}
              </Button>
            )}
          </div>
        ))}
        {!readOnly && (
          <div className="flex gap-1 pl-9">
            <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => onAddLine(alternating ? null : null)}>
              <PlusIcon /> {alternating ? "New minute" : "Line"} <span className="text-2xs">Enter</span>
            </Button>
          </div>
        )}
      </div>

      {(block.notes || !readOnly) && (
        <div className="grid gap-1 border-t border-border px-3 py-2">
          <label htmlFor={notesId} className="sr-only">
            Block {label} notes
          </label>
          <Textarea
            id={notesId}
            value={block.notes}
            rows={1}
            disabled={readOnly}
            placeholder="Notes for coaches (optional)"
            onChange={(e) => set({ notes: e.target.value })}
            className="min-h-8 resize-y border-transparent bg-transparent px-2 py-1.5 text-sm shadow-none hover:border-border"
          />
        </div>
      )}
    </section>
  );
}

/** Only the fields the block's format needs (calc spec §4.3). */
function FormatFields({
  block,
  readOnly,
  setParam,
  set,
  dispatch,
}: {
  block: DraftBlock;
  readOnly: boolean;
  setParam: (key: string, value: number | boolean | undefined) => void;
  set: (patch: Partial<Omit<DraftBlock, "id" | "items" | "format">>) => void;
  dispatch: (action: DraftAction) => void;
}) {
  const p = block.params as Record<string, number | undefined> & { alternating?: boolean };
  const rest = (
    <SmallField label="Rest after block" hint="(optional)">
      {(id) => (
        <DurationInput id={id} value={block.restAfterSec} bareUnit="s" optional disabled={readOnly}
          onChange={(v) => set({ restAfterSec: v ?? null })} placeholder="—" />
      )}
    </SmallField>
  );
  const partner = (
    <label className="flex h-8 items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <input type="checkbox" checked={block.partner} disabled={readOnly} onChange={(e) => set({ partner: e.target.checked })} className="accent-[var(--primary)]" />
      Partner
    </label>
  );

  switch (block.format) {
    case "sets":
      return (
        <>
          <SmallField label="Sets">{(id) => <NumberInput id={id} value={p.sets} disabled={readOnly} onChange={(v) => setParam("sets", v)} />}</SmallField>
          <SmallField label="Rest" hint="(optional)">
            {(id) => <DurationInput id={id} value={p.rest_s} bareUnit="s" optional disabled={readOnly} onChange={(v) => setParam("rest_s", v)} placeholder="—" />}
          </SmallField>
          {rest}
          {partner}
        </>
      );
    case "every":
      return (
        <>
          <SmallField label="Every">{(id) => <DurationInput id={id} value={p.interval_s} bareUnit="min" disabled={readOnly} onChange={(v) => setParam("interval_s", v)} />}</SmallField>
          <SmallField label={p.alternating ? "Rotations" : "Rounds"}>
            {(id) => <NumberInput id={id} value={p.rounds} disabled={readOnly} onChange={(v) => setParam("rounds", v)} />}
          </SmallField>
          <label className="flex h-8 items-center gap-1.5 text-xs font-medium text-muted-foreground" title="Minute 1: X, minute 2: Y … repeated">
            <input
              type="checkbox"
              checked={p.alternating === true}
              disabled={readOnly}
              onChange={(e) => dispatch({ type: "alternating", id: block.id, on: e.target.checked })}
              className="accent-[var(--primary)]"
            />
            Alternating minutes
          </label>
          {rest}
          {partner}
        </>
      );
    case "amrap":
      return (
        <>
          <SmallField label="Time">{(id) => <DurationInput id={id} value={p.time_s} bareUnit="min" disabled={readOnly} onChange={(v) => setParam("time_s", v)} />}</SmallField>
          <SmallField label="Target rounds" hint="(optional)">
            {(id) => (
              <NumberInput id={id} value={block.targetRounds} optional disabled={readOnly} placeholder="—"
                onChange={(v) => set({ targetRounds: v ?? null })} />
            )}
          </SmallField>
          {rest}
          {partner}
        </>
      );
    case "for_time":
      return (
        <>
          <SmallField label="Rounds">{(id) => <NumberInput id={id} value={p.rounds} disabled={readOnly} onChange={(v) => setParam("rounds", v)} />}</SmallField>
          <SmallField label="Time cap" hint="(optional)">
            {(id) => <DurationInput id={id} value={p.time_cap_s} bareUnit="min" optional disabled={readOnly} onChange={(v) => setParam("time_cap_s", v)} placeholder="—" />}
          </SmallField>
          {rest}
          {partner}
        </>
      );
    case "intervals":
      return (
        <>
          <SmallField label="Rounds">{(id) => <NumberInput id={id} value={p.rounds} disabled={readOnly} onChange={(v) => setParam("rounds", v)} />}</SmallField>
          <SmallField label="Stations">{(id) => <NumberInput id={id} value={p.stations} disabled={readOnly} onChange={(v) => setParam("stations", v)} />}</SmallField>
          <SmallField label="Work">{(id) => <DurationInput id={id} value={p.work_s} bareUnit="s" disabled={readOnly} onChange={(v) => setParam("work_s", v)} />}</SmallField>
          <SmallField label="Rest">{(id) => <DurationInput id={id} value={p.rest_s} bareUnit="s" optional disabled={readOnly} onChange={(v) => setParam("rest_s", v ?? 0)} />}</SmallField>
          <SmallField label="Between rounds" hint="(optional)">
            {(id) => <DurationInput id={id} value={p.rest_between_rounds_s} bareUnit="s" optional disabled={readOnly} onChange={(v) => setParam("rest_between_rounds_s", v)} placeholder="—" />}
          </SmallField>
          {rest}
        </>
      );
    case "tabata":
      return (
        <>
          <SmallField label="Rounds">{(id) => <NumberInput id={id} value={p.rounds} disabled={readOnly} onChange={(v) => setParam("rounds", v)} />}</SmallField>
          <p className="flex h-8 items-center text-xs text-muted-foreground">20 s work · 10 s rest</p>
          {rest}
        </>
      );
  }
}

/**
 * Moves focus to a line's field once it is on screen. Next.js keeps pages you
 * left alive but hidden, so a line can exist twice in the document: take the
 * visible one.
 */
export function focusField(itemId: string, field: "exercise" | "quantity" | "load") {
  const fields = document.querySelectorAll<HTMLInputElement>(`[data-line="${itemId}"][data-field="${field}"]`);
  [...fields].find((el) => el.getClientRects().length > 0)?.focus();
}
