-- Follow-up to 20261004155216_order_creation_idempotency:
--   1. That migration's DROP used the wrong type list for create_order
--      (p_shipping_address is jsonb, so the pre-idempotency signature is 7
--      types, not 6). The old create_order survived, creating an ambiguous
--      overload with the new 8-arg version. Drop the correct old signature.
--   2. Recreating the functions re-triggered Supabase's default privileges,
--      which grant EXECUTE to anon on new public functions. The order RPCs must
--      never be callable by anon (matches 20260804113819_revoke_create_order_
--      anon_execute). Revoke it.
--
-- Wrapped in begin/commit per this repo's migration convention. (The prior
-- migration's own revoke statements have since been updated to include `anon`
-- directly, so this file's revoke/grant pair is now redundant-but-harmless —
-- kept as-is rather than edited, since this is the migration that was
-- actually applied live to close the gap; see its header note.)

begin;

drop function if exists public.create_order(uuid, jsonb, jsonb, integer, text, uuid, text);

revoke all on function public.create_order(uuid, jsonb, jsonb, integer, text, uuid, text, uuid) from public, anon;
grant execute on function public.create_order(uuid, jsonb, jsonb, integer, text, uuid, text, uuid) to authenticated, service_role;

revoke all on function public.create_order_group(jsonb, jsonb, integer, text, text, uuid) from public, anon;
grant execute on function public.create_order_group(jsonb, jsonb, integer, text, text, uuid) to authenticated, service_role;

commit;
