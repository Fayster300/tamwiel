import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useProfile, useHouseholdMembers, useRewards, useHouseholdGoals, useHouseholdExpenses, useHouseholdSavings } from "@/lib/use-profile";
import { useServerFn } from "@tanstack/react-start";
import { addMemberByCode, sendReward, removeMember } from "@/lib/household.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import avatarMale from "@/assets/avatar-male.png";
import avatarFemale from "@/assets/avatar-female.png";
import { Trophy, Target, Sparkles, UserPlus, Crown, Gift, X, UserMinus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/family")({
  head: () => ({ meta: [{ title: "Family Hub · Tamwil · Family Finance" }] }),
  component: Family,
});

function Family() {
  const { data: profile } = useProfile();
  const householdId = profile?.household_id;
  const isOwner = profile?.role === "owner";
  const { data: members = [] } = useHouseholdMembers(householdId);
  const { data: rewards = [] } = useRewards(householdId);
  const { data: goals = [] } = useHouseholdGoals(householdId);
  const { data: expenses = [] } = useHouseholdExpenses(householdId);
  const { data: savings = [] } = useHouseholdSavings(householdId);
  const qc = useQueryClient();

  const addMember = useServerFn(addMemberByCode);
  const reward = useServerFn(sendReward);
  const removeFn = useServerFn(removeMember);

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [rewardTarget, setRewardTarget] = useState<{ id: string; name: string } | null>(null);

  // Balance per member = rewards received − expenses logged − savings deposited
  const balances = useMemo(() => {
    const b: Record<string, number> = {};
    for (const r of rewards) b[r.to_profile_id] = (b[r.to_profile_id] ?? 0) + Number(r.amount);
    for (const e of expenses) b[e.profile_id] = (b[e.profile_id] ?? 0) - Number(e.amount);
    for (const s of savings) b[s.profile_id] = (b[s.profile_id] ?? 0) - Number(s.amount);
    return b;
  }, [rewards, expenses, savings]);

  async function handleRemove(id: string, name: string) {
    if (!confirm(`Remove ${name} from your household?`)) return;
    try {
      await removeFn({ data: { profile_id: id } });
      toast.success(`${name} removed from household.`);
      qc.invalidateQueries({ queryKey: ["household-members"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove member.");
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true);
    try {
      const res = await addMember({ data: { link_code: code.trim().toUpperCase() } });
      toast.success("Member added", { description: res.name ? `${res.name} joined your household.` : undefined });
      setCode("");
      qc.invalidateQueries({ queryKey: ["household-members"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add member.");
    } finally {
      setBusy(false);
    }
  }

  const otherMembers = members.filter((m) => m.id !== profile?.id);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Household</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-1">Family <span className="text-gradient">hub</span></h1>
          <p className="text-sm text-muted-foreground mt-1">{profile?.household?.name ?? "Loading…"}</p>
        </div>
        {!isOwner && profile && (
          <div className="glass rounded-2xl px-4 py-3">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your balance</div>
            <div className="text-2xl font-bold text-gradient">AED {(balances[profile.id] ?? 0).toFixed(2)}</div>
          </div>
        )}
      </div>

      {isOwner && (
        <div className="glass rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <UserPlus className="size-5 text-info" />
            <h3 className="font-semibold text-lg">Add a family member</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Have them create their own account first. They'll see a unique <span className="font-mono">link code</span> on their profile. Enter it below.
          </p>
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD1234"
              maxLength={16}
              className="flex-1 bg-white/5 rounded-xl px-4 py-3 outline-none text-base font-mono tracking-widest border border-white/10 focus:border-primary/60 transition uppercase"
            />
            <button disabled={busy} className="px-5 py-3 rounded-xl bg-neon text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition disabled:opacity-50">
              {busy ? "Adding…" : "Add member"}
            </button>
          </form>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-3">Members ({members.length})</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {members.map((m) => {
            const isMe = m.id === profile?.id;
            const memberGoals = goals.filter((g) => g.profile_id === m.id);
            const totalSaved = memberGoals.reduce((a, g) => a + Number(g.saved), 0);
            const totalTarget = memberGoals.reduce((a, g) => a + Number(g.target), 0);
            return (
              <div key={m.id} className="glass glass-hover rounded-3xl p-6 relative overflow-hidden">
                <div className="absolute -top-16 -right-16 size-56 rounded-full bg-neon opacity-15 blur-3xl" />
                <div className="flex items-start justify-between relative">
                  <div className="flex items-center gap-3">
                    <div className="size-14 rounded-2xl bg-neon shadow-glow flex items-center justify-center overflow-hidden">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt="" className="size-full object-cover" />
                      ) : m.gender === "male" ? (
                        <img src={avatarMale} alt="" className="size-full object-cover bg-white" />
                      ) : m.gender === "female" ? (
                        <img src={avatarFemale} alt="" className="size-full object-cover bg-white" />
                      ) : (
                        <span className="text-xl font-bold text-primary-foreground">
                          {(m.full_name || m.username).split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold flex items-center gap-2">
                        {m.full_name || m.username}
                        {m.role === "owner" && <Crown className="size-4 text-warning" />}
                        {isMe && <span className="text-[10px] px-2 py-0.5 rounded-full bg-info/20 text-info">You</span>}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        @{m.username}{m.member_role ? ` · ${m.member_role}` : ""}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 relative">
                  <Stat label="Balance" value={`AED ${(balances[m.id] ?? 0).toFixed(2)}`} accent />
                  <Stat label="Saved" value={`AED ${totalSaved.toFixed(0)}`} />
                </div>

                {memberGoals.length > 0 && (
                  <div className="mt-4 relative">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1"><Target className="size-3" /> Goals</p>
                    <div className="space-y-2">
                      {memberGoals.slice(0, 3).map((g) => {
                        const pct = Math.min(100, (Number(g.saved) / Number(g.target)) * 100);
                        return (
                          <div key={g.id}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="truncate">{g.name}</span>
                              <span className="text-muted-foreground">AED {Number(g.saved).toFixed(0)} / {Number(g.target).toFixed(0)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full bg-neon shadow-glow" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {totalTarget === 0 && (
                  <p className="mt-4 text-xs text-muted-foreground relative">No savings goals yet.{isMe ? " Add one below." : ""}</p>
                )}

                {isOwner && !isMe && (
                  <div className="mt-5 relative flex gap-2">
                    <button onClick={() => setRewardTarget({ id: m.id, name: m.full_name || m.username })} className="flex-1 px-4 py-2.5 rounded-xl bg-neon text-primary-foreground font-medium hover:scale-[1.02] transition flex items-center justify-center gap-2 text-sm shadow-glow">
                      <Sparkles className="size-4" /> Send Reward
                    </button>
                    <button onClick={() => handleRemove(m.id, m.full_name || m.username)} title="Remove from household" className="px-3 py-2.5 rounded-xl bg-destructive/15 text-destructive hover:bg-destructive/25 transition flex items-center justify-center">
                      <UserMinus className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {otherMembers.length === 0 && isOwner && (
          <p className="text-sm text-muted-foreground mt-3">No other members yet — add someone using their link code above.</p>
        )}
      </div>


      {/* Recent rewards */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Gift className="size-5 text-warning" />
          <h3 className="font-semibold text-lg">Recent rewards</h3>
        </div>
        {rewards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rewards sent yet.</p>
        ) : (
          <div className="space-y-2">
            {rewards.slice(0, 10).map((r) => {
              const to = members.find((m) => m.id === r.to_profile_id);
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.04]">
                  <div className="size-9 rounded-lg bg-warning/20 text-warning flex items-center justify-center">
                    <Sparkles className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{to?.full_name || to?.username || "Member"}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{r.note || "Reward"} · {new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="font-bold text-gradient">+AED {Number(r.amount).toFixed(2)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Leaderboard */}
      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="size-5 text-warning" />
          <h3 className="font-semibold text-lg">Savings leaderboard</h3>
        </div>
        <div className="space-y-2">
          {[...members].sort((a, b) => (balances[b.id] ?? 0) - (balances[a.id] ?? 0)).map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.04]">
              <div className={`size-8 rounded-lg flex items-center justify-center font-bold text-sm ${i === 0 ? "bg-warning text-background" : "bg-white/10"}`}>
                {i + 1}
              </div>
              <div className="flex-1 font-medium">{m.full_name || m.username}</div>
              <div className="font-bold text-gradient">AED {(balances[m.id] ?? 0).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>

      {rewardTarget && profile && (
        <RewardModal
          targetName={rewardTarget.name}
          onClose={() => setRewardTarget(null)}
          onSend={async (amount, note) => {
            try {
              await reward({ data: { to_profile_id: rewardTarget.id, amount, note: note || undefined } });
              toast.success(`Sent AED ${amount.toFixed(2)} to ${rewardTarget.name}`);
              setRewardTarget(null);
              qc.invalidateQueries({ queryKey: ["rewards"] });
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not send reward.");
            }
          }}
        />
      )}
    </div>
  );
}


function RewardModal({ targetName, onClose, onSend }: { targetName: string; onClose: () => void; onSend: (amount: number, note: string) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = parseFloat(amount);
    if (isNaN(a) || a <= 0) return toast.error("Enter a positive amount.");
    setBusy(true);
    await onSend(a, note.trim());
    setBusy(false);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-background/80 backdrop-blur-xl">
      <div className="glass rounded-3xl p-6 w-full max-w-md relative">
        <button onClick={onClose} className="absolute top-3 right-3 size-8 rounded-lg hover:bg-white/10 flex items-center justify-center"><X className="size-4" /></button>
        <h3 className="font-semibold text-lg">Send reward to {targetName}</h3>
        <p className="text-xs text-muted-foreground mt-1">The amount will be added to their balance.</p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">Amount (AED)</div>
            <input autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="50.00" inputMode="decimal" className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60" />
          </label>
          <label className="block">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">Note (optional)</div>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Great job on saving!" maxLength={200} className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60" />
          </label>
          <button disabled={busy} className="w-full px-4 py-3 rounded-xl bg-neon text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition disabled:opacity-50">
            {busy ? "Sending…" : "Send reward"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 text-center border ${accent ? "bg-neon/15 border-info/30" : "bg-white/[0.04] border-white/[0.05]"}`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-bold mt-1 ${accent ? "text-gradient text-lg" : "text-sm"}`}>{value}</div>
    </div>
  );
}
