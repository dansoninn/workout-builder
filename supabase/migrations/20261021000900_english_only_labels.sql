-- English only (decided by Daniel 2026-10-21, see CLAUDE.md conventions):
-- taxonomy labels are English. The Icelandic label columns are dropped; a
-- translation layer can be added later if ever needed. Keys are unchanged,
-- so this is not a taxonomy version change.

alter table public.movement_patterns drop column label_is;
alter table public.planes drop column label_is;
alter table public.modalities drop column label_is;
alter table public.muscles drop column label_is;
alter table public.effort_levels drop column label_is;
alter table public.equipment drop column label_is;
