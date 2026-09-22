-- =============================================================================
-- Xendit payment recovery (docs/xendit-payment-recovery-plan.md), step A of F:
-- `orders.payment_method` -- a durable, persisted fact about whether an order
-- wanted COD or online (Xendit) payment, replacing the current inference
-- from "does a payments row exist for this order". That inference silently
-- misclassifies an order whose eager Xendit reservation (placeOrderAction)
-- failed: the order is created with payment_status='pending' but zero
-- payments rows, so `buyer_order_lifecycle` falls through to 'to_ship'
-- instead of 'to_pay' -- no Pay Now button, no Cancel button, stock never
-- released. Confirmed live on ORD-20260914-000132 (checkout_group_id set,
-- payment_status='pending', zero payments rows).
--
-- This migration only adds and backfills the column; `create_order`/
-- `create_order_group` start writing it in the next migration, and
-- `buyer_order_lifecycle` switches its "to_pay" predicate to read it in the
-- migration after that.
--
-- Backfill signal: a non-null `checkout_group_id` or an existing xendit
-- payments row both imply this order wanted online payment (a COD order
-- never gets a checkout_group_id or a payments row). Every other order is COD.
--
-- ROLLBACK:
--   begin;
--   alter table public.orders drop column payment_method;
--   drop type public.order_payment_method;
--   commit;
-- =============================================================================

begin;

create type public.order_payment_method as enum ('cod', 'xendit');

alter table public.orders
  add column payment_method public.order_payment_method;

update public.orders
set payment_method = (case
  when checkout_group_id is not null
    or exists (
      select 1 from public.payments p
      where p.order_id = orders.id and p.payment_method_type = 'xendit'
    )
    then 'xendit'
  else 'cod'
end)::public.order_payment_method
where payment_method is null;

alter table public.orders
  alter column payment_method set default 'cod',
  alter column payment_method set not null;

commit;
