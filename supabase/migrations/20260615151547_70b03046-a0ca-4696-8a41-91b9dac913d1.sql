
-- Trigger to create profile + household on new signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: create profile + household for any auth user missing them
DO $$
DECLARE
  u auth.users%ROWTYPE;
  v_household_id uuid;
  v_full_name text;
  v_username text;
  v_invite text;
  v_link text;
BEGIN
  FOR u IN SELECT * FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles) LOOP
    v_full_name := COALESCE(u.raw_user_meta_data->>'full_name', '');
    v_username := COALESCE(u.raw_user_meta_data->>'username', split_part(u.email, '@', 1));
    v_invite := UPPER(SUBSTRING(MD5(random()::text || clock_timestamp()::text), 1, 8));
    v_link := UPPER(SUBSTRING(MD5(random()::text || u.id::text), 1, 8));

    INSERT INTO public.households(name, owner_id, invite_code)
    VALUES (
      COALESCE(u.raw_user_meta_data->>'household_name', NULLIF(v_full_name,'') || '''s household', 'My household'),
      u.id,
      v_invite
    )
    RETURNING id INTO v_household_id;

    INSERT INTO public.profiles(id, full_name, username, household_id, role, link_code)
    VALUES (u.id, v_full_name, v_username, v_household_id, 'owner', v_link);
  END LOOP;
END $$;
