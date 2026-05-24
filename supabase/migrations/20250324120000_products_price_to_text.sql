-- Store free-form price text (e.g. "По договор", ranges, "15 000 MKD").
-- Run via Supabase CLI or SQL Editor if `price` is still numeric.

alter table public.products
  alter column price type text using price::text;

alter table public.products
  alter column price drop not null;
