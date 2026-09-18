-- =============================================================================
-- Fix: the prior migration's `drop function create_order(...)` followed by
-- `create or replace function create_order(...)` (new signature) reset the
-- function's ACL to Postgres's default (PUBLIC execute), losing the explicit
-- revoke-from-anon/public that 20260804113819_revoke_create_order_anon_execute.sql
-- established. Restoring the correct grant state: authenticated only.
-- =============================================================================
begin;

revoke all on function public.create_order(uuid, jsonb, jsonb, integer, text, uuid) from public, anon;
grant execute on function public.create_order(uuid, jsonb, jsonb, integer, text, uuid) to authenticated;

commit;
