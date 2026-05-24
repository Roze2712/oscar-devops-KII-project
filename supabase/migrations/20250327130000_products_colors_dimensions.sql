-- Optional color swatches (JSON array of { "hex": "#RRGGBB", "label"?: "..." }) and size text.
alter table public.products
  add column if not exists colors jsonb;

alter table public.products
  add column if not exists dimensions text;
