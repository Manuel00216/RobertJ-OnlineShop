-- =============================================================================
-- Profile page additions: one-time username change, optional gender, and
-- optional date of birth. Purely additive — no existing column, index, RLS
-- policy, or business rule touched.
--
-- 1) ONE-TIME USERNAME CHANGE
-- `username_changed_at` starts null for every existing row (none of them
-- have used their one change yet, which is correct). Enforcement is a
-- BEFORE UPDATE trigger, not just an application check — same "encode the
-- invariant in the database" approach this table already uses for
-- `profiles_prevent_role_escalation`. `profiles_username_format` and the
-- existing `profiles_username_lower_key` case-insensitive uniqueness index
-- are untouched; this only adds the change-once rule on top of them.
--
-- 2) GENDER
-- New `public.gender_type` enum + nullable column, optional.
--
-- 3) DATE OF BIRTH
-- New nullable `date` column, optional. Deliberately no CHECK constraint for
-- the "not in the future" rule — that's enforced in `updateProfileSchema`
-- (Zod) instead, per the same reasoning `products.published_at` etc. don't
-- push time-relative validation into a CHECK.
--
-- PRIVACY (gender, date_of_birth): same treatment as `phone` (audit H1) —
-- no SELECT grant for authenticated/anon, so neither column is readable by
-- direct table SELECT from anyone, including the owner. `get_my_profile()`
-- (SECURITY DEFINER, already `select p.*`) remains the only read path, same
-- as phone today. The explicit REVOKE below is a documentation no-op (a
-- freshly added column has no grants until one is issued) but makes the
-- intent unmistakable to a future reader, same spirit as
-- 20260804000000_restore_profiles_column_grants.sql's own explicit REVOKEs.
--
-- ROLLBACK:
--   drop trigger if exists profiles_enforce_username_change_once on public.profiles;
--   drop function if exists public.enforce_username_change_once();
--   alter table public.profiles drop column if exists username_changed_at;
--   alter table public.profiles drop column if exists gender;
--   alter table public.profiles drop column if exists date_of_birth;
--   drop type if exists public.gender_type;
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) One-time username change
-- ---------------------------------------------------------------------------
alter table public.profiles add column username_changed_at timestamptz null;

create or replace function public.enforce_username_change_once()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.username is distinct from old.username then
    if old.username_changed_at is not null then
      raise exception 'Username can only be changed once.'
        using errcode = '23514';
    end if;
    new.username_changed_at = now();
  end if;
  return new;
end;
$$;

comment on function public.enforce_username_change_once is
  'BEFORE UPDATE trigger on profiles: allows exactly one username change per account, then permanently rejects further changes (stamps username_changed_at on the first one).';

create trigger profiles_enforce_username_change_once
  before update on public.profiles
  for each row execute function public.enforce_username_change_once();

-- ---------------------------------------------------------------------------
-- 2) Gender (optional)
-- ---------------------------------------------------------------------------
create type public.gender_type as enum ('male', 'female', 'other');

alter table public.profiles add column gender public.gender_type null;

-- ---------------------------------------------------------------------------
-- 3) Date of birth (optional) — no future-date CHECK; enforced in Zod.
-- ---------------------------------------------------------------------------
alter table public.profiles add column date_of_birth date null;

-- ---------------------------------------------------------------------------
-- Privacy — same as phone: writable by the owner, not directly selectable.
-- ---------------------------------------------------------------------------
revoke select (gender, date_of_birth) on public.profiles from authenticated, anon;
grant update (gender, date_of_birth) on public.profiles to authenticated;

commit;
