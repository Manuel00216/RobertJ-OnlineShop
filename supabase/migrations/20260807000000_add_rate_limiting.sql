-- =============================================================================
-- Rate limiting: a small Postgres-backed fixed-window counter, used to guard
-- select mutating Server Actions (profile update, order cancel, the
-- unauthenticated cart-availability check) against abuse.
--
-- Design notes:
--  * Fixed-window counter, keyed by an arbitrary caller-supplied string (e.g.
--    "updateProfile:{user_id}" or "cartAvailability:{ip}") plus the window
--    bucket it falls in. `ON CONFLICT ... DO UPDATE ... RETURNING` is an
--    atomic upsert — safe under concurrent simultaneous callers of the same
--    key (no lost-update race), matching the correctness bar of the existing
--    `create_order` RPC's `FOR UPDATE` locking, just via a different
--    mechanism suited to a counter instead of a row mutation.
--  * Known tradeoff, accepted deliberately: fixed windows allow up to ~2x the
--    stated limit for requests clustered at a window boundary. Acceptable for
--    the three low-sensitivity targets this guards; not used for anything
--    payment/auth-critical (Supabase Auth already rate-limits sign-in/up
--    itself, so a second app-level layer there would be redundant).
--  * Cleanup is probabilistic (not per-call), so the hot path doesn't pay a
--    DELETE on every single rate-limited request; still bounds table growth.
--  * `check_rate_limit` is `SECURITY DEFINER` so `anon`/`authenticated` never
--    need table-level INSERT/UPDATE on `rate_limit_hits` directly — all
--    direct table privileges are revoked below, mirroring the payments table's
--    revoke-then-selectively-grant pattern (Supabase's default privileges
--    otherwise grant ALL on new tables to anon/authenticated).
--  * Known, accepted gap: `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public, so
--    `check_rate_limit` is technically callable directly (bypassing the
--    Server Action) with an arbitrary key/limits. This can't inflate a
--    caller's own effective limit (limits are hardcoded server-side, never
--    client input) but could pollute the table with garbage keys — bounded by
--    the probabilistic 1-hour cleanup regardless. Not hardened further at
--    this project's scale.
--
-- ROLLBACK:
--   drop function public.check_rate_limit(text, int, int);
--   drop table public.rate_limit_hits;
-- =============================================================================

begin;

create table public.rate_limit_hits (
  key          text not null,
  window_start timestamptz not null,
  hit_count    integer not null default 1,
  primary key (key, window_start)
);

create index rate_limit_hits_window_start_idx
  on public.rate_limit_hits (window_start);

alter table public.rate_limit_hits enable row level security;
-- No policies: only the SECURITY DEFINER function below (owner context,
-- which bypasses RLS) ever touches this table.

create or replace function public.check_rate_limit(
  p_key text,
  p_max_hits int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer -- so callers never need table-level INSERT on rate_limit_hits directly
set search_path = ''
as $$
declare
  v_window_start timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count int;
begin
  insert into public.rate_limit_hits (key, window_start, hit_count)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start) do update
    set hit_count = rate_limit_hits.hit_count + 1
  returning hit_count into v_count;

  -- Probabilistic cleanup: ~1% of calls sweep all stale rows (not just this
  -- key's), so the hot path avoids paying a DELETE on every single request.
  if random() < 0.01 then
    delete from public.rate_limit_hits where window_start < now() - interval '1 hour';
  end if;

  return v_count <= p_max_hits;
end;
$$;

revoke all on public.rate_limit_hits from anon, authenticated;
grant execute on function public.check_rate_limit(text, int, int) to anon, authenticated;

commit;
