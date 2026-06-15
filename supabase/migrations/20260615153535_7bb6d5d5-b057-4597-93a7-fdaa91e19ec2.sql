
-- 1. Lock down SECURITY DEFINER helpers
-- Trigger-only functions: revoke from everyone except postgres/service_role
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- RLS helpers: keep callable by authenticated only (used inside RLS USING clauses)
REVOKE EXECUTE ON FUNCTION public.current_household_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_household_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_household_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_owner() TO authenticated;

-- 2. Add missing INSERT policies so onboarding cannot be hijacked
-- Households: only the would-be owner can create their own household row
DROP POLICY IF EXISTS "Owner can create own household" ON public.households;
CREATE POLICY "Owner can create own household"
ON public.households
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Profiles: a user can create / delete only their own profile row
DROP POLICY IF EXISTS "User can create own profile" ON public.profiles;
CREATE POLICY "User can create own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "User can delete own profile" ON public.profiles;
CREATE POLICY "User can delete own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (id = auth.uid());
