import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { generateInsights } from "@/lib/ai.functions";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { AlertTriangle, TrendingUp, Lightbulb, Sparkles, Brain, PiggyBank, Target, RefreshCw, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/insights")({
  head: () => ({ meta: [{ title: "AI Insights · Tamwil · Family Finance" }] }),
  component: Insights,
});

function Insights() {
  const call = useServerFn(generateInsights);
  const q = useQuery({
    queryKey: ["ai-insights"],
    queryFn: () => call(),
    staleTime: 60_000,
  });

  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!grid.current || !q.data) return;
    const cards = grid.current.querySelectorAll<HTMLElement>("[data-bento]");
    gsap.fromTo(cards, { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out", stagger: 0.07 });
  }, [q.data]);

  if (q.isLoading || !q.data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Crunching your family's numbers…</p>
      </div>
    );
  }
  if (q.isError) {
    return (
      <div className="glass rounded-3xl p-6">
        <p className="text-sm text-destructive">Could not load insights. {(q.error as Error).message}</p>
        <button onClick={() => q.refetch()} className="mt-3 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Try again</button>
      </div>
    );
  }

  const d = q.data;
  const s = d.summary;
  const budgetPct = s.monthlyBudget ? Math.min(150, (s.projectedMonth / Number(s.monthlyBudget)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Intelligence Panel</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-1">AI predictive <span className="text-gradient">insights</span></h1>
          <p className="text-sm text-muted-foreground mt-1">Predictions and recommendations from your real spending and savings history.</p>
        </div>
        <button onClick={() => q.refetch()} className="px-3 py-2 rounded-xl glass text-xs font-medium inline-flex items-center gap-1.5 hover:bg-white/5">
          <RefreshCw className={`size-3.5 ${q.isFetching ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Narrative */}
      <Bento gradient>
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl bg-neon shadow-glow flex items-center justify-center"><Brain className="size-5 text-primary-foreground" /></div>
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">AI Summary</p>
            <p className="mt-2 text-base leading-relaxed whitespace-pre-line">{d.narrative || "Add some expenses and savings to unlock a personalised AI summary."}</p>
          </div>
        </div>
      </Bento>

      {/* KPI row */}
      <div ref={grid} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="This month spent" value={`AED ${s.thisMonthSpent.toFixed(0)}`} icon={<TrendingUp className="size-4" />} />
        <Kpi label="Projected month end" value={`AED ${s.projectedMonth.toFixed(0)}`} icon={<Sparkles className="size-4" />} tone={s.monthlyBudget && s.projectedMonth > Number(s.monthlyBudget) ? "warn" : "ok"} />
        <Kpi label="Total saved" value={`AED ${s.totalSaved.toFixed(0)}`} icon={<PiggyBank className="size-4" />} tone="ok" />
        <Kpi label="Savings rate" value={`${s.savingsRate.toFixed(0)}%`} icon={<Target className="size-4" />} tone={s.savingsRate >= 20 ? "ok" : "warn"} />
      </div>

      {/* Spending forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Bento>
          <Header title="Spending forecast" subtitle="Last 6 months + next 3 months (dashed)" />
          <div className="h-64 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.trend}>
                <defs>
                  <linearGradient id="g-spent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.18 25)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="oklch(0.78 0.18 25)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="g-fcast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.16 230)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.78 0.16 230)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(1 0 0 / 0.08)" />
                <XAxis dataKey="month" stroke="oklch(0.85 0 0)" fontSize={11} />
                <YAxis stroke="oklch(0.85 0 0)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.05 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="spent" name="Actual" stroke="oklch(0.78 0.18 25)" fill="url(#g-spent)" strokeWidth={2} />
                <Area type="monotone" dataKey="forecast" name="Forecast" stroke="oklch(0.78 0.16 230)" fill="url(#g-fcast)" strokeWidth={2} strokeDasharray="6 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 italic">What this means: solid line is what your family actually spent each month, dashed line is what we expect you'll spend over the next 3 months if habits stay the same.</p>
        </Bento>

        <Bento>
          <Header title="Savings growth (6-month projection)" subtitle={`At AED ${s.monthlySavePace.toFixed(0)}/mo current pace`} />
          <div className="h-64 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.savingsForecast}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.08)" />
                <XAxis dataKey="month" stroke="oklch(0.85 0 0)" fontSize={11} />
                <YAxis stroke="oklch(0.85 0 0)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.05 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
                <Line type="monotone" dataKey="saved" stroke="oklch(0.78 0.2 145)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {s.goal > 0 && s.monthsToGoal != null && (
            <p className="text-xs text-muted-foreground mt-2">🎯 Reaches AED {s.goal.toFixed(0)} ({s.goalName ?? "your goal"}) in ~{Math.ceil(s.monthsToGoal)} months.</p>
          )}
        </Bento>
      </div>

      {/* Budget gauge */}
      {s.monthlyBudget && (
        <Bento>
          <Header title="Budget pacing" subtitle={`AED ${s.thisMonthSpent.toFixed(0)} of AED ${Number(s.monthlyBudget).toFixed(0)} this month`} />
          <div className="mt-3 h-3 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, budgetPct)}%`,
                background: budgetPct > 100 ? "oklch(0.7 0.22 25)" : budgetPct > 80 ? "oklch(0.82 0.18 75)" : "oklch(0.78 0.2 145)",
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
            <span>0</span>
            <span className={budgetPct > 100 ? "text-destructive font-semibold" : ""}>{budgetPct.toFixed(0)}% of budget at projected pace</span>
            <span>100%</span>
          </div>
        </Bento>
      )}

      {/* Category breakdown */}
      {d.byCategory.length > 0 && (
        <Bento>
          <Header title="Spending by category" subtitle="All-time household total" />
          <div className="h-64 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.byCategory}>
                <CartesianGrid stroke="oklch(1 0 0 / 0.08)" />
                <XAxis dataKey="cat" stroke="oklch(0.85 0 0)" fontSize={11} />
                <YAxis stroke="oklch(0.85 0 0)" fontSize={11} />
                <Tooltip contentStyle={{ background: "oklch(0.22 0.05 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
                <Bar dataKey="amt" fill="oklch(0.78 0.18 320)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Bento>
      )}

      {/* Risks & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Bento>
          <Header title="Financial risks" subtitle="What to watch out for" icon={<AlertTriangle className="size-4 text-warning" />} />
          <div className="mt-3 space-y-2">
            {d.risks.length === 0 && <p className="text-sm text-muted-foreground">No major risks detected. Keep it up! 🎉</p>}
            {d.risks.map((r, i) => (
              <div key={i} className={`p-3 rounded-xl border ${r.level === "high" ? "bg-destructive/10 border-destructive/30" : r.level === "med" ? "bg-warning/10 border-warning/25" : "bg-info/10 border-info/25"}`}>
                <div className="text-sm font-semibold">{r.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{r.detail}</div>
              </div>
            ))}
          </div>
        </Bento>

        <Bento>
          <Header title="Smart recommendations" subtitle="Suggestions tuned to your data" icon={<Lightbulb className="size-4 text-accent" />} />
          <div className="mt-3 space-y-2">
            {d.recommendations.length === 0 && <p className="text-sm text-muted-foreground">Once we have more data, you'll see tailored tips here.</p>}
            {d.recommendations.map((r, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="text-sm font-semibold">{r.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{r.detail}</div>
              </div>
            ))}
          </div>
        </Bento>
      </div>

      {/* Per-member */}
      {d.perMember.length > 0 && (
        <Bento>
          <Header title="Per-member snapshot" subtitle="Each person's balance, savings and goals" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {d.perMember.map((m) => (
              <div key={m.id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground">{m.role}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Balance</div>
                    <div className={`font-bold ${m.balance < 0 ? "text-destructive" : "text-success"}`}>AED {m.balance.toFixed(0)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <Cell label="Spent" value={m.spent} />
                  <Cell label="Saved" value={m.saved} />
                  <Cell label="Credits" value={m.credited} />
                </div>
              </div>
            ))}
          </div>
        </Bento>
      )}
    </div>
  );
}

function Bento({ children, className = "", gradient }: { children: React.ReactNode; className?: string; gradient?: boolean }) {
  return (
    <div data-bento className={`glass glass-hover rounded-3xl p-5 relative overflow-hidden ${className}`}>
      {gradient && <div className="absolute -top-20 -right-20 size-60 rounded-full bg-neon opacity-20 blur-3xl pointer-events-none" />}
      <div className="relative">{children}</div>
    </div>
  );
}
function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone?: "ok" | "warn" }) {
  return (
    <div data-bento className="glass rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">{icon} {label}</div>
      <div className={`text-2xl font-bold mt-1 ${tone === "warn" ? "text-warning" : tone === "ok" ? "text-success" : ""}`}>{value}</div>
    </div>
  );
}
function Header({ title, subtitle, icon }: { title: string; subtitle?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div>
        <h3 className="font-semibold text-sm flex items-center gap-1.5">{icon}{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className="text-sm font-semibold">{value.toFixed(0)}</div>
    </div>
  );
}
