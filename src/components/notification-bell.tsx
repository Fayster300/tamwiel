import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ScrollText, AlertCircle, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { listScheduledPayments, markPaymentReminded } from "@/lib/scheduled-payments.functions";
import { listQuests, listQuestAudit } from "@/lib/quests.functions";
import { useProfile } from "@/lib/use-profile";
import { Money } from "@/components/dh";
import { ting } from "@/lib/ting";
import { toast } from "sonner";

const SEEN_KEY = "tamwil:lastSeenAudit";

export function NotificationBell() {
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const listBills = useServerFn(listScheduledPayments);
  const listQ = useServerFn(listQuests);
  const listA = useServerFn(listQuestAudit);
  const markRem = useServerFn(markPaymentReminded);

  const isOwner = profile?.role === "owner";

  const bills = useQuery({
    enabled: !!profile && isOwner,
    queryKey: ["bills"],
    queryFn: () => listBills(),
  });
  const quests = useQuery({
    enabled: !!profile,
    queryKey: ["quests"],
    queryFn: () => listQ(),
  });
  const audit = useQuery({
    enabled: !!profile,
    queryKey: ["quest-audit"],
    queryFn: () => listA(),
  });

  const today = new Date().toISOString().slice(0, 10);
  const dueBills = isOwner
    ? (bills.data ?? []).filter((b) => b.next_due_date <= today)
    : [];
  const unremindedDue = dueBills.filter((b) => b.last_reminded_on !== today);

  // Compute quest events relevant to this user
  const myQuestIds = new Set(
    (quests.data ?? [])
      .filter((q) => q.owner_id === profile?.id || q.assignee_id === profile?.id)
      .map((q) => q.id),
  );
  const relevantAudit = (audit.data ?? []).filter((a) => myQuestIds.has(a.quest_id) && a.actor_id !== profile?.id);

  const [lastSeen, setLastSeen] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(SEEN_KEY) ?? "";
  });
  const newAuditCount = relevantAudit.filter((a) => a.created_at > lastSeen).length;
  const totalCount = unremindedDue.length + newAuditCount;

  // On change: ting + toast for new due bills (owner only)
  useEffect(() => {
    if (!isOwner) return;
    if (unremindedDue.length === 0) return;
    ting();
    toast(`${unremindedDue.length} bill${unremindedDue.length > 1 ? "s" : ""} due today`, {
      description: unremindedDue.map((b) => b.name).slice(0, 3).join(" · "),
    });
    markRem({ data: { ids: unremindedDue.map((b) => b.id) } })
      .then(() => qc.invalidateQueries({ queryKey: ["bills"] }))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unremindedDue.length, isOwner]);

  // ting + toast for new quest events (other-actor only)
  const lastQuestActionCount = relevantAudit.length;
  const [lastSeenCount, setLastSeenCount] = useState(lastQuestActionCount);
  useEffect(() => {
    if (lastQuestActionCount > lastSeenCount && lastSeenCount > 0) {
      ting();
      const newest = relevantAudit[0];
      if (newest) {
        const messages: Record<string, string> = {
          created: "New quest assigned to you",
          accepted: "A quest was accepted",
          declined: "A quest was declined",
          submitted: "Quest submitted for review",
          approved: "A quest was approved 🎉",
          rejected: "A quest needs your attention",
        };
        toast(messages[newest.action] ?? "Quest update");
      }
    }
    setLastSeenCount(lastQuestActionCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastQuestActionCount]);

  function openAndMark() {
    setOpen((v) => {
      const next = !v;
      if (next && relevantAudit[0]) {
        window.localStorage.setItem(SEEN_KEY, relevantAudit[0].created_at);
        setLastSeen(relevantAudit[0].created_at);
      }
      return next;
    });
  }

  return (
    <div className="relative" data-notification-bell>
      <button
        onClick={openAndMark}
        className="relative size-9 rounded-lg glass flex items-center justify-center hover:scale-105 transition"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {totalCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-warning text-[10px] font-bold text-background flex items-center justify-center">
            {totalCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-80 max-h-[70vh] overflow-auto glass rounded-2xl p-3 shadow-2xl border border-white/10 z-40">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground px-2 py-1">Notifications</div>
          {totalCount === 0 && (
            <div className="text-center py-6 text-xs text-muted-foreground">You're all caught up.</div>
          )}

          {dueBills.length > 0 && (
            <div className="mt-1">
              <div className="text-[11px] font-semibold text-muted-foreground px-2 mb-1 flex items-center gap-1">
                <AlertCircle className="size-3 text-warning" /> Bills due today
              </div>
              {dueBills.map((b) => (
                <Link
                  to="/automation"
                  key={b.id}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{b.name}</div>
                    <div className="text-[10px] text-muted-foreground">Due {b.next_due_date}</div>
                  </div>
                  <div className="text-xs font-semibold inline-flex items-baseline"><Money amount={Number(b.amount)} decimals={0} /></div>
                </Link>
              ))}
            </div>
          )}

          {relevantAudit.length > 0 && (
            <div className="mt-3">
              <div className="text-[11px] font-semibold text-muted-foreground px-2 mb-1 flex items-center gap-1">
                <Sparkles className="size-3 text-info" /> Quest activity
              </div>
              {relevantAudit.slice(0, 8).map((a) => {
                const q = (quests.data ?? []).find((x) => x.id === a.quest_id);
                const label: Record<string, string> = {
                  created: "Quest assigned",
                  accepted: "Quest accepted",
                  declined: "Quest declined",
                  submitted: "Submitted for review",
                  approved: "Quest approved 🎉",
                  rejected: "Quest rejected",
                };
                return (
                  <Link
                    to="/quests"
                    key={a.id}
                    onClick={() => setOpen(false)}
                    className="block px-2 py-2 rounded-lg hover:bg-white/5"
                  >
                    <div className="text-sm">{label[a.action] ?? a.action}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {q?.title ?? "Quest"} · {new Date(a.created_at).toLocaleString()}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <Link to="/quests" onClick={() => setOpen(false)} className="mt-2 flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-muted-foreground hover:bg-white/5">
            <ScrollText className="size-3" /> View Quest log
          </Link>
        </div>
      )}
    </div>
  );
}
