-- ===================== Scheduled bill payments =====================
CREATE TABLE public.scheduled_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  category text NOT NULL DEFAULT 'Utilities',
  icon text DEFAULT 'bolt',
  next_due_date date NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('once','weekly','monthly')),
  last_paid_at timestamptz,
  last_reminded_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_payments TO authenticated;
GRANT ALL ON public.scheduled_payments TO service_role;
ALTER TABLE public.scheduled_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members view scheduled payments"
  ON public.scheduled_payments FOR SELECT TO authenticated
  USING (household_id = public.current_household_id());

CREATE POLICY "owner inserts scheduled payments"
  ON public.scheduled_payments FOR INSERT TO authenticated
  WITH CHECK (household_id = public.current_household_id() AND public.is_household_owner() AND owner_id = auth.uid());

CREATE POLICY "owner updates scheduled payments"
  ON public.scheduled_payments FOR UPDATE TO authenticated
  USING (household_id = public.current_household_id() AND public.is_household_owner())
  WITH CHECK (household_id = public.current_household_id() AND public.is_household_owner());

CREATE POLICY "owner deletes scheduled payments"
  ON public.scheduled_payments FOR DELETE TO authenticated
  USING (household_id = public.current_household_id() AND public.is_household_owner());

CREATE TRIGGER trg_scheduled_payments_updated
  BEFORE UPDATE ON public.scheduled_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===================== Passkeys (WebAuthn) =====================
CREATE TABLE public.owner_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text,
  device_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_passkeys TO authenticated;
GRANT ALL ON public.owner_passkeys TO service_role;
ALTER TABLE public.owner_passkeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own passkeys" ON public.owner_passkeys FOR SELECT TO authenticated USING (user_id = auth.uid());
-- writes go through service_role only

CREATE TABLE public.passkey_challenges (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('register','auth')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.passkey_challenges TO authenticated;
GRANT ALL ON public.passkey_challenges TO service_role;
ALTER TABLE public.passkey_challenges ENABLE ROW LEVEL SECURITY;
-- service-role only access; no anon/auth policies needed

-- ===================== Financial Quests =====================
CREATE TYPE public.quest_status AS ENUM (
  'pending_acceptance','declined','accepted','submitted','approved','rejected'
);

CREATE TABLE public.quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  reward numeric(12,2) NOT NULL CHECK (reward > 0),
  due_date date,
  status public.quest_status NOT NULL DEFAULT 'pending_acceptance',
  savings_split_pct integer CHECK (savings_split_pct IS NULL OR (savings_split_pct BETWEEN 0 AND 100)),
  submitted_notes text,
  rejection_reason text,
  decided_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quests TO authenticated;
GRANT ALL ON public.quests TO service_role;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members see quests"
  ON public.quests FOR SELECT TO authenticated
  USING (household_id = public.current_household_id());

CREATE POLICY "owner creates quests"
  ON public.quests FOR INSERT TO authenticated
  WITH CHECK (household_id = public.current_household_id() AND public.is_household_owner() AND owner_id = auth.uid());

CREATE POLICY "owner updates quests"
  ON public.quests FOR UPDATE TO authenticated
  USING (household_id = public.current_household_id() AND public.is_household_owner())
  WITH CHECK (household_id = public.current_household_id() AND public.is_household_owner());

CREATE POLICY "assignee updates own quest status"
  ON public.quests FOR UPDATE TO authenticated
  USING (assignee_id = auth.uid())
  WITH CHECK (assignee_id = auth.uid() AND household_id = public.current_household_id());

CREATE POLICY "owner deletes quests"
  ON public.quests FOR DELETE TO authenticated
  USING (household_id = public.current_household_id() AND public.is_household_owner());

CREATE TRIGGER trg_quests_updated
  BEFORE UPDATE ON public.quests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.quest_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id uuid NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.quest_proofs TO authenticated;
GRANT ALL ON public.quest_proofs TO service_role;
ALTER TABLE public.quest_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household sees quest proofs"
  ON public.quest_proofs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quests q WHERE q.id = quest_id AND q.household_id = public.current_household_id()));

CREATE POLICY "assignee uploads quest proofs"
  ON public.quest_proofs FOR INSERT TO authenticated
  WITH CHECK (uploader_id = auth.uid() AND EXISTS (SELECT 1 FROM public.quests q WHERE q.id = quest_id AND q.assignee_id = auth.uid()));

CREATE TABLE public.quest_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id uuid NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quest_audit_log TO authenticated;
GRANT ALL ON public.quest_audit_log TO service_role;
ALTER TABLE public.quest_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household sees quest audit"
  ON public.quest_audit_log FOR SELECT TO authenticated
  USING (household_id = public.current_household_id());
-- inserts handled via service_role from server functions only

CREATE INDEX idx_quests_household ON public.quests(household_id);
CREATE INDEX idx_quests_assignee ON public.quests(assignee_id);
CREATE INDEX idx_quest_audit_household ON public.quest_audit_log(household_id, created_at DESC);
CREATE INDEX idx_scheduled_payments_household ON public.scheduled_payments(household_id, next_due_date);