-- Manual display order for products (admin drag-and-drop).
alter table public.products
  add column if not exists sort_order integer;

-- Preserve current admin list (newest id first).
with ranked as (
  select
    id,
    (row_number() over (order by id desc) - 1)::integer as rn
  from public.products
)
update public.products p
set sort_order = ranked.rn
from ranked
where p.id = ranked.id
  and p.sort_order is null;

create index if not exists products_sort_order_idx on public.products (sort_order);
