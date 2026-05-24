-- Optional per-locale delivery / returns copy; app falls back to locale JSON when null.
alter table public.products
  add column if not exists delivery_en text;

alter table public.products
  add column if not exists delivery_mk text;
