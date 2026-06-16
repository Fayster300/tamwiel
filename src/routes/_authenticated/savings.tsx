import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { addSaving } from "@/lib/household.functions";
import { useProfile, useHouseholdSavings, useHouseholdExpenses, useRewards, useHouseholdMembers } from "@/lib/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PiggyBank, Plus, Trash2 } from "lucide-react";
import { Dh, Money } from "@/components/dh";

export const Route = createFileRoute("/_authenticated/savings")({
  head: () => ({ meta: [{ title: "Savings · Tamwil · Family Finance" }] }),
  component: SavingsPage,
});

function SavingsPage() {
  const { data: profile } = useProfile();
  const householdId = profile?.household_id;
  const { data: savings = [] } = useHouseholdSavings(householdId);
  const { data: expenses = [] } = useHouseholdExpenses(householdId);
  const { data: rewards = [] } = useRewards(householdId);
  const { data: members = [] } = useHouseholdMembers(householdId);
  const qc = useQueryClient();
  const addSave = useServerFn(addSaving);

  const memberMap = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const balance = useMemo(() => {
    if (!profile) return 0;
    const starting = Number(profile.account_balance ?? 0);
    const credits = rewards.filter((r) => r.to_profile_id === profile.id).reduce((a, r) => a + Number(r.amount), 0);
    const spent = expenses.filter((e) => e.profile_id === profile.id).reduce((a, e) => a + Number(e.amount), 0);
    const saved = savings.filter((s) => s.profile_id === profile.id).reduce((a, s) => a + Number(s.amount), 0);
    return starting + credits - spent - saved;
  }, [profile, rewards, expenses, savings]);

  const mySaved = useMemo(
    () => (profile ? savings.filter((s) => s.profile_id === profile.id).reduce((a, s) => a + Number(s.amount), 0) : 0),
    [profile, savings],
  );

  const householdSaved = useMemo(
    () => savings.reduce((a, s) => a + Number(s.amount), 0),
    [savings],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = parseFloat(amount);
    if (isNaN(a) || a <= 0) return toast.error("Enter a positive amount.");
    setBusy(true);
    try {
      await addSave({ data: { amount: a, note: note.trim() || undefined } });
      toast.success(`Saved Dh ${a.toFixed(2)}`);
      setAmount("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["savings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("savings").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["savings"] });
  }

  const mine = profile ? savings.filter((s) => s.profile_id === profile.id) : [];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Savings</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1">My <span className="text-gradient">savings</span></h1>
        <p className="text-sm text-muted-foreground mt-1">Set aside part of your balance toward your goals.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Stat label="My total saved" value={<Money amount={mySaved} />} accent />
        <Stat label="Available balance" value={<Money amount={balance} />} />
        <Stat label="Household saved" value={<Money amount={householdSaved} />} />
      </div>

      <form onSubmit={submit} className="glass rounded-3xl p-6 grid sm:grid-cols-[160px_1fr_auto] gap-3 items-end">
        <label className="text-xs">
          <div className="text-muted-foreground mb-1 inline-flex items-baseline gap-1">Amount (<Dh />)</div>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/50" />
        </label>
        <label className="text-xs">
          <div className="text-muted-foreground mb-1">Note (optional)</div>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Toward my Switch goal" maxLength={200} className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/50" />
        </label>
        <button disabled={busy} className="px-5 py-2.5 rounded-lg bg-neon text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition disabled:opacity-50 flex items-center gap-1.5">
          <Plus className="size-4" /> {busy ? "Saving…" : "Save"}
        </button>
      </form>

      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <PiggyBank className="size-5 text-info" />
          <h3 className="font-semibold text-lg">My savings history</h3>
        </div>
        {mine.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven't saved anything yet. Add your first deposit above.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {mine.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-3">
                <div className="size-10 rounded-xl bg-info/15 text-info flex items-center justify-center">
                  <PiggyBank className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{s.note || "Savings deposit"}</div>
                  <div className="text-[11px] text-muted-foreground">{new Date(s.created_at).toLocaleString()}</div>
                </div>
                <div className="font-semibold text-gradient"><Money amount={Number(s.amount)} sign="+" /></div>
                <button onClick={() => remove(s.id)} className="size-8 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive flex items-center justify-center">
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {profile?.role === "owner" && savings.length > 0 && (
        <div className="glass rounded-3xl p-6">
          <h3 className="font-semibold text-lg mb-4">Household savings activity</h3>
          <div className="divide-y divide-white/5">
            {savings.slice(0, 20).map((s) => {
              const who = memberMap[s.profile_id];
              return (
                <div key={s.id} className="flex items-center gap-3 py-3">
                  <div className="size-9 rounded-xl bg-info/15 text-info flex items-center justify-center">
                    <PiggyBank className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{who?.full_name || who?.username || "Member"}</div>
                    <div className="text-[11px] text-muted-foreground">{s.note || "Savings"} · {new Date(s.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="font-semibold"><Money amount={Number(s.amount)} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-5 border ${accent ? "border-info/30" : "border-white/[0.05]"}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-bold mt-1 ${accent ? "text-gradient text-3xl" : "text-2xl"}`}>{value}</div>
    </div>
  );
}
