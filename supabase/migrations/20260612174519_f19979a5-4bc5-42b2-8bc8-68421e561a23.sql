
-- Fix privilege escalation: prevent users from changing their role or household_id
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  AND household_id = (SELECT household_id FROM public.profiles WHERE id = auth.uid())
);

-- Add explicit owner-only DELETE policy on households (INSERT remains denied; created via SECURITY DEFINER trigger)
CREATE POLICY "Owner deletes own household" ON public.households
FOR DELETE TO authenticated
USING (owner_id = auth.uid());

-- Revoke EXECUTE on SECURITY DEFINER helper functions from anon/public; keep authenticated where needed
REVOKE EXECUTE ON FUNCTION public.current_household_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_household_owner() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.current_household_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_owner() TO authenticated;
