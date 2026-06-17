import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles, Plus, Trophy, Loader2, Camera, Check, X, Clock, Hourglass, ShieldCheck, ThumbsDown,
  Coins, ImagePlus, ChevronRight, ScanFace,
} from "lucide-react";
import {
  listQuests, createQuest, acceptQuest, declineQuest, submitQuest, approveQuest, rejectQuest,
  listQuestProofs, suggestQuests,
} from "@/lib/quests.functions";
import { useProfile, useHouseholdMembers } from "@/lib/use-profile";
import { Money, Dh } from "@/components/dh";
import { PasskeyGate } from "@/components/passkey-prompt";

export const Route = createFileRoute("/_authenticated/quests")({
  head: () => ({ meta: [{ title: "Financial Quests · Tamwil" }] }),
  component: QuestsPage,
});

type Quest = Awaited<ReturnType<typeof listQuests>>[number];

function QuestsPage() {
  const { data: profile } = useProfile();
  const listQ = useServerFn(listQuests);
  const quests = useQuery({ enabled: !!profile, queryKey: ["quests"], queryFn: () => listQ() });
  const isOwner = profile?.role === "owner";

  return (
    <div className="space-y-6">
      <Hero isOwner={!!isOwner} />
      {quests.isLoading ? (
        <div className="glass rounded-3xl p-10 text-center text-muted-foreground">Loading quests…</div>
      ) : isOwner ? (
        <OwnerView quests={quests.data ?? []} />
      ) : (
        <MemberView quests={(quests.data ?? []).filter((q) => q.assignee_id === profile?.id)} />
      )}
    </div>
  );
}

function Hero({ isOwner }: { isOwner: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 bg-gradient-to-br from-primary/25 via-accent/15 to-info/20 border border-white/10">
      <div className="absolute -top-16 -right-16 size-72 rounded-full bg-neon opacity-30 blur-3xl animate-pulse" />
      <div className="absolute -bottom-10 -left-10 size-56 rounded-full bg-accent/30 opacity-30 blur-3xl" />
      <div className="absolute top-4 right-6 text-4xl select-none animate-bounce" style={{ animationDuration: "2.8s" }}>🏆</div>
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest bg-white/10 border border-white/20 backdrop-blur">
          <Sparkles className="size-3" /> Financial Quests · Level up your money
        </div>
        <h1 className="text-3xl md:text-4xl font-bold mt-3">
          {isOwner ? "Turn chores into" : "Earn, save,"} <span className="text-gradient">money lessons</span> <span className="inline-block">✨</span>
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-2 max-w-2xl">
          {isOwner
            ? "Assign paid missions to family members. Reward great work, teach saving habits, and keep a full audit trail. 🎯"
            : "Accept missions, snap proof, get approved — and earn money the smart way with built-in savings. 🚀"}
        </p>
      </div>
    </div>
  );
}

