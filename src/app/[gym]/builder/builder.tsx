"use client";

import { CopyIcon, EllipsisIcon, PlusIcon, RotateCcwIcon, Trash2Icon, UndoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { usePageCommands } from "@/components/app/shell-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ENGINE_CONFIG } from "@/lib/engine/config";
import { computeWorkout } from "@/lib/engine/workout";
import { cn } from "@/lib/utils";
import {
  blockLabel,
  draftProblems,
  type DraftItem,
  type DraftWorkout,
  isAlternating,
  isStarted,
  newBlock,
  newItem,
  toEngineWorkout,
} from "@/lib/workout/draft";
import type { Library } from "@/lib/workout/library";

import { deleteWorkout, saveWorkout, setWorkoutStatus } from "./actions";
import { BlockEditor, focusField } from "./block-editor";
import { LoadPanel, type PanelIssue } from "./load-panel";
import { useDraft } from "./use-draft";

export type TrackOption = { id: string; name: string; color: string | null; archived: boolean };

export function Builder({
  slug,
  library,
  tracks,
  initial,
  isNew,
  canEdit,
}: {
  slug: string;
  library: Library;
  tracks: TrackOption[];
  initial: DraftWorkout;
  isNew: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const readOnly = !canEdit;
  const { draft, dispatch, dirty, markSaved, backup, restoreBackup, discardBackup } = useDraft(initial, isNew ? `new:${slug}` : initial.id);
  const [saving, startSaving] = useTransition();
  const [savedOnce, setSavedOnce] = useState(!isNew);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [publishBlocked, setPublishBlocked] = useState<{ id: string; label: string }[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The engine runs in the browser on every change (deferred so typing never waits).
  const deferred = useDeferredValue(draft);
  const { result, itemIndex } = useMemo(() => {
    const { workout, itemIndex } = toEngineWorkout(deferred, library);
    return { result: computeWorkout(workout, ENGINE_CONFIG), itemIndex };
  }, [deferred, library]);
  const problems = useMemo(() => draftProblems(draft, library), [draft, library]);

  const lineLabel = useCallback(
    (itemId: string) => {
      for (const [b, block] of draft.blocks.entries()) {
        const i = block.items.findIndex((item) => item.id === itemId);
        if (i >= 0) return `${blockLabel(b)}${i + 1}`;
      }
      return "?";
    },
    [draft],
  );

  const panelIssues = useMemo<PanelIssue[]>(() => {
    const fromProblems = problems.flatMap((p, n) => {
      if (p.block < 0) return [{ key: `w${n}`, text: p.message, lines: [] }];
      const block = deferred.blocks[p.block];
      const item = p.item !== null ? block?.items[p.item] : undefined;
      return [{ key: `p${n}`, text: item ? ` ${p.message}` : `Block ${blockLabel(p.block)}: ${p.message}`, lines: item ? [{ id: item.id, label: lineLabel(item.id) }] : [] }];
    });
    const fromEngine = result.issues.flatMap((issue, n) => {
      const block = deferred.blocks[issue.block];
      const lines = issue.items.flatMap((engineIndex) => {
        const item = block?.items[itemIndex[issue.block]?.[engineIndex] ?? -1];
        return item ? [{ id: item.id, label: lineLabel(item.id) }] : [];
      });
      const text = issue.message.replace(/^unmatched line skipped: .*/, "no exercise chosen (not counted; needed to publish)");
      return [{ key: `e${n}`, text: lines.length ? ` ${text}` : `Block ${blockLabel(issue.block)}: ${text}`, lines }];
    });
    return [...fromProblems, ...fromEngine];
  }, [problems, result, deferred, itemIndex, lineLabel]);

  const showLine = useCallback((itemId: string) => {
    const rows = document.querySelectorAll(`[data-line-row="${itemId}"]`);
    [...rows].find((el) => el.getClientRects().length > 0)?.scrollIntoView({ block: "center", behavior: "smooth" });
    focusField(itemId, "exercise");
    setHighlighted(itemId);
    window.setTimeout(() => setHighlighted((current) => (current === itemId ? null : current)), 1600);
  }, []);

  const save = useCallback(
    (then?: (saved: DraftWorkout) => void) => {
      if (readOnly) return;
      if (problems.length > 0) {
        const first = problems[0]!;
        toast.error(`Fix this first: ${first.message}`);
        const item = first.item !== null ? draft.blocks[first.block]?.items[first.item] : undefined;
        if (item) showLine(item.id);
        return;
      }
      const snapshot = draft;
      startSaving(async () => {
        const result = await saveWorkout(slug, snapshot);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        markSaved(snapshot);
        setSavedOnce(true);
        if (isNew) router.replace(`/${slug}/builder/${snapshot.id}`, { scroll: false });
        then?.(snapshot);
      });
    },
    [readOnly, problems, draft, slug, markSaved, isNew, router, showLine],
  );

  const unmatchedLines = useCallback(
    (d: DraftWorkout) =>
      d.blocks.flatMap((block, b) =>
        block.items.flatMap((item, i) => (isStarted(item) && !item.exerciseId ? [{ id: item.id, label: `${blockLabel(b)}${i + 1}` }] : [])),
      ),
    [],
  );

  const publish = useCallback(() => {
    const blocking = unmatchedLines(draft);
    if (blocking.length > 0) {
      setPublishBlocked(blocking);
      return;
    }
    const doPublish = (saved: DraftWorkout) =>
      startSaving(async () => {
        const result = await setWorkoutStatus(slug, saved.id, "published");
        if (!result.ok) return void toast.error(result.error);
        dispatch({ type: "workout", patch: { status: "published" } });
        markSaved({ ...saved, status: "published" });
        toast.success("Published");
      });
    if (dirty || !savedOnce) save(doPublish);
    else doPublish(draft);
  }, [draft, dirty, savedOnce, save, slug, dispatch, markSaved, unmatchedLines]);

  const unpublish = useCallback(() => {
    startSaving(async () => {
      const result = await setWorkoutStatus(slug, draft.id, "draft");
      if (!result.ok) return void toast.error(result.error);
      dispatch({ type: "workout", patch: { status: "draft" } });
      if (!dirty) markSaved({ ...draft, status: "draft" });
      toast.success("Back to draft");
    });
  }, [slug, draft, dirty, dispatch, markSaved]);

  const saveAsTemplate = useCallback(() => {
    if (problems.length > 0) return void toast.error(`Fix this first: ${problems[0]!.message}`);
    const copy: DraftWorkout = {
      ...draft,
      id: crypto.randomUUID(),
      kind: "template",
      date: null,
      status: "draft",
      title: draft.title ? `${draft.title} (template)` : "Template",
      blocks: draft.blocks.map((b) => ({ ...b, id: crypto.randomUUID(), items: b.items.map((i) => ({ ...i, id: crypto.randomUUID() })) })),
    };
    startSaving(async () => {
      const result = await saveWorkout(slug, copy);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Saved as a template");
      router.push(`/${slug}/builder/${copy.id}`);
    });
  }, [draft, problems, slug, router]);

  // ⌘S saves from anywhere on the page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  const addBlockAfter = useCallback(
    (afterId: string | null) => {
      const block = newBlock("amrap", "conditioning");
      dispatch({ type: "addBlock", afterId, block });
      requestAnimationFrame(() => focusField(block.items[0]!.id, "exercise"));
    },
    [dispatch],
  );

  const commands = useMemo(
    () =>
      readOnly
        ? []
        : [
            { id: "save", label: "Save workout", keys: ["⌘", "S"], run: () => save() },
            { id: "add-block", label: "Add a block", keys: ["⌘", "Enter"], run: () => addBlockAfter(null) },
            draft.status === "published"
              ? { id: "unpublish", label: "Back to draft", run: unpublish }
              : { id: "publish", label: "Publish workout", run: publish },
            { id: "template", label: "Save as template", run: saveAsTemplate },
          ],
    [readOnly, save, addBlockAfter, draft.status, publish, unpublish, saveAsTemplate],
  );
  usePageCommands(commands);

  const lineKeys = (blockId: string) => (item: DraftItem) => ({
    onNewLine: () => {
      const block = draft.blocks.find((b) => b.id === blockId)!;
      const next = newItem(isAlternating(block) ? item.slot : null);
      dispatch({ type: "addItem", blockId, afterId: item.id, item: next });
      requestAnimationFrame(() => focusField(next.id, "exercise"));
    },
    onNewBlock: () => addBlockAfter(blockId),
    onMove: (delta: -1 | 1) => {
      dispatch({ type: "moveItem", blockId, id: item.id, delta });
      requestAnimationFrame(() => focusField(item.id, (document.activeElement as HTMLElement | null)?.dataset.field as "exercise" ?? "exercise"));
    },
    onDelete: () => {
      const block = draft.blocks.find((b) => b.id === blockId)!;
      const index = block.items.findIndex((i) => i.id === item.id);
      const neighbour = block.items[index - 1] ?? block.items[index + 1];
      dispatch({ type: "removeItem", blockId, id: item.id });
      if (neighbour) requestAnimationFrame(() => focusField(neighbour.id, "exercise"));
    },
  });

  const addLine = (blockId: string) => (slot: number | null) => {
    const block = draft.blocks.find((b) => b.id === blockId)!;
    const alternating = isAlternating(block);
    const nextSlot = alternating ? (slot ?? Math.max(0, ...block.items.map((i) => i.slot ?? 1)) + 1) : null;
    const lastInSlot = alternating ? [...block.items].reverse().find((i) => (i.slot ?? 1) === nextSlot) : block.items.at(-1);
    const item = newItem(nextSlot);
    dispatch({ type: "addItem", blockId, afterId: lastInSlot?.id ?? block.items.at(-1)?.id ?? null, item });
    requestAnimationFrame(() => focusField(item.id, "exercise"));
  };

  const status = saving ? "Saving…" : dirty ? "Unsaved changes" : savedOnce ? "Saved" : "Not saved yet";
  const trackItems = tracks.filter((t) => !t.archived || t.id === draft.trackId).map((t) => ({ value: t.id, label: t.name }));
  const dateId = useId();
  const trackId = useId();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-12 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur lg:top-0 lg:px-6">
        <h1 className="sr-only">Builder</h1>
        <input
          aria-label="Workout title"
          value={draft.title}
          placeholder={draft.kind === "template" ? "Untitled template" : "Untitled workout"}
          disabled={readOnly}
          onChange={(e) => dispatch({ type: "workout", patch: { title: e.target.value } })}
          className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-lg font-semibold placeholder:text-subtle-foreground hover:border-border focus-visible:border-ring focus-visible:outline-none disabled:hover:border-transparent"
        />
        {draft.kind === "template" && <Badge variant="secondary">Template</Badge>}
        <Badge variant={draft.status === "published" ? "default" : "outline"}>{draft.status === "published" ? "Published" : "Draft"}</Badge>
        {readOnly ? (
          <Badge variant="outline">View only</Badge>
        ) : (
          <>
            <span role="status" className={cn("hidden text-xs sm:inline", dirty ? "text-warning" : "text-muted-foreground")}>
              {status}
            </span>
            <Button variant="outline" size="sm" onClick={() => save()} disabled={saving} aria-keyshortcuts="Meta+S">
              Save <Kbd className="ml-1 hidden sm:inline-flex">⌘S</Kbd>
            </Button>
            {draft.status === "published" ? (
              <Button variant="ghost" size="sm" onClick={unpublish} disabled={saving}>
                <UndoIcon /> Unpublish
              </Button>
            ) : (
              <Button size="sm" onClick={publish} disabled={saving}>
                Publish
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More workout actions" />}>
                <EllipsisIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={saveAsTemplate}>
                  <CopyIcon /> Save as template
                </DropdownMenuItem>
                {savedOnce && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                      <Trash2Icon /> Delete workout
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </header>

      {backup && (
        <div role="alert" className="flex flex-wrap items-center gap-3 border-b border-border bg-warning-subtle px-4 py-2 text-sm lg:px-6">
          <RotateCcwIcon className="size-4 text-warning" aria-hidden />
          <span className="flex-1">
            Unsaved changes from {new Date(backup.at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} were kept in
            this browser.
          </span>
          <Button size="sm" onClick={restoreBackup}>
            Restore them
          </Button>
          <Button size="sm" variant="ghost" onClick={discardBackup}>
            Discard
          </Button>
        </div>
      )}

      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
        <div className="grid content-start gap-4 px-4 py-5 lg:px-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={dateId}>
                {draft.kind === "template" ? "Template (no date)" : "Date"}
              </label>
              {draft.kind === "scheduled" && (
                <input
                  id={dateId}
                  type="date"
                  value={draft.date ?? ""}
                  disabled={readOnly}
                  onChange={(e) => dispatch({ type: "workout", patch: { date: e.target.value || null } })}
                  className="h-8 rounded-md border border-input bg-surface px-2 text-sm tabular focus-visible:border-ring focus-visible:outline-none disabled:border-border"
                />
              )}
            </div>
            <div className="grid gap-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor={trackId}>
                Track
              </label>
              <Select items={trackItems} value={draft.trackId} onValueChange={(v) => dispatch({ type: "workout", patch: { trackId: v ?? null } })} disabled={readOnly}>
                <SelectTrigger id={trackId} size="default" className="w-44">
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
            {!readOnly && (
              <p className="ml-auto hidden text-xs text-muted-foreground xl:block">
                <Kbd>Enter</Kbd> new line · <Kbd>⌘</Kbd>
                <Kbd>Enter</Kbd> new block · <Kbd>⌥</Kbd>
                <Kbd>↑↓</Kbd> move line · <Kbd>⌘</Kbd>
                <Kbd>K</Kbd> more
              </p>
            )}
          </div>

          {draft.blocks.map((block, index) => (
            <BlockEditor
              key={block.id}
              block={block}
              index={index}
              count={draft.blocks.length}
              library={library}
              problems={problems.filter((p) => p.block === index)}
              readOnly={readOnly}
              highlightedItem={highlighted}
              dispatch={dispatch}
              lineKeys={lineKeys(block.id)}
              onAddLine={addLine(block.id)}
            />
          ))}

          {!readOnly && (
            <Button variant="outline" className="justify-self-start" onClick={() => addBlockAfter(null)}>
              <PlusIcon /> Add block <Kbd className="ml-1">⌘ Enter</Kbd>
            </Button>
          )}
        </div>

        <aside
          aria-label="Training load"
          className="border-t border-border bg-surface-sunken lg:sticky lg:top-12 lg:h-[calc(100dvh-3rem)] lg:overflow-y-auto lg:border-t-0 lg:border-l"
        >
          <LoadPanel result={result} draft={deferred} issues={panelIssues} onShowLine={showLine} />
        </aside>
      </div>

      <Dialog open={publishBlocked !== null} onOpenChange={(open) => !open && setPublishBlocked(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Not ready to publish</DialogTitle>
            <DialogDescription>
              Every line needs an exercise before the workout is published, so its training load is complete. These lines have none:
            </DialogDescription>
          </DialogHeader>
          <ul className="flex flex-wrap gap-1.5">
            {publishBlocked?.map((line) => (
              <li key={line.id}>
                <DialogClose render={<Button variant="outline" size="sm" />} onClick={() => showLine(line.id)}>
                  {line.label}
                </DialogClose>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <DialogClose render={<Button />}>OK</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this workout?</DialogTitle>
            <DialogDescription>It disappears from the calendar for everyone in the gym. Its history stays in the audit log.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="ghost" />}>Keep</DialogClose>
            <Button
              variant="destructive"
              onClick={() =>
                startSaving(async () => {
                  const result = await deleteWorkout(slug, draft.id);
                  if (result && !result.ok) toast.error(result.error);
                })
              }
            >
              Delete workout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
