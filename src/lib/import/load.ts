import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Library } from "@/lib/workout/library";
import { loadLibrary } from "@/lib/workout/load-library";

import { extractDays } from "./days";
import type { ImportDocument, SourceKind } from "./document";
import type { Layout } from "./layout";
import { DEFAULT_CHOICES, type ImportChoices } from "./plan";
import { type ImportAnswers, type ImportReading, NO_ANSWERS, readImport } from "./review";
import { answersSchema, choicesSchema, documentSchema, layoutSchema } from "./schema";

export type ImportStatus = "draft" | "committed" | "undone";

export interface StoredImport {
  id: string;
  trackId: string;
  status: ImportStatus;
  sourceName: string;
  sourceKind: SourceKind;
  document: ImportDocument;
  layout: Layout | null;
  programIndex: number;
  answers: ImportAnswers;
  choices: ImportChoices;
  summary: Record<string, unknown> | null;
  createdAt: string;
  committedAt: string | null;
  undoneAt: string | null;
}

/** An import of the gym, its stored parts checked (anything unreadable is treated as not given). */
export async function loadImport(orgId: string, batchId: string): Promise<StoredImport | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("import_batches").select("*").eq("org_id", orgId).eq("id", batchId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const document = documentSchema.safeParse(data.document);
  if (!document.success) return null;
  const layout = layoutSchema.safeParse(data.layout);
  const answers = answersSchema.safeParse({ ...NO_ANSWERS, ...(data.answers as object) });
  const choices = choicesSchema.safeParse({ ...DEFAULT_CHOICES, ...(data.choices as object) });
  return {
    id: data.id,
    trackId: data.track_id,
    status: data.status,
    sourceName: data.source_name,
    sourceKind: data.source_kind as SourceKind,
    document: document.data,
    layout: layout.success ? layout.data : null,
    programIndex: data.program_index,
    answers: answers.success ? answers.data : NO_ANSWERS,
    choices: choices.success ? choices.data : DEFAULT_CHOICES,
    summary: (data.summary as Record<string, unknown> | null) ?? null,
    createdAt: data.created_at,
    committedAt: data.committed_at,
    undoneAt: data.undone_at,
  };
}

/** The gym's imports, newest first, without their documents. */
export async function loadImports(orgId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_batches")
    .select("id, source_name, source_kind, track_id, status, created_at, committed_at, undone_at, summary")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data;
}

export interface ImportContext {
  library: Library;
  /** The gym's active day focuses, by name. */
  focusNames: string[];
  /** The program's scheduled workouts (for days the import would meet). */
  existing: { id: string; date: string; title: string | null }[];
}

export async function loadImportContext(orgId: string, trackId: string): Promise<ImportContext> {
  const supabase = await createClient();
  const [library, focuses, existing] = await Promise.all([
    loadLibrary(orgId),
    supabase.from("day_focuses").select("name").eq("org_id", orgId).is("archived_at", null).order("position"),
    supabase.from("workouts").select("id, date, title").eq("org_id", orgId).eq("track_id", trackId).eq("kind", "scheduled").is("deleted_at", null).order("date"),
  ]);
  if (focuses.error) throw focuses.error;
  if (existing.error) throw existing.error;
  return {
    library,
    focusNames: focuses.data.map((f) => f.name),
    existing: existing.data.flatMap((w) => (w.date ? [{ id: w.id, date: w.date, title: w.title }] : [])),
  };
}

/** The stored import read again, as the workspace reads it. */
export function readStored(stored: StoredImport, library: Library, country: string | null): ImportReading | null {
  if (!stored.layout) return null;
  const days = extractDays(stored.document, stored.layout, stored.programIndex);
  return readImport(days, library, stored.answers, { country, firstProgram: stored.programIndex === 0 });
}