// ============ OWNER VIEW ============
function OwnerView({ quests }: { quests: Quest[] }) {
  const [tab, setTab] = useState<"active" | "review" | "approved" | "rejected">("active");
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState<Quest | null>(null);

  const active = quests.filter((q) => q.status === "pending_acceptance" || q.status === "accepted");
  const review = quests.filter((q) => q.status === "submitted");
  const approved = quests.filter((q) => q.status === "approved");
  const rejected = quests.filter((q) => q.status === "rejected" || q.status === "declined");

  const totalPaid = approved.reduce((a, q) => a + Number(q.reward), 0);

  const lists: Record<typeof tab, Quest[]> = { active, review, approved, rejected };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Active" value={String(active.length)} />
        <KPI label="Pending review" value={String(review.length)} tone={review.length > 0 ? "warn" : undefined} />
        <KPI label="Completed" value={String(approved.length)} />
        <KPI label="Total paid out" value={<Money amount={totalPaid} decimals={0} />} />
      </div>

      <div className="glass rounded-3xl p-4 md:p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {(["active", "review", "approved", "rejected"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition ${
                  tab === t ? "bg-neon text-primary-foreground shadow-glow" : "bg-white/5 hover:bg-white/10 text-muted-foreground"
                }`}
              >
                {t === "review" ? "Pending review" : t} ({lists[t].length})
              </button>
            ))}
          </div>
          <button
            onClick={() => setCreating(true)}
            className="px-3 py-1.5 rounded-xl bg-aurora text-primary-foreground text-xs font-semibold shadow-glow inline-flex items-center gap-1.5"
          >
            <Plus className="size-3.5" /> New quest
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {lists[tab].length === 0 ? (
            <div className="md:col-span-2 text-center py-10 text-sm text-muted-foreground">No quests in this list.</div>
          ) : (
            lists[tab].map((q) => (
              <QuestCard key={q.id} quest={q} role="owner" onClick={() => (q.status === "submitted" ? setReviewing(q) : null)} />
            ))
          )}
        </div>
      </div>

      {creating && <CreateQuestModal onClose={() => setCreating(false)} />}
      {reviewing && <ReviewQuestModal quest={reviewing} onClose={() => setReviewing(null)} />}
    </>
  );
}

function CreateQuestModal({ onClose }: { onClose: () => void }) {
  const { data: profile } = useProfile();
  const members = useHouseholdMembers(profile?.household_id);
  const create = useServerFn(createQuest);
  const suggest = useServerFn(suggestQuests);
  const qc = useQueryClient();

  const memberOptions = (members.data ?? []).filter((m) => m.id !== profile?.id);
  const [assignee, setAssignee] = useState<string>(memberOptions[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  const assigneeMember = memberOptions.find((m) => m.id === assignee);

  const ideas = useQuery({
    enabled: !!assigneeMember,
    queryKey: ["quest-suggestions", assigneeMember?.member_role, assigneeMember?.full_name],
    queryFn: () => suggest({ data: { assignee_role: assigneeMember?.member_role ?? "Member", assignee_name: assigneeMember?.full_name ?? "" } }),
  });

  async function save() {
    const amt = parseFloat(reward);
    if (!assignee) return toast.error("Choose who to assign this to.");
    if (!title.trim()) return toast.error("Add a title.");
    if (isNaN(amt) || amt <= 0) return toast.error("Reward must be greater than 0.");
    setBusy(true);
    try {
      await create({ data: { title: title.trim(), description: description.trim() || undefined, reward: amt, due_date: dueDate || undefined, assignee_id: assignee } });
      toast.success("Quest assigned!");
      qc.invalidateQueries({ queryKey: ["quests"] });
      qc.invalidateQueries({ queryKey: ["quest-audit"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create quest");
    } finally {
      setBusy(false);
    }
  }

  function applySuggestion(s: { title: string; description: string; reward: number }) {
    setTitle(s.title);
    setDescription(s.description);
    setReward(String(s.reward));
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/70 backdrop-blur-md">
      <div className="glass rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">New quest</div>
            <div className="text-lg font-bold">Assign a paid task</div>
          </div>
          <button onClick={onClose} className="size-9 rounded-lg hover:bg-white/10 flex items-center justify-center"><X className="size-4" /></button>
        </header>

        <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-[1fr_280px]">
          <div className="p-5 space-y-3">
            <Field label="Assign to">
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="w-full bg-white/5 rounded-lg px-3 py-2.5 text-sm outline-none border border-white/10">
                {memberOptions.length === 0 && <option value="">No members in household</option>}
                {memberOptions.map((m) => (
                  <option key={m.id} value={m.id} className="bg-background">{m.full_name || m.username} {m.member_role ? `(${m.member_role})` : ""}</option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wash the family car" className="w-full bg-white/5 rounded-lg px-3 py-2.5 text-sm outline-none border border-white/10" />
            </Field>
            <Field label="Description (optional)">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Add the details, materials, expectations…" className="w-full bg-white/5 rounded-lg px-3 py-2.5 text-sm outline-none border border-white/10" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={<>Reward (<Dh />)</>}>
                <input value={reward} onChange={(e) => setReward(e.target.value)} inputMode="decimal" placeholder="20" className="w-full bg-white/5 rounded-lg px-3 py-2.5 text-sm outline-none border border-white/10" />
              </Field>
              <Field label="Due date (optional)">
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-white/5 rounded-lg px-3 py-2.5 text-sm outline-none border border-white/10" />
              </Field>
            </div>
            <button onClick={save} disabled={busy} className="w-full mt-2 px-4 py-2.5 rounded-xl bg-neon text-primary-foreground text-sm font-semibold shadow-glow disabled:opacity-50 inline-flex items-center justify-center gap-1.5">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Trophy className="size-4" />}
              {busy ? "Saving…" : "Assign quest"}
            </button>
          </div>

          <div className="border-l border-white/10 p-4 bg-white/[0.02]">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-2">
              <Sparkles className="size-3 text-info" /> AI suggestions
            </div>
            {ideas.isLoading ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2"><Loader2 className="size-4 animate-spin" /> Thinking…</div>
            ) : (ideas.data?.suggestions ?? []).length === 0 ? (
              <div className="text-xs text-muted-foreground">Pick an assignee to see ideas.</div>
            ) : (
              <div className="space-y-2">
                {ideas.data?.suggestions.map((s, i) => (
                  <button key={i} onClick={() => applySuggestion(s)} className="w-full text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition">
                    <div className="text-sm font-semibold flex items-center justify-between gap-2">
                      <span className="truncate">{s.title}</span>
                      <span className="text-xs text-success inline-flex items-baseline gap-0.5"><Money amount={s.reward} decimals={0} /></span>
                    </div>
                    <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{s.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewQuestModal({ quest, onClose }: { quest: Quest; onClose: () => void }) {
  const listProofs = useServerFn(listQuestProofs);
  const approve = useServerFn(approveQuest);
  const reject = useServerFn(rejectQuest);
  const qc = useQueryClient();
  const [showGate, setShowGate] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const proofs = useQuery({ queryKey: ["quest-proofs", quest.id], queryFn: () => listProofs({ data: { quest_id: quest.id } }) });

  async function doApprove() {
    setBusy(true);
    try {
      const res = await approve({ data: { quest_id: quest.id } });
      toast.success("Quest approved", { description: `Paid Dh ${res.reward.toFixed(2)}, ${res.savings.toFixed(2)} into savings.` });
      qc.invalidateQueries({ queryKey: ["quests"] });
      qc.invalidateQueries({ queryKey: ["quest-audit"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["rewards"] });
      qc.invalidateQueries({ queryKey: ["savings"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setBusy(false);
    }
  }

  async function doReject() {
    if (!reason.trim()) return toast.error("Please add a reason");
    setBusy(true);
    try {
      await reject({ data: { quest_id: quest.id, reason: reason.trim() } });
      toast.success("Quest sent back for resubmission");
      qc.invalidateQueries({ queryKey: ["quests"] });
      qc.invalidateQueries({ queryKey: ["quest-audit"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reject");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/70 backdrop-blur-md">
        <div className="glass rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">Review quest</div>
              <div className="text-lg font-bold">{quest.title}</div>
            </div>
            <button onClick={onClose} className="size-9 rounded-lg hover:bg-white/10 flex items-center justify-center"><X className="size-4" /></button>
          </header>

          <div className="flex-1 overflow-auto p-5 space-y-4">
            {quest.description && <p className="text-sm text-muted-foreground">{quest.description}</p>}
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-1 rounded-lg bg-success/15 text-success font-semibold inline-flex items-baseline gap-1"><Money amount={Number(quest.reward)} decimals={0} /> reward</span>
              <span className="px-2 py-1 rounded-lg bg-info/15 text-info">Savings split: {quest.savings_split_pct ?? 0}%</span>
            </div>
            {quest.submitted_notes && (
              <div className="rounded-2xl bg-white/5 p-3 border border-white/10">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Notes from member</div>
                <p className="text-sm">{quest.submitted_notes}</p>
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Proof photos</div>
              {proofs.isLoading ? (
                <div className="text-xs text-muted-foreground">Loading…</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {(proofs.data ?? []).map((p) => (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="block rounded-xl overflow-hidden border border-white/10 hover:border-primary/60 transition">
                      <img src={p.url} alt="Proof" className="w-full h-40 object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {rejecting && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Why are you rejecting?</div>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full bg-white/5 rounded-lg px-3 py-2.5 text-sm outline-none border border-white/10" />
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10">
            {!rejecting ? (
              <>
                <button onClick={() => setRejecting(true)} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm inline-flex items-center gap-1.5">
                  <ThumbsDown className="size-3.5" /> Reject
                </button>
                <button onClick={() => setShowGate(true)} disabled={busy} className="px-4 py-2 rounded-lg bg-neon text-primary-foreground text-sm font-semibold shadow-glow inline-flex items-center gap-1.5 disabled:opacity-50">
                  <ScanFace className="size-3.5" /> Approve &amp; pay
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setRejecting(false)} className="px-3 py-2 rounded-lg bg-white/5 text-sm">Cancel</button>
                <button onClick={doReject} disabled={busy} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50">
                  {busy ? "Sending…" : "Send back"}
                </button>
              </>
            )}
          </footer>
        </div>
      </div>
      <PasskeyGate
        open={showGate}
        title="Verify to approve payout"
        detail={`Approving will pay Dh ${Number(quest.reward).toFixed(2)} from your account.`}
        onClose={() => setShowGate(false)}
        onSuccess={() => { setShowGate(false); doApprove(); }}
      />
    </>
  );
}

// ============ MEMBER VIEW ============
function MemberView({ quests }: { quests: Quest[] }) {
  const [accepting, setAccepting] = useState<Quest | null>(null);
  const [submitting, setSubmitting] = useState<Quest | null>(null);
  const declineFn = useServerFn(declineQuest);
  const qc = useQueryClient();

  const earned = quests.filter((q) => q.status === "approved").reduce((a, q) => a + Number(q.reward), 0);
  const saved = quests.filter((q) => q.status === "approved").reduce((a, q) => a + Number(q.reward) * (Number(q.savings_split_pct ?? 0) / 100), 0);

  async function decline(q: Quest) {
    try {
      await declineFn({ data: { quest_id: q.id } });
      toast("Quest declined");
      qc.invalidateQueries({ queryKey: ["quests"] });
      qc.invalidateQueries({ queryKey: ["quest-audit"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not decline");
    }
  }

  const groups = {
    new: quests.filter((q) => q.status === "pending_acceptance"),
    active: quests.filter((q) => q.status === "accepted" || q.status === "rejected"),
    waiting: quests.filter((q) => q.status === "submitted"),
    done: quests.filter((q) => q.status === "approved" || q.status === "declined"),
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Pending acceptance" value={String(groups.new.length)} tone={groups.new.length > 0 ? "warn" : undefined} />
        <KPI label="In progress" value={String(groups.active.length)} />
        <KPI label="Total earned" value={<Money amount={earned} decimals={0} />} tone="ok" />
        <KPI label="Saved through quests" value={<Money amount={saved} decimals={0} />} />
      </div>

      <Section title="New for you" empty="Nothing new — check back soon.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.new.map((q) => (
            <QuestCard key={q.id} quest={q} role="member" actions={
              <div className="flex gap-2 mt-3">
                <button onClick={() => setAccepting(q)} className="flex-1 px-3 py-2 rounded-lg bg-neon text-primary-foreground text-sm font-semibold shadow-glow">Accept</button>
                <button onClick={() => decline(q)} className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm">Decline</button>
              </div>
            } />
          ))}
        </div>
      </Section>

      <Section title="In progress" empty="No active quests.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.active.map((q) => (
            <QuestCard key={q.id} quest={q} role="member" actions={
              <button onClick={() => setSubmitting(q)} className="w-full mt-3 px-3 py-2 rounded-lg bg-aurora text-primary-foreground text-sm font-semibold shadow-glow inline-flex items-center justify-center gap-1.5">
                <ImagePlus className="size-4" /> Submit proof
              </button>
            } />
          ))}
        </div>
      </Section>

      <Section title="Awaiting approval" empty="Nothing awaiting review.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.waiting.map((q) => (<QuestCard key={q.id} quest={q} role="member" />))}
        </div>
      </Section>

      <Section title="History" empty="Approved and declined quests will appear here.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {groups.done.map((q) => (<QuestCard key={q.id} quest={q} role="member" />))}
        </div>
      </Section>

      {accepting && <AcceptModal quest={accepting} onClose={() => setAccepting(null)} />}
      {submitting && <SubmitModal quest={submitting} onClose={() => setSubmitting(null)} />}
    </>
  );
}

function AcceptModal({ quest, onClose }: { quest: Quest; onClose: () => void }) {
  const accept = useServerFn(acceptQuest);
  const qc = useQueryClient();
  const [pct, setPct] = useState(20);
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    try {
      await accept({ data: { quest_id: quest.id, savings_split_pct: pct } });
      toast.success("Quest accepted!");
      qc.invalidateQueries({ queryKey: ["quests"] });
      qc.invalidateQueries({ queryKey: ["quest-audit"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not accept");
    } finally {
      setBusy(false);
    }
  }

  const savings = Math.round(Number(quest.reward) * pct) / 100;
  const spending = Math.round((Number(quest.reward) - savings) * 100) / 100;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/70 backdrop-blur-md">
      <div className="glass rounded-3xl w-full max-w-md p-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Accept quest</div>
        <h3 className="text-lg font-bold mt-1">{quest.title}</h3>
        <p className="text-sm text-muted-foreground mt-2">Choose how much of your <Money amount={Number(quest.reward)} decimals={0} /> reward goes straight into savings.</p>

        <div className="mt-5">
          <div className="flex items-center justify-between text-sm mb-1">
            <span>Savings split</span>
            <span className="font-bold text-info">{pct}%</span>
          </div>
          <input type="range" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(Number(e.target.value))} className="w-full accent-primary" />
          <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
            <div className="p-2.5 rounded-xl bg-info/10 border border-info/30">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Into savings</div>
              <div className="font-bold text-info"><Money amount={savings} /></div>
            </div>
            <div className="p-2.5 rounded-xl bg-success/10 border border-success/30">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Spendable</div>
              <div className="font-bold text-success"><Money amount={spending} /></div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm">Cancel</button>
          <button onClick={go} disabled={busy} className="flex-1 px-4 py-2.5 rounded-xl bg-neon text-primary-foreground text-sm font-semibold shadow-glow disabled:opacity-50">
            {busy ? "Saving…" : "Accept quest"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubmitModal({ quest, onClose }: { quest: Quest; onClose: () => void }) {
  const submit = useServerFn(submitQuest);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<{ base64: string; mime: string; preview: string }[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    const next: typeof files = [];
    for (const f of list) {
      if (f.size > 8 * 1024 * 1024) { toast.error(`${f.name} too big`); continue; }
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] ?? "");
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      next.push({ base64: b64, mime: f.type || "image/jpeg", preview: URL.createObjectURL(f) });
    }
    setFiles((s) => [...s, ...next].slice(0, 8));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function go() {
    if (files.length === 0) return toast.error("Add at least one proof photo.");
    setBusy(true);
    try {
      await submit({ data: { quest_id: quest.id, notes: notes.trim() || undefined, proofs: files.map((f) => ({ base64: f.base64, mime: f.mime })) } });
      toast.success("Submitted for review");
      qc.invalidateQueries({ queryKey: ["quests"] });
      qc.invalidateQueries({ queryKey: ["quest-audit"] });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-background/70 backdrop-blur-md">
      <div className="glass rounded-3xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Submit completion</div>
            <h3 className="text-lg font-bold">{quest.title}</h3>
          </div>
          <button onClick={onClose} className="size-9 rounded-lg hover:bg-white/10 flex items-center justify-center"><X className="size-4" /></button>
        </div>

        {quest.status === "rejected" && quest.rejection_reason && (
          <div className="mt-3 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm">
            <div className="text-[10px] uppercase tracking-widest text-destructive font-semibold mb-1">Previous feedback</div>
            {quest.rejection_reason}
          </div>
        )}

        <div className="mt-4 flex-1 overflow-auto space-y-3">
          <button onClick={() => fileRef.current?.click()} className="w-full rounded-2xl border-2 border-dashed border-white/15 hover:border-primary/60 transition p-6 flex flex-col items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <Camera className="size-6" />
            Add proof photos (camera or files)
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple capture="environment" onChange={pick} className="hidden" />
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {files.map((f, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden border border-white/10">
                  <img src={f.preview} alt="" className="w-full h-24 object-cover" />
                  <button onClick={() => setFiles((s) => s.filter((_, j) => j !== i))} className="absolute top-1 right-1 size-6 rounded-full bg-background/80 flex items-center justify-center"><X className="size-3" /></button>
                </div>
              ))}
            </div>
          )}
          <Field label="Notes (optional)">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full bg-white/5 rounded-lg px-3 py-2.5 text-sm outline-none border border-white/10" />
          </Field>
        </div>

        <button onClick={go} disabled={busy} className="mt-4 px-4 py-2.5 rounded-xl bg-neon text-primary-foreground text-sm font-semibold shadow-glow disabled:opacity-50">
          {busy ? "Submitting…" : `Submit ${files.length} photo${files.length === 1 ? "" : "s"}`}
        </button>
      </div>
    </div>
  );
}

// ============ shared ============
function QuestCard({ quest, role, actions, onClick }: { quest: Quest; role: "owner" | "member"; actions?: React.ReactNode; onClick?: () => void }) {
  const cfg = STATUS[quest.status];
  const interactive = role === "owner" && quest.status === "submitted";
  const clickable = interactive || !!onClick;
  const isApproved = quest.status === "approved";
  return (
    <div
      onClick={onClick}
      className={`group relative p-4 rounded-2xl border bg-gradient-to-br ${cfg.bg} ${cfg.border} transition-all duration-300 hover:-translate-y-1 hover:shadow-glow ${clickable ? "cursor-pointer" : ""} ${isApproved ? "ring-1 ring-success/30" : ""}`}
    >
      {isApproved && (
        <div className="absolute -top-2 -right-2 text-xl select-none animate-bounce" style={{ animationDuration: "2s" }}>🎉</div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <span className="text-xl leading-none mt-0.5 select-none">{cfg.emoji}</span>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{quest.title}</div>
            {quest.description && <div className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{quest.description}</div>}
          </div>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold inline-flex items-center gap-1 ${cfg.cls}`}>
          {cfg.icon} {cfg.label}
        </span>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs flex-wrap gap-2">
        <div className="inline-flex items-baseline gap-1 px-2.5 py-1 rounded-lg bg-success/15 text-success font-bold border border-success/30 group-hover:scale-105 transition">
          <Coins className="size-3.5 self-center" /> <Money amount={Number(quest.reward)} decimals={0} />
        </div>
        {quest.due_date && <span className="text-muted-foreground inline-flex items-center gap-1">📅 {quest.due_date}</span>}
        {quest.savings_split_pct != null && (
          <span className="text-info font-semibold inline-flex items-center gap-1">🐷 {quest.savings_split_pct}% saved</span>
        )}
      </div>
      {interactive && (
        <div className="mt-3 text-xs text-info inline-flex items-center gap-1 font-semibold animate-pulse">
          Tap to review <ChevronRight className="size-3" />
        </div>
      )}
      {actions}
    </div>
  );
}

