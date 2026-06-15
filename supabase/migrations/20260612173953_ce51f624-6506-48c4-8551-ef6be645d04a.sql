
-- 1. Add columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS link_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Add columns to households
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS savings_goal numeric,
  ADD COLUMN IF NOT EXISTS savings_goal_name text,
  ADD COLUMN IF NOT EXISTS monthly_budget numeric;

-- 3. Backfill link_code for existing profiles
UPDATE public.profiles
SET link_code = UPPER(SUBSTRING(MD5(random()::text || id::text), 1, 8))
WHERE link_code IS NULL;

ALTER TABLE public.profiles ALTER COLUMN link_code SET NOT NULL;

-- 4. Rewards table
CREATE TABLE public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  to_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.rewards TO authenticated;
GRANT ALL ON public.rewards TO service_role;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household members read rewards" ON public.rewards
  FOR SELECT TO authenticated USING (household_id = public.current_household_id());
CREATE POLICY "Owner inserts rewards" ON public.rewards
  FOR INSERT TO authenticated
  WITH CHECK (
    household_id = public.current_household_id()
    AND from_profile_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner')
  );

-- 5. Goals table
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  target numeric NOT NULL CHECK (target > 0),
  saved numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.goals TO authenticated;
GRANT ALL ON public.goals TO service_role;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household members read goals" ON public.goals
  FOR SELECT TO authenticated USING (household_id = public.current_household_id());
CREATE POLICY "Members manage own goals" ON public.goals
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid() AND household_id = public.current_household_id());

-- 6. Allow owners to update household budget fields
CREATE POLICY "Owner updates own household budget"
  ON public.households FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
-- (existing "Owner updates household" already covers this; safe if duplicate-name fails — drop if so)

-- 7. Update trigger: always create household + assign link_code; ignore household_action
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_household_id uuid;
  v_full_name text := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_username text := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  v_invite text := UPPER(SUBSTRING(MD5(random()::text || clock_timestamp()::text), 1, 8));
  v_link text := UPPER(SUBSTRING(MD5(random()::text || NEW.id::text), 1, 8));
BEGIN
  INSERT INTO public.households(name, owner_id, invite_code)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'household_name', NULLIF(v_full_name,'') || '''s household', 'My household'),
    NEW.id,
    v_invite
  )
  RETURNING id INTO v_household_id;

  INSERT INTO public.profiles(id, full_name, username, household_id, role, link_code)
  VALUES (NEW.id, v_full_name, v_username, v_household_id, 'owner', v_link);

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. updated_at trigger for goals
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Helper: is current user the household owner?
CREATE OR REPLACE FUNCTION public.is_household_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'); $$;
