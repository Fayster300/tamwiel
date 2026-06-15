CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND NEW.id = auth.uid() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Cannot change your own role.';
    END IF;
    IF NEW.household_id IS DISTINCT FROM OLD.household_id THEN
      RAISE EXCEPTION 'Cannot change your own household.';
    END IF;
    IF NEW.account_type IS DISTINCT FROM OLD.account_type THEN
      RAISE EXCEPTION 'Cannot change your own account type.';
    END IF;
    IF NEW.link_code IS DISTINCT FROM OLD.link_code THEN
      RAISE EXCEPTION 'Cannot change your link code.';
    END IF;
    IF NEW.account_balance IS DISTINCT FROM OLD.account_balance THEN
      RAISE EXCEPTION 'Cannot change your own account balance directly.';
    END IF;
    IF NEW.member_role IS DISTINCT FROM OLD.member_role THEN
      RAISE EXCEPTION 'Cannot change your member role directly.';
    END IF;
    IF OLD.onboarded = true AND NEW.onboarded IS DISTINCT FROM OLD.onboarded THEN
      RAISE EXCEPTION 'Cannot reset onboarded flag.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS prevent_self_role_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_self_role_escalation_trg
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();

DROP POLICY IF EXISTS "Owner or household owner update expense" ON public.expenses;
CREATE POLICY "Owner or household owner update expense"
ON public.expenses FOR UPDATE TO authenticated
USING (
  household_id = public.current_household_id()
  AND (profile_id = auth.uid() OR public.is_household_owner())
)
WITH CHECK (
  household_id = public.current_household_id()
  AND (profile_id = auth.uid() OR public.is_household_owner())
);

DROP POLICY IF EXISTS "Members manage own goals" ON public.goals;
CREATE POLICY "Members manage own goals"
ON public.goals FOR ALL TO authenticated
USING (
  profile_id = auth.uid()
  AND household_id = public.current_household_id()
)
WITH CHECK (
  profile_id = auth.uid()
  AND household_id = public.current_household_id()
);

DROP POLICY IF EXISTS "Household owner can delete rewards" ON public.rewards;
CREATE POLICY "Household owner can delete rewards"
ON public.rewards FOR DELETE TO authenticated
USING (
  household_id = public.current_household_id()
  AND public.is_household_owner()
);

DROP POLICY IF EXISTS "Household owner can update rewards" ON public.rewards;
CREATE POLICY "Household owner can update rewards"
ON public.rewards FOR UPDATE TO authenticated
USING (
  household_id = public.current_household_id()
  AND public.is_household_owner()
)
WITH CHECK (
  household_id = public.current_household_id()
  AND public.is_household_owner()
);

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_escalation() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.current_household_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_household_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_household_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_household_owner() TO authenticated;