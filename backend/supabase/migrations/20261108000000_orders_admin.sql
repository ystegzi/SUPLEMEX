create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    order_number text not null unique default (
        'SM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
    ),
    account_user_id uuid references auth.users (id) on delete set null,
    customer_name text not null,
    customer_email text not null,
    customer_phone text not null,
    customer_city text not null,
    customer_address text not null default '',
    customer_notes text not null default '',
    status text not null default 'pending'
        check (status in ('pending', 'confirmed', 'shipped', 'cancelled')),
    total numeric(10, 2) not null check (total > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    confirmed_at timestamptz,
    confirmed_by uuid references auth.users (id) on delete set null
);

create table if not exists public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders (id) on delete cascade,
    product_name text not null,
    presentation text not null,
    flavor text not null default '',
    quantity integer not null check (quantity between 1 and 50),
    unit_price numeric(10, 2) not null check (unit_price > 0),
    line_total numeric(10, 2) not null check (line_total > 0)
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_created_at_idx on public.orders (status, created_at desc);
create index if not exists orders_account_user_id_idx on public.orders (account_user_id);

create or replace function public.update_order_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
before update on public.orders
for each row execute function public.update_order_updated_at();

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.orders from public, anon, authenticated;
revoke all on public.order_items from public, anon, authenticated;
grant all on public.orders to service_role;
grant all on public.order_items to service_role;

create or replace function public.create_order_with_items(
    p_user_id uuid,
    p_customer_name text,
    p_customer_email text,
    p_customer_phone text,
    p_customer_city text,
    p_customer_address text,
    p_customer_notes text,
    p_items jsonb,
    p_total numeric
)
returns table (id uuid, order_number text, total numeric, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
    new_order public.orders%rowtype;
begin
    if p_items is null
        or jsonb_typeof(p_items) is distinct from 'array'
        or jsonb_array_length(p_items) < 1 then
        raise exception 'El pedido debe contener al menos un producto.';
    end if;

    insert into public.orders (
        account_user_id,
        customer_name,
        customer_email,
        customer_phone,
        customer_city,
        customer_address,
        customer_notes,
        total
    ) values (
        p_user_id,
        p_customer_name,
        p_customer_email,
        p_customer_phone,
        p_customer_city,
        p_customer_address,
        p_customer_notes,
        p_total
    )
    returning * into new_order;

    insert into public.order_items (
        order_id,
        product_name,
        presentation,
        flavor,
        quantity,
        unit_price,
        line_total
    )
    select
        new_order.id,
        item.product_name,
        item.presentation,
        coalesce(item.flavor, ''),
        item.quantity,
        item.unit_price,
        item.line_total
    from jsonb_to_recordset(p_items) as item(
        product_name text,
        presentation text,
        flavor text,
        quantity integer,
        unit_price numeric,
        line_total numeric
    );

    return query
    select new_order.id, new_order.order_number, new_order.total, new_order.created_at;
end;
$$;

revoke all on function public.create_order_with_items(
    uuid, text, text, text, text, text, text, jsonb, numeric
) from public, anon, authenticated;
grant execute on function public.create_order_with_items(
    uuid, text, text, text, text, text, text, jsonb, numeric
) to service_role;
