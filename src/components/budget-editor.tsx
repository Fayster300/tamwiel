import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wallet, Pencil, Check, X, Target } from "lucide-react";
import { updateHouseholdBudget } from "@/lib/household.functions";
import { useProfile } from "@/lib/use-profile";

export function BudgetEditor() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const save = useServerFn(updateHouseholdBudget);
  const [editing, setEditing] = useState(false);
  const [budget, setBudget] = useState("");
  const [goal, setGoal] = useState("");
  const [goalName, setGoalName] = useState("");
  const [busy, setBusy] = useState(false);

  if (!profile || profile.role !== "owner") return null;
  const h = profile.household;
  const currentBudget = h?.monthly_budget ?? null;
  const currentGoal = h?.savings_goal ?? null;
  const currentGoalName = h?.savings_goal_name ?? "";

  function openEditor() {
    setBudget(currentBudget != null ? String(currentBudget) : "");
    setGoal(currentGoal != null ? String(currentGoal) : "");
    setGoalName(currentGoalName ?? "");
    setEditing(true);
  }

  async function submit() {
    const b = parseFloat(budget);
    const g = parseFloat(goal);
    if (budget && (isNaN(b) || b < 0)) return toast.error("Budget must be a positive number.");
    if (goal && (isNaN(g) || g < 0)) return toast.error("Goal must be a positive number.");
    setBusy(true);
    try {
      await save({
        data: {
          monthly_budget: budget === "" ? null : b,
          savings_goal: goal === "" ? null : g,
          savings_goal_name: goalName.trim() || null,
        },
      });
      toast.success("Budget updated");
      qc.invalidateQueries({ queryKey: ["profile"] });
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass glass-hover rounded-3xl p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Household plan</p>
          <h3 className="font-semibold text-lg mt-1">Monthly budget & goal</h3>
        </div>
        {!editing ? (
          <button onClick={openEditor} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-white/10">
            <Pencil className="size-3.5" /> Edit
          </button>
        ) : (
          <div className="flex gap-1.5">
            <button onClick={() => setEditing(false)} disabled={busy} className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 disabled:opacity-50">
              <X className="size-4" />
            </button>
            <button onClick={submit} disabled={busy} className="size-8 rounded-lg bg-neon text-primary-foreground flex items-center justify-center shadow-glow disabled:opacity-50">
              <Check className="size-4" />
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="grid grid-cols-2 gap-3">
          <Stat icon={<Wallet className="size-4 text-info" />} label="Monthly budget" value={currentBudget != null ? `AED ${Number(currentBudget).toFixed(0)}` : "Not set"} />
          <Stat icon={<Target className="size-4 text-success" />} label={currentGoalName || "Savings goal"} value={currentGoal != null ? `AED ${Number(currentGoal).toFixed(0)}` : "Not set"} />
        </div>
      ) : (
        <div className="space-y-3">
          <FieldRow label="Monthly budget (AED)">
            <input value={budget} onChange={(e) => setBudget(e.target.value)} inputMode="decimal" placeholder="8000" className="w-full bg-white/5 rounded-lg px-3 py-2 outline-none text-sm border border-white/10 focus:border-primary/60" />
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Goal name">
              <input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="Family vacation" className="w-full bg-white/5 rounded-lg px-3 py-2 outline-none text-sm border border-white/10 focus:border-primary/60" />
            </FieldRow>
            <FieldRow label="Goal target (AED)">
              <input value={goal} onChange={(e) => setGoal(e.target.value)} inputMode="decimal" placeholder="5000" className="w-full bg-white/5 rounded-lg px-3 py-2 outline-none text-sm border border-white/10 focus:border-primary/60" />
            </FieldRow>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] border border-white/[0.05] p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">{icon}{label}</div>
      <div className="text-lg font-bold mt-1">{value}</div>
    </div>
  );
}
function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}
