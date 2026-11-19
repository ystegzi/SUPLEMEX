-- Permite que cada cliente vea SOLO sus propios pedidos desde "Mi cuenta".
-- Solo lectura y solo las columnas necesarias: crear o cambiar pedidos sigue
-- pasando por las funciones del servidor (create-order y admin-api).

grant select (id, order_number, account_user_id, status, total, created_at)
    on public.orders to authenticated;

grant select (order_id, product_name, presentation, flavor, quantity, line_total)
    on public.order_items to authenticated;

drop policy if exists "Clientes ven sus pedidos" on public.orders;
create policy "Clientes ven sus pedidos"
    on public.orders
    for select
    to authenticated
    using (account_user_id = (select auth.uid()));

drop policy if exists "Clientes ven los productos de sus pedidos" on public.order_items;
create policy "Clientes ven los productos de sus pedidos"
    on public.order_items
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.orders o
            where o.id = order_items.order_id
              and o.account_user_id = (select auth.uid())
        )
    );
