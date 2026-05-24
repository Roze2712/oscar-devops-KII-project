-- Fix 403/permission denied for update/delete from authenticated admin UI.
-- Apply with Supabase SQL editor or `supabase db push`.

-- Ensure table privileges exist for roles used by Supabase client.
grant usage on schema public to anon, authenticated;
grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

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

drop policy if exists "Authenticated users can update products" on public.products;
create policy "Authenticated users can update products"
  on public.products
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated users can delete products" on public.products;
create policy "Authenticated users can delete products"
  on public.products
  for delete
  to authenticated
  using (true);

