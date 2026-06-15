
-- ============ Households ============
CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL,
  invite_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT ALL ON public.households TO service_role;
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- ============ Profiles ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  username text NOT NULL UNIQUE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ Helper (avoid RLS recursion) ============
CREATE OR REPLACE FUNCTION public.current_household_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid()
$$;

-- ============ Policies: profiles ============
CREATE POLICY "Users read own + household profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR household_id = public.current_household_id());

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============ Policies: households ============
CREATE POLICY "Members read their household"
  ON public.households FOR SELECT
  TO authenticated
  USING (id = public.current_household_id());

CREATE POLICY "Owner updates household"
  ON public.households FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- ============ Signup trigger ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_household_id uuid;
  v_action text := COALESCE(NEW.raw_user_meta_data->>'household_action', 'create');
  v_invite_code text;
  v_full_name text := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_username text := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  v_role text;
  v_new_code text;
BEGIN
  IF v_action = 'join' THEN
    v_invite_code := UPPER(COALESCE(NEW.raw_user_meta_data->>'invite_code', ''));
    SELECT id INTO v_household_id FROM public.households WHERE invite_code = v_invite_code;
    IF v_household_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_INVITE_CODE: % is not a valid household code', v_invite_code;
    END IF;
    v_role := 'member';
  ELSE
    v_new_code := UPPER(SUBSTRING(MD5(random()::text || clock_timestamp()::text), 1, 8));
    INSERT INTO public.households(name, owner_id, invite_code)
    VALUES (
      COALESCE(NEW.raw_user_meta_data->>'household_name', NULLIF(v_full_name,'') || '''s household', 'My household'),
      NEW.id,
      v_new_code
    )
    RETURNING id INTO v_household_id;
    v_role := 'owner';
  END IF;

  INSERT INTO public.profiles(id, full_name, username, household_id, role)
  VALUES (NEW.id, v_full_name, v_username, v_household_id, v_role);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
