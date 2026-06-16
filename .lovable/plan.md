# Implementation Plan

Six features in one batch. Below is what I'll ship and what each touches.

---

## 1. Bill Payment Scheduler + Due-Day Reminders

Replace the hard-coded bill list with user-managed scheduled payments.

- New table `scheduled_payments` (household_id, owner_id, name, amount, category, next_due_date, frequency, last_paid_at, last_reminded_at).
- Owner-only RLS (members can read household's, only owner can write).
- Automation page: "Add payment" form (name, amount, category, due date, frequency: one-off / monthly / weekly). List of upcoming payments with "Run automation" button per row.
- Reminders: on every page load, query payments due today (or overdue) that haven't been paid → bell badge count, toast + short "ting" via WebAudio oscillator (no asset needed, works offline). De-duped via `last_reminded_at` so it only dings once per day.
- Bell dropdown in header lists due payments with a quick "Pay now" button.

## 2. WebAuthn Biometric Gate for Auto-Pay (Owners)

Real device biometric via WebAuthn passkey — uses TouchID/FaceID/Windows Hello.

- New table `owner_passkeys` (user_id, credential_id, public_key, counter, transports). Service-role writes via server fn.
- Server fns `startPasskeyRegistration`, `finishPasskeyRegistration`, `startPasskeyAuth`, `finishPasskeyAuth` using `@simplewebauthn/server`. Browser uses `@simplewebauthn/browser`.
- On signup as owner → onboarding modal adds a "Secure auto-pay with Face ID / Touch ID" step (skippable, but pay flow re-prompts to enroll).
- "Run automation" / "Pay now" on any bill → triggers biometric assertion. Only on success does the payment proceed.
- Members are unaffected (already locked out of automation page).

## 3. Auto-Pay → Expenses

When a scheduled payment runs (after biometric success):
- Insert into `expenses` (category, merchant=payment name, amount, owner_id).
- Update payment's `last_paid_at` and roll `next_due_date` forward by frequency.
- Decrement owner's `account_balance` like a normal expense.
- Toast + invalidate expenses query.

## 4 & 5. Receipt Scanner — Upload + Camera, Multiple Files

Update `receipt-scanner.tsx`:
- File input: keep `capture="environment"` for mobile camera but add a second "Choose files" path without capture for desktop upload; on multi-select, accept up to 5 receipts at once (`multiple`).
- Loop and call `scanReceipt` per file, accumulating items grouped by merchant. Header shows progress "Scanning 2/3…".
- Existing review/save UI handles the combined list.

## 6. Financial Quests (Full Spec)

New left-nav tab. Tables, server fns, dashboards, AI suggestions, audit log.

### Schema
- `quests`: id, household_id, owner_id, assignee_id, title, description, reward, due_date, status (`pending_acceptance`|`declined`|`accepted`|`submitted`|`approved`|`rejected`), savings_split_pct, submitted_notes, rejection_reason, created_at, updated_at, decided_at, completed_at.
- `quest_proofs`: id, quest_id, image_url, uploaded_at.
- `quest_audit_log`: id, quest_id, actor_id, action, meta jsonb, created_at.
- Storage bucket `quest-proofs` (private; signed URLs).
- RLS:
  - Owner: full CRUD on household's quests.
  - Assignee: read own, update status transitions (`accept`/`decline`/`submit`), insert proofs.

### Server fns
`createQuest`, `acceptQuest(savings_split_pct)`, `declineQuest`, `submitQuest(notes, proof_image_urls[])`, `approveQuest` (deducts from owner balance, splits to assignee savings + balance, inserts an `expenses` row tagged `Quest payout`, writes audit + balance check), `rejectQuest(reason)`, `suggestQuests` (AI via Lovable Gateway, takes assignee age/role).

### UI
- `routes/_authenticated/quests.tsx` with role-based dashboards:
  - Owner: tabs for Active / Pending Review / Approved / Rejected, totals, "+ New Quest" dialog with AI suggestions side panel (chips clickable to fill form).
  - Member: My Quests with status cards, accept flow (savings % slider, mandatory), submit flow (photo uploads required + notes), totals (earned, saved).
- Gamified card styling consistent with current neon/glass theme; status badges, reward chip, progress.

### Notifications
Extend the new bell system from #1 to also surface quest events (assigned / accepted / declined / submitted / approved / rejected) by querying recent `quest_audit_log` rows where the viewer is owner or assignee.

### Funds check
`approveQuest` server fn fails with a clear error if `owner.account_balance < reward`; UI shows "Add funds" hint.

---

## Technical notes
- All tables: `GRANT` + `ENABLE RLS` + policies in same migration.
- Audit log writes done inside the server fn after the action succeeds.
- Passkey verification: `rpID` = current hostname (works on both `*.lovable.app` previews and published domain).
- "Ting" sound uses `AudioContext` oscillator — no external asset, ~50 LOC helper.
- Bell dropdown becomes a real component (replaces current "No notifications" toast).
- Existing automation cards (Smart bill payment, Family insights, etc.) stay; only the bill list becomes dynamic.

## Files to create
- `supabase/migrations/<ts>_quests_bills_passkeys.sql`
- `src/lib/scheduled-payments.functions.ts`
- `src/lib/passkeys.functions.ts`
- `src/lib/quests.functions.ts`
- `src/lib/notifications.ts` (due-bill + quest event aggregator)
- `src/lib/ting.ts` (WebAudio ding)
- `src/components/notification-bell.tsx`
- `src/components/passkey-prompt.tsx`
- `src/components/quest-card.tsx`, `src/components/quest-form.tsx`
- `src/routes/_authenticated/quests.tsx`

## Files to edit
- `src/components/app-shell.tsx` (bell dropdown, Quests nav link)
- `src/components/onboarding-modal.tsx` (passkey enrollment step for owners)
- `src/components/receipt-scanner.tsx` (multi-file + separate upload button)
- `src/routes/_authenticated/automation.tsx` (dynamic bills, passkey gate, auto-pay)
- `src/lib/use-profile.ts` (notifications hook)

## Dependencies to add
- `@simplewebauthn/server`, `@simplewebauthn/browser`

Approve to proceed and I'll execute it end-to-end.