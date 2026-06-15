
CREATE TABLE public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  merchant text not null,
  category text not null,
  amount numeric not null check (amount > 0),
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);
CREATE INDEX expenses_household_idx ON public.expenses(household_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household reads expenses" ON public.expenses FOR SELECT TO authenticated
  USING (household_id = public.current_household_id());
CREATE POLICY "Members insert own expense" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() AND household_id = public.current_household_id());
CREATE POLICY "Owner or self deletes expense" ON public.expenses FOR DELETE TO authenticated
  USING (household_id = public.current_household_id() AND (profile_id = auth.uid() OR public.is_household_owner()));

CREATE TABLE public.savings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null check (amount > 0),
  note text,
  created_at timestamptz not null default now()
);
CREATE INDEX savings_household_idx ON public.savings(household_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings TO authenticated;
GRANT ALL ON public.savings TO service_role;
ALTER TABLE public.savings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Household reads savings" ON public.savings FOR SELECT TO authenticated
  USING (household_id = public.current_household_id());
CREATE POLICY "Members insert own savings" ON public.savings FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid() AND household_id = public.current_household_id());
CREATE POLICY "Self deletes own savings" ON public.savings FOR DELETE TO authenticated
  USING (profile_id = auth.uid());
