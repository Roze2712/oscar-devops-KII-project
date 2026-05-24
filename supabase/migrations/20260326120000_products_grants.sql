-- Explicit table privileges.
-- Note: Supabase RLS policies control row visibility, but Postgres still requires
-- GRANTed privileges on the table or you will get "permission denied for table ...".

-- Allow anyone (anon) and logged-in users (authenticated) to read products.
grant usage on schema public to anon, authenticated;
grant select on table public.products to anon, authenticated;

-- Allow logged-in users to add/remove products from the admin UI.
grant insert, delete on table public.products to authenticated;

