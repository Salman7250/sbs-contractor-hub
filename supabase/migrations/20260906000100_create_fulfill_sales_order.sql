create or replace function public.fulfill_sales_order(
  p_company_id uuid,
  p_order_id uuid,
  p_warehouse_id uuid,
  p_location_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order record;
  v_item record;
  v_product record;
  v_tracking_mode text;
  v_item_count integer := 0;
  v_inventory_line_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (
    select 1
    from public.company_members
    where company_id = p_company_id
      and user_id = auth.uid()
  ) then
    raise exception 'No company membership was found.';
  end if;

  if not exists (
    select 1
    from public.warehouses
    where id = p_warehouse_id
      and company_id = p_company_id
      and is_active = true
  ) then
    raise exception 'The selected warehouse is unavailable.';
  end if;

  if not exists (
    select 1
    from public.warehouse_locations
    where id = p_location_id
      and warehouse_id = p_warehouse_id
      and company_id = p_company_id
      and is_active = true
  ) then
    raise exception 'The selected location is unavailable.';
  end if;

  /*
   * Locking the order serializes concurrent fulfillment attempts for the
   * same order. Any error below aborts this function's transaction, including
   * stock movements already made by inventory_stock_out.
   */
  select id, order_number, status, fulfillment_status
  into v_order
  from public.orders
  where id = p_order_id
    and company_id = p_company_id
  for update;

  if not found then
    raise exception 'Sales order not found.';
  end if;

  if v_order.status::text in ('cancelled', 'refunded') then
    raise exception 'Cancelled or refunded orders cannot be fulfilled.';
  end if;

  if v_order.fulfillment_status::text = 'fulfilled' then
    raise exception 'This sales order has already been fulfilled.';
  end if;

  if exists (
    select 1
    from public.inventory_movements
    where company_id = p_company_id
      and movement_type = 'sale'
      and reference_type = 'sales_order'
      and reference_id = p_order_id::text
  ) then
    raise exception 'This order already has sale inventory movements and requires reconciliation.';
  end if;

  for v_item in
    select id, product_id, variant_id, product_name, quantity
    from public.order_items
    where order_id = p_order_id
      and company_id = p_company_id
    order by created_at asc
  loop
    v_item_count := v_item_count + 1;

    /* A non-catalog line does not have inventory to issue. */
    if v_item.product_id is null then
      continue;
    end if;

    select id, tracking_mode, track_inventory
    into v_product
    from public.products
    where id = v_item.product_id
      and company_id = p_company_id;

    if not found then
      raise exception 'Product % is no longer available in this company.', v_item.product_name;
    end if;

    v_tracking_mode := coalesce(
      v_product.tracking_mode::text,
      case when v_product.track_inventory then 'quantity' else 'none' end
    );

    if v_tracking_mode = 'none' then
      continue;
    end if;

    if v_tracking_mode in ('batch', 'serial') then
      raise exception 'Batch- and serial-tracked products require allocation before fulfillment.';
    end if;

    if v_item.variant_id is null then
      raise exception 'Inventory-tracked product % needs a variant.', v_item.product_name;
    end if;

    if v_item.quantity <= 0 or v_item.quantity <> trunc(v_item.quantity) then
      raise exception 'Inventory-tracked product % needs a positive whole-number quantity.', v_item.product_name;
    end if;

    if not exists (
      select 1
      from public.product_variants
      where id = v_item.variant_id
        and product_id = v_item.product_id
        and company_id = p_company_id
        and is_active = true
    ) then
      raise exception 'The selected variant for product % is unavailable.', v_item.product_name;
    end if;

    perform public.inventory_stock_out(
      p_company_id,
      v_item.product_id,
      v_item.variant_id,
      p_warehouse_id,
      p_location_id,
      v_item.quantity,
      'sale',
      'Sales order fulfillment',
      'sales_order',
      p_order_id::text,
      format('Fulfilled from sales order %s.', v_order.order_number)
    );

    v_inventory_line_count := v_inventory_line_count + 1;
  end loop;

  if v_item_count = 0 then
    raise exception 'A sales order needs at least one item to be fulfilled.';
  end if;

  update public.orders
  set fulfillment_status = 'fulfilled',
      updated_at = now()
  where id = p_order_id
    and company_id = p_company_id;

  return jsonb_build_object(
    'fulfilled_inventory_lines', v_inventory_line_count,
    'fulfilled_non_inventory_lines', v_item_count - v_inventory_line_count
  );
end;
$$;

revoke all on function public.fulfill_sales_order(uuid, uuid, uuid, uuid) from public;
grant execute on function public.fulfill_sales_order(uuid, uuid, uuid, uuid) to authenticated;
