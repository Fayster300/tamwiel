import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { addExpense } from "@/lib/household.functions";
import { useProfile, useHouseholdExpenses, useHouseholdMembers, useRewards, useHouseholdSavings } from "@/lib/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_COLORS, CATEGORY_ICONS, type Category } from "@/lib/finance-data";
import { ArrowUpDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ReceiptScanner } from "@/components/receipt-scanner";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses · Tamwil · Family Finance" }] }),
  component: ExpensesPage,
});

const CATS: Category[] = ["Food", "Rent", "Utilities", "Transport", "Entertainment", "Education", "Shopping", "Health"];

function ExpensesPage() {
  const { data: profile } = useProfile();
  const householdId = profile?.household_id;
  const { data: expenses = [] } = useHouseholdExpenses(householdId);
  const { data: members = [] } = useHouseholdMembers(householdId);
  const { data: rewards = [] } = useRewards(householdId);
  const { data: savings = [] } = useHouseholdSavings(householdId);
  const qc = useQueryClient();
  const addExp = useServerFn(addExpense);

  const [filter, setFilter] = useState<"all" | Category>("all");
  const [sort, setSort] = useState<"date" | "amount">("date");
  const [m, setM] = useState({ merchant: "", amount: "", category: "Food" as Category });
  const [busy, setBusy] = useState(false);

  const memberMap = useMemo(() => Object.fromEntries(members.map((mm) => [mm.id, mm])), [members]);

  const myBalance = useMemo(() => {
    if (!profile) return 0;
    const credits = rewards.filter((r) => r.to_profile_id === profile.id).reduce((a, r) => a + Number(r.amount), 0);
    const spent = expenses.filter((e) => e.profile_id === profile.id).reduce((a, e) => a + Number(e.amount), 0);
    const saved = savings.filter((s) => s.profile_id === profile.id).reduce((a, s) => a + Number(s.amount), 0);
    return Number(profile.account_balance ?? 0) + credits - spent - saved;
  }, [profile, rewards, expenses, savings]);

  const filtered = useMemo(() => {
    let out = filter === "all" ? expenses : expenses.filter((e) => e.category === filter);
    if (sort === "date") out = [...out].sort((a, b) => b.expense_date.localeCompare(a.expense_date));
    else out = [...out].sort((a, b) => Number(b.amount) - Number(a.amount));
    return out.slice(0, 60);
  }, [expenses, filter, sort]);

  async function manualAdd() {
    const amt = parseFloat(m.amount);
    if (!m.merchant.trim() || isNaN(amt) || amt <= 0) return toast.error("Enter merchant and positive amount.");
    setBusy(true);
    try {
      await addExp({ data: { merchant: m.merchant.trim(), amount: amt, category: m.category } });
      toast.success("Expense added");
      setM({ merchant: "", amount: "", category: "Food" });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add expense.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["expenses"] });
  }

  const totals = useMemo(() => {
    const t = filtered.reduce((a, b) => a + Number(b.amount), 0);
    return { count: filtered.length, sum: t };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Expense Log</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-1">Household <span className="text-gradient">spending</span></h1>
          <p className="text-sm text-muted-foreground mt-1">Live total visible to every member of the household.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ReceiptScanner />
          <div className="glass rounded-2xl px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your balance</div>
            <div className={`text-2xl font-bold ${myBalance < 0 ? "text-destructive" : "text-gradient"}`}>AED {myBalance.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Add */}
      <div className="glass rounded-3xl p-5 grid sm:grid-cols-[1fr_140px_160px_auto] gap-3 items-end">
        <label className="text-xs">
          <div className="text-muted-foreground mb-1">Merchant</div>
          <input value={m.merchant} onChange={(e) => setM({ ...m, merchant: e.target.value })} placeholder="e.g. Whole Foods" className="w-full bg-white/5 rounded-lg px-3 py-2 outline-none text-sm border border-white/10 focus:border-primary/50" />
        </label>
        <label className="text-xs">
          <div className="text-muted-foreground mb-1">Amount (AED)</div>
          <input value={m.amount} onChange={(e) => setM({ ...m, amount: e.target.value })} placeholder="0.00" inputMode="decimal" className="w-full bg-white/5 rounded-lg px-3 py-2 outline-none text-sm border border-white/10 focus:border-primary/50" />
        </label>
        <label className="text-xs">
          <div className="text-muted-foreground mb-1">Category</div>
          <select value={m.category} onChange={(e) => setM({ ...m, category: e.target.value as Category })} className="w-full bg-white/5 rounded-lg px-2 py-2 outline-none text-sm border border-white/10">
            {CATS.map((c) => <option key={c} value={c} className="bg-background">{c}</option>)}
          </select>
        </label>
        <button disabled={busy} onClick={manualAdd} className="px-4 py-2 rounded-lg bg-neon text-primary-foreground text-sm font-semibold shadow-glow hover:scale-105 transition disabled:opacity-50">
          {busy ? "Adding…" : "Add expense"}
        </button>
      </div>

      <div className="glass rounded-3xl p-6">
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Snap label="Transactions" value={String(totals.count)} />
          <Snap label="Filtered total" value={`AED ${totals.sum.toFixed(2)}`} accent />
          <Snap label="Largest" value={`AED ${filtered.length ? Math.max(...filtered.map((f) => Number(f.amount))).toFixed(2) : "0.00"}`} />
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-4">
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>All</FilterPill>
          {CATS.map((c) => (
            <FilterPill key={c} active={filter === c} onClick={() => setFilter(c)} color={CATEGORY_COLORS[c]}>
              {CATEGORY_ICONS[c]} {c}
            </FilterPill>
          ))}
          <button onClick={() => setSort(sort === "date" ? "amount" : "date")} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium">
            <ArrowUpDown className="size-3.5" /> Sort by {sort === "date" ? "Date" : "Amount"}
          </button>
        </div>

        <div className="divide-y divide-white/5">
          {filtered.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">No transactions yet. Add one above.</div>
          )}
          {filtered.map((e) => {
            const who = memberMap[e.profile_id];
            const canDelete = profile?.role === "owner" || e.profile_id === profile?.id;
            const cat = (e.category as Category) in CATEGORY_COLORS ? (e.category as Category) : "Shopping";
            return (
              <div key={e.id} className="flex items-center gap-3 py-3 hover:bg-white/[0.03] -mx-2 px-2 rounded-xl transition">
                <div className="size-11 rounded-xl flex items-center justify-center text-lg shrink-0" style={{ background: `${CATEGORY_COLORS[cat]}22`, border: `1px solid ${CATEGORY_COLORS[cat]}55` }}>
                  {CATEGORY_ICONS[cat]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.merchant}</div>
                  <div className="text-[11px] text-muted-foreground">{e.expense_date} · {who?.full_name || who?.username || "Member"}</div>
                </div>
                <span className="hidden sm:inline text-[10px] uppercase tracking-widest px-2 py-1 rounded-full" style={{ background: `${CATEGORY_COLORS[cat]}22`, color: CATEGORY_COLORS[cat] }}>
                  {e.category}
                </span>
                <div className="font-semibold w-24 text-right">−AED {Number(e.amount).toFixed(2)}</div>
                {canDelete && (
                  <button onClick={() => remove(e.id)} className="size-8 rounded-lg hover:bg-destructive/15 text-muted-foreground hover:text-destructive flex items-center justify-center">
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Snap({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 border ${accent ? "bg-neon/15 border-info/30" : "bg-white/[0.04] border-white/[0.05]"}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-bold mt-1 ${accent ? "text-gradient text-xl" : "text-base"}`}>{value}</div>
    </div>
  );
}

function FilterPill({ children, active, onClick, color }: { children: React.ReactNode; active: boolean; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${active ? "bg-neon text-primary-foreground border-transparent shadow-glow" : "bg-white/[0.04] border-white/10 hover:bg-white/10 text-muted-foreground"}`}
      style={active && color ? { background: color, color: "oklch(0.12 0.04 270)" } : undefined}
    >
      {children}
    </button>
  );
}