const STATUS: Record<Quest["status"], { label: string; cls: string; border: string; bg: string; icon: React.ReactNode; emoji: string }> = {
  pending_acceptance: { label: "New mission", cls: "bg-warning/15 text-warning", border: "border-warning/30", bg: "from-warning/10 to-transparent", icon: <Clock className="size-3" />, emoji: "🎯" },
  accepted: { label: "In progress", cls: "bg-info/15 text-info", border: "border-info/30", bg: "from-info/10 to-transparent", icon: <Hourglass className="size-3" />, emoji: "⚡" },
  submitted: { label: "Awaiting review", cls: "bg-accent/15 text-accent-foreground", border: "border-accent/40", bg: "from-accent/10 to-transparent", icon: <ShieldCheck className="size-3" />, emoji: "🔍" },
  approved: { label: "Approved", cls: "bg-success/15 text-success", border: "border-success/40", bg: "from-success/15 to-transparent", icon: <Check className="size-3" />, emoji: "🏆" },
  rejected: { label: "Needs fixes", cls: "bg-destructive/15 text-destructive", border: "border-destructive/30", bg: "from-destructive/10 to-transparent", icon: <ThumbsDown className="size-3" />, emoji: "🛠️" },
  declined: { label: "Declined", cls: "bg-muted/30 text-muted-foreground", border: "border-white/10", bg: "from-white/[0.02] to-transparent", icon: <X className="size-3" />, emoji: "💤" },
};

function Section({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-4 md:p-5">
      <h2 className="text-sm font-bold mb-3 inline-flex items-center gap-2">{title}</h2>
      {children}
      <div className="text-[11px] text-muted-foreground mt-1 sr-only">{empty}</div>
    </section>
  );
}

function KPI({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "ok" | "warn" }) {
  const toneCls = tone === "ok" ? "from-success/15 to-transparent border-success/30" : tone === "warn" ? "from-warning/15 to-transparent border-warning/30 animate-pulse" : "from-white/[0.04] to-transparent border-white/10";
  return (
    <div className={`rounded-2xl p-4 border bg-gradient-to-br ${toneCls} hover:-translate-y-0.5 transition-transform`}>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold mt-1 inline-flex items-baseline gap-0.5 ${tone === "ok" ? "text-success" : tone === "warn" ? "text-warning" : ""}`}>{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}
