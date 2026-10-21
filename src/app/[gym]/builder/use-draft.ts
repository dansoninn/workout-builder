"use client";

import { useCallback, useEffect, useMemo, useReducer, useState, useSyncExternalStore } from "react";

import {
  type DraftBlock,
  type DraftItem,
  type DraftWorkout,
  DEFAULT_PARAMS,
  newBlock,
  newItem,
} from "@/lib/workout/draft";
import { type BlockFormat, blockParamsSchemas } from "@/lib/workout/rules";

export type DraftAction =
  | { type: "replace"; draft: DraftWorkout }
  | { type: "workout"; patch: Partial<Pick<DraftWorkout, "title" | "focus" | "date" | "trackId" | "kind" | "status">> }
  | { type: "addBlock"; afterId: string | null; block: DraftBlock }
  | { type: "removeBlock"; id: string }
  | { type: "moveBlock"; id: string; delta: -1 | 1 }
  | { type: "block"; id: string; patch: Partial<Omit<DraftBlock, "id" | "items" | "format">> }
  | { type: "format"; id: string; format: BlockFormat }
  | { type: "alternating"; id: string; on: boolean }
  | { type: "addItem"; blockId: string; afterId: string | null; item: DraftItem }
  | { type: "removeItem"; blockId: string; id: string }
  | { type: "moveItem"; blockId: string; id: string; delta: -1 | 1 }
  | { type: "item"; blockId: string; id: string; patch: Partial<Omit<DraftItem, "id">> };

const move = <T>(list: T[], index: number, delta: number): T[] => {
  const target = index + delta;
  if (index < 0 || target < 0 || target >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item!);
  return next;
};

const insertAfter = <T extends { id: string }>(list: T[], afterId: string | null, item: T): T[] => {
  const index = afterId === null ? list.length - 1 : list.findIndex((x) => x.id === afterId);
  return [...list.slice(0, index + 1), item, ...list.slice(index + 1)];
};

function updateBlock(draft: DraftWorkout, id: string, update: (block: DraftBlock) => DraftBlock): DraftWorkout {
  return { ...draft, blocks: draft.blocks.map((b) => (b.id === id ? update(b) : b)) };
}

export function draftReducer(draft: DraftWorkout, action: DraftAction): DraftWorkout {
  switch (action.type) {
    case "replace":
      return action.draft;
    case "workout":
      return { ...draft, ...action.patch };
    case "addBlock":
      return { ...draft, blocks: insertAfter(draft.blocks, action.afterId, action.block) };
    case "removeBlock": {
      const blocks = draft.blocks.filter((b) => b.id !== action.id);
      return { ...draft, blocks: blocks.length > 0 ? blocks : [newBlock()] };
    }
    case "moveBlock":
      return { ...draft, blocks: move(draft.blocks, draft.blocks.findIndex((b) => b.id === action.id), action.delta) };
    case "block":
      return updateBlock(draft, action.id, (b) => ({ ...b, ...action.patch }));
    case "format":
      return updateBlock(draft, action.id, (b) => {
        // Keep the numbers the new format shares with the old one (rounds, rest…).
        const keys = Object.keys(blockParamsSchemas[action.format].shape);
        const kept = Object.fromEntries(keys.flatMap((k) => (b.params[k] !== undefined && k !== "alternating" ? [[k, b.params[k]]] : [])));
        return {
          ...b,
          format: action.format,
          params: { ...DEFAULT_PARAMS[action.format], ...kept },
          items: b.items.map((i) => ({ ...i, slot: null })),
          targetRounds: action.format === "amrap" ? b.targetRounds : null,
        };
      });
    case "alternating":
      return updateBlock(draft, action.id, (b) => ({
        ...b,
        params: { ...b.params, alternating: action.on || undefined },
        // Turning it on gives each line its own minute; the coach then groups them.
        items: b.items.map((i, index) => ({ ...i, slot: action.on ? index + 1 : null })),
      }));
    case "addItem":
      return updateBlock(draft, action.blockId, (b) => ({ ...b, items: insertAfter(b.items, action.afterId, action.item) }));
    case "removeItem":
      return updateBlock(draft, action.blockId, (b) => {
        const items = b.items.filter((i) => i.id !== action.id);
        return { ...b, items: items.length > 0 ? items : [newItem(b.params.alternating ? 1 : null)] };
      });
    case "moveItem":
      return updateBlock(draft, action.blockId, (b) => ({
        ...b,
        items: move(b.items, b.items.findIndex((i) => i.id === action.id), action.delta),
      }));
    case "item":
      return updateBlock(draft, action.blockId, (b) => ({
        ...b,
        items: b.items.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i)),
      }));
  }
}

const backupKey = (key: string) => `wb:draft:${key}`;

type Backup = { draft: DraftWorkout; at: number };

/**
 * The backup as it was when the page opened (later writes are our own). Read
 * once per page visit from browser storage; nothing on the server.
 */
const backupsAtOpen = new Map<string, string | null>();
function backupAtOpen(key: string): string | null {
  if (!backupsAtOpen.has(key)) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(backupKey(key));
    } catch {}
    backupsAtOpen.set(key, raw);
  }
  return backupsAtOpen.get(key) ?? null;
}
const noSubscription = () => () => {};

/**
 * The draft, whether it differs from what was last saved, and a backup of
 * unsaved work in this browser (offered back after a reload or crash).
 * `backupId` is the workout's id, or "new:<gym>" before the first save.
 */
export function useDraft(initial: DraftWorkout, backupId: string) {
  const [draft, dispatch] = useReducer(draftReducer, initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const dirty = JSON.stringify(draft) !== saved;

  // Offer back unsaved work found in this browser when the page opened.
  const rawBackup = useSyncExternalStore(noSubscription, () => backupAtOpen(backupId), () => null);
  const [answered, setAnswered] = useState(false);
  const backup = useMemo<Backup | null>(() => {
    if (answered || !rawBackup) return null;
    try {
      const found = JSON.parse(rawBackup) as Backup;
      return JSON.stringify(found.draft) !== JSON.stringify(initial) ? found : null;
    } catch {
      return null;
    }
  }, [answered, rawBackup, initial]);
  // The next visit reads storage afresh.
  useEffect(() => () => void backupsAtOpen.delete(backupId), [backupId]);

  // Keep a backup of unsaved work, shortly after each change.
  useEffect(() => {
    if (backup) return; // don't overwrite a backup the coach hasn't answered yet
    const timer = window.setTimeout(() => {
      try {
        if (dirty) localStorage.setItem(backupKey(backupId), JSON.stringify({ draft, at: Date.now() } satisfies Backup));
        else localStorage.removeItem(backupKey(backupId));
      } catch {
        // Private mode or storage full: the draft still lives in the page.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, backupId, backup]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const markSaved = useCallback(
    (savedDraft: DraftWorkout) => {
      setSaved(JSON.stringify(savedDraft));
      try {
        localStorage.removeItem(backupKey(backupId));
        localStorage.removeItem(backupKey(savedDraft.id));
      } catch {}
    },
    [backupId],
  );

  const restoreBackup = useCallback(() => {
    if (backup) dispatch({ type: "replace", draft: backup.draft });
    setAnswered(true);
  }, [backup]);

  const discardBackup = useCallback(() => {
    try {
      localStorage.removeItem(backupKey(backupId));
    } catch {}
    setAnswered(true);
  }, [backupId]);

  return { draft, dispatch, dirty, markSaved, backup, restoreBackup, discardBackup };
}
