-- RLS for products: public read, authenticated insert/delete (admin UI is gated in the app).
-- Run in Supabase → SQL Editor.

alter table public.products enable row level security;

drop policy if exists "Products are readable by anyone" on public.products;
create policy "Products are readable by anyone"
  on public.products
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Authenticated users can insert products" on public.products;
create policy "Authenticated users can insert products"
  on public.products
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can delete products" on public.products;
create policy "Authenticated users can delete products"
  on public.products
  for delete
  to authenticated
  using (true);
