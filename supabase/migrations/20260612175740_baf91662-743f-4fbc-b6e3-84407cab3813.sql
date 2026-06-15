ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male','female')),
  ADD COLUMN IF NOT EXISTS member_role text,
  ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'owner' CHECK (account_type IN ('owner','member')),
  ADD COLUMN IF NOT EXISTS onboarded boolean NOT NULL DEFAULT false;