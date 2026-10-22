-- AMRAP partial rounds as coaches write them (calc spec decision 16,
-- approved 2026-10-22): "7 + 12" is stored as written next to the rounds it
-- came to (rounds_low/high, from the round's estimated time).

alter table public.block_results
  add column raw_text text check (raw_text = btrim(raw_text) and length(raw_text) between 1 and 60);

comment on column public.block_results.raw_text is 'The result as the coach wrote it, e.g. "7 + 12 – 9 + 3" (AMRAP rounds + reps).';
