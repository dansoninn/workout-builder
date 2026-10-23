"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { type ActionResult, gymForAction, NOT_ALLOWED, uuidSchema } from "@/lib/actions";
import { loadImport, loadImportContext, readStored } from "@/lib/import/load";
import { planImport } from "@/lib/import/plan";
import { answersSchema, choicesSchema, documentSchema, layoutSchema, MAX_DOCUMENT_CHARS } from "@/lib/import/schema";
import { can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";
import { toSavePayload } from "@/lib/workout/draft";
import { refreshStaleMetrics } from "@/lib/workout/metrics";

/*
 * Program import (BACKLOG "Program import", Daniel 2026-10-23): coaches
 * import (they program). Nothing touches the calendar until the commit; the
 * commit reads the stored import again on the server, so what is saved never
 * depends on what the browser sends.
 */

const startSchema = z.strictObject({
  trackId: z.uuid(),
  sourceName: z.string().trim().min(1).max(200),
  sourceKind: z.enum(["xlsx", "csv", "docx", "pdf", "text"]),
  document: documentSchema,
  layout: layoutSchema.nullable(),
  programIndex: z.number().int().min(0).max(49),
  keepPersonal: z.boolean(),
});

/** Starts an import into a program: its text (personal data already taken out unless kept) and the proposed layout. */
export async function startImport(slug: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  const gym = await gymForAction(slug, can.program);
  if (!gym) return { ok: false, error: NOT_ALLOWED };
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "The document could not be read. Try again, or paste its text." };
  const { document, layout, programIndex, trackId, sourceName, sourceKind, keepPersonal } = parsed.data;
  if (JSON.stringify(document).length > MAX_DOCUMENT_CHARS) return { ok: false, error: "This document is too large for one import. Import it in parts (a few months at a time)." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .insert({
      org_id: gym.id,
      track_id: trackId,
      source_name: sourceName,
      source_kind: sourceKind,
      document: document as unknown as Json,
      layout: layout as unknown as Json,
      program_index: programIndex,
      choices: { keepPersonal } as Json,
    })
    .select("id")
    .single();
  if (error?.code === "23503") return { ok: false, error: "That program no longer exists. Reload the page." };
  if (error) return { ok: false, error: "Could not start the import. Try again." };
  return { ok: true, id: data.id };
}

const saveSchema = z.strictObject({
  layout: layoutSchema.nullable(),
  programIndex: z.number().int().min(0).max(49),
  answers: answersSchema,
  choices: choicesSchema,
});

/** Keeps the coach's work on an import, to finish it later. */
export async function saveImport(slug: string, batchId: string, input: unknown): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.program);
  const parsed = saveSchema.safeParse(input);
  if (!gym || !uuidSchema.safeParse(batchId).success || !parsed.success) return { ok: false, error: NOT_ALLOWED };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .update({
      layout: parsed.data.layout as unknown as Json,
      program_index: parsed.data.programIndex,
      answers: parsed.data.answers as unknown as Json,
      choices: parsed.data.choices as unknown as Json,
    })
    .eq("id", batchId)
    .eq("org_id", gym.id)
    .eq("status", "draft")
    .select("id");
  if (error || data.length === 0) return { ok: false, error: "Could not keep your answers. Check your connection; your work is still on this page." };
  return { ok: true };
}

/** Throws away an import that was never made. */
export async function discardImport(slug: string, batchId: string): Promise<ActionResult> {
  const gym = await gymForAction(slug, can.program);
  if (!gym || !uuidSchema.safeParse(batchId).success) return { ok: false, error: NOT_ALLOWED };
  const supabase = await createClient();
  const { data, error } = await supabase.from("import_batches").delete().eq("id", batchId).eq("org_id", gym.id).eq("status", "draft").select("id");
  if (error || data.length === 0) return { ok: false, error: "Could not throw the import away. Reload the page." };
  refresh();
  return { ok: true };
}

/**
 * Makes the import: reads the stored document again with the stored answers,
 * plans it, and commits it in one transaction; then works out the numbers of
 * the new workouts.
 */
export async function commitImport(slug: string, batchId: string): Promise<ActionResult<{ workouts: number }>> {
  const gym = await gymForAction(slug, can.program);
  if (!gym || !uuidSchema.safeParse(batchId).success) return { ok: false, error: NOT_ALLOWED };
  const stored = await loadImport(gym.id, batchId);
  if (!stored) return { ok: false, error: "This import no longer exists. Reload the page." };
  if (stored.status !== "draft") return { ok: false, error: "This import is already done." };
  const context = await loadImportContext(gym.id, stored.trackId);
  const reading = readStored(stored, context.library, gym.country);
  if (!reading) return { ok: false, error: "Confirm how the document is laid out first." };
  const plan = planImport(reading, {
    trackId: stored.trackId,
    library: context.library,
    focusNames: context.focusNames,
    canManage: can.manageTracks(gym.role),
    existing: context.existing,
    choices: stored.choices,
    newId: () => crypto.randomUUID(),
  });
  if (plan.workouts.length === 0 && plan.templates.length === 0) return { ok: false, error: "There is nothing to import yet." };

  const payload = [...plan.workouts, ...plan.templates].map((w) => ({
    ...toSavePayload(w, context.library),
    publish: "publish" in w ? w.publish : false,
  }));
  const supabase = await createClient();
  const { error } = await supabase.rpc("commit_import", {
    p_org: gym.id,
    p_batch: batchId,
    p_workouts: payload as unknown as Json,
    p_replace: plan.replace,
    p_focuses: plan.newFocuses,
    p_days: plan.days as unknown as Json,
    p_closed: plan.closed as unknown as Json,
    p_aliases: plan.aliases.map((a) => ({ term: a.term, exercise_id: a.exerciseId })) as unknown as Json,
    p_summary: { ...plan.summary, source: stored.sourceName } as unknown as Json,
  });
  if (error?.code === "42501") return { ok: false, error: NOT_ALLOWED };
  if (error?.code === "22023") return { ok: false, error: error.message };
  if (error) return { ok: false, error: "Could not make the import. Nothing was changed; try again." };
  await refreshStaleMetrics(gym.id);
  refresh();
  return { ok: true, workouts: plan.workouts.length };
}

/** Undoes a whole import in one step. */
export async function undoImport(slug: string, batchId: string): Promise<ActionResult<{ removed: number; restored: number }>> {
  const gym = await gymForAction(slug, can.program);
  if (!gym || !uuidSchema.safeParse(batchId).success) return { ok: false, error: NOT_ALLOWED };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("undo_import", { p_org: gym.id, p_batch: batchId });
  if (error?.code === "22023") return { ok: false, error: error.message };
  if (error) return { ok: false, error: "Could not undo the import. Try again." };
  const result = data as { removed: number; restored: number };
  refresh();
  return { ok: true, removed: result.removed, restored: result.restored };
}
