-- Optional per-locale product copy; fall back to name / description in app when null.
alter table public.products
  add column if not exists name_en text;

alter table public.products
  add column if not exists name_mk text;

alter table public.products
  add column if not exists description_en text;

alter table public.products
  add column if not exists description_mk text;
