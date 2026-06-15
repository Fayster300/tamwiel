import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useProfile, useHouseholdExpenses, useHouseholdSavings } from "@/lib/use-profile";
import { CATEGORY_COLORS, CATEGORY_ICONS, type Category } from "@/lib/finance-data";
import { RadialGauge } from "@/components/radial-gauge";
import { BudgetEditor } from "@/components/budget-editor";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { ArrowUpRight, TrendingUp, Wallet, PiggyBank, Activity } from "lucide-react";
import { Money } from "@/components/dh";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Overview · Tamwil · Family Finance" }] }),
  component: Overview,
});

function monthOf(d: string) { return d.slice(0, 7); }

function Overview() {
  const { data: profile } = useProfile();
  const householdId = profile?.household_id;
  const { data: expenses = [] } = useHouseholdExpenses(householdId);
  const { data: savings = [] } = useHouseholdSavings(householdId);

  const byMonth = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.forEach((e) => { m[monthOf(e.expense_date)] = (m[monthOf(e.expense_date)] ?? 0) + Number(e.amount); });
    return m;
  }, [expenses]);

  const months = Object.keys(byMonth).sort();
  const thisMonth = months[months.length - 1] ?? new Date().toISOString().slice(0, 7);
  const lastMonth = months[months.length - 2];
  const thisMonthTotal = expenses.filter((e) => monthOf(e.expense_date) === thisMonth).reduce((a, e) => a + Number(e.amount), 0);
  const lastMonthTotal = lastMonth ? byMonth[lastMonth] : 0;
  const change = lastMonthTotal ? ((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;
  const projected = months.slice(-3).reduce((a, m) => a + byMonth[m], 0) / Math.max(1, Math.min(3, months.length));

  const householdSaved = savings.reduce((a, s) => a + Number(s.amount), 0);

  const trendData = useMemo(
    () => Object.entries(byMonth).sort().map(([m, total]) => ({ month: m.slice(5), total: Math.round(total) })),
    [byMonth],
  );

  const byCat = useMemo(() => {
    const m: Record<string, number> = {};
    expenses.filter((e) => monthOf(e.expense_date) === thisMonth).forEach((e) => { m[e.category] = (m[e.category] ?? 0) + Number(e.amount); });
    return Object.entries(m).map(([name, value]) => ({ name, value: Math.round(value) }));
  }, [expenses, thisMonth]);

  // Real financial health score: blend of budget adherence, savings rate,
  // expense trend, and category diversification. Each sub-score is 0–100,
  // weighted, then combined. If we have almost no data, default to a neutral
  // "needs data" score instead of a fake high number.
  const monthlyBudget = profile?.household?.monthly_budget ?? null;
  const goalTarget = profile?.household?.savings_goal ?? null;
  const { score, scoreLabel, scoreReason } = useMemo(() => {
    const hasAnyData = expenses.length > 0 || savings.length > 0;
    if (!hasAnyData) {
      return { score: 50, scoreLabel: "Awaiting data", scoreReason: "Add expenses and savings to compute your score." };
    }

    // 1) Budget adherence (0–100). 100 if projected spend ≤ 80% of budget.
    let budgetScore = 60; // neutral when no budget is set
    const projectedThisMonth = (() => {
      const today = new Date();
      const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const dom = today.getDate();
      return dom > 0 ? (thisMonthTotal / dom) * dim : thisMonthTotal;
    })();
    if (monthlyBudget && Number(monthlyBudget) > 0) {
      const ratio = projectedThisMonth / Number(monthlyBudget);
      if (ratio <= 0.8) budgetScore = 100;
      else if (ratio <= 1) budgetScore = 100 - (ratio - 0.8) * 200; // 100→60
      else if (ratio <= 1.3) budgetScore = 60 - (ratio - 1) * 150; // 60→15
      else budgetScore = 10;
    }

    // 2) Savings rate (saved this month / (saved + spent)). Target 20%.
    const savedThisMonth = savings
      .filter((s) => (s.created_at ?? "").slice(0, 7) === thisMonth)
      .reduce((a, s) => a + Number(s.amount), 0);
    const denom = savedThisMonth + thisMonthTotal;
    const savingsRate = denom > 0 ? savedThisMonth / denom : 0;
    const savingsScore = Math.max(0, Math.min(100, (savingsRate / 0.2) * 100));

    // 3) Expense trend (this vs last month). Reward decreases, penalize spikes.
    let trendScore = 70;
    if (lastMonthTotal > 0) {
      const change = (thisMonthTotal - lastMonthTotal) / lastMonthTotal;
      trendScore = Math.max(0, Math.min(100, 70 - change * 200));
    }

    // 4) Goal progress (if a goal is set).
    let goalScore = 65;
    if (goalTarget && Number(goalTarget) > 0) {
      const progress = Math.min(1, householdSaved / Number(goalTarget));
      goalScore = 30 + progress * 70;
    }

    const combined =
      budgetScore * 0.4 + savingsScore * 0.3 + trendScore * 0.2 + goalScore * 0.1;
    const final = Math.round(Math.max(5, Math.min(99, combined)));
    const label = final >= 85 ? "Excellent" : final >= 70 ? "Good" : final >= 50 ? "Fair" : "Needs work";
    const reasonBits: string[] = [];
    if (monthlyBudget) reasonBits.push(`Budget ${budgetScore.toFixed(0)}%`);
    reasonBits.push(`Saving ${savingsScore.toFixed(0)}%`);
    reasonBits.push(`Trend ${trendScore.toFixed(0)}%`);
    if (goalTarget) reasonBits.push(`Goal ${goalScore.toFixed(0)}%`);
    return { score: final, scoreLabel: label, scoreReason: reasonBits.join(" · ") };
  }, [expenses, savings, thisMonth, thisMonthTotal, lastMonthTotal, householdSaved, monthlyBudget, goalTarget]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Workspace</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-1">Welcome back, <span className="text-gradient">{profile?.full_name?.split(" ")[0] || "Family"}</span></h1>
          <p className="text-sm text-muted-foreground mt-1">Live financial state · {thisMonth}</p>
        </div>
        <Link to="/expenses" className="px-4 py-2.5 rounded-xl bg-neon text-primary-foreground text-sm font-semibold shadow-glow hover:scale-105 transition flex items-center gap-2">
          Add Expense <ArrowUpRight className="size-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPI icon={Wallet} label="This month" value={<Money amount={thisMonthTotal} decimals={0} />} delta={lastMonthTotal ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs last` : "First month of data"} deltaWarn={change > 0} />
        <KPI icon={Activity} label="Transactions" value={String(expenses.length)} delta={`${expenses.filter((e) => monthOf(e.expense_date) === thisMonth).length} this month`} />
        <KPI icon={PiggyBank} label="Saved" value={<Money amount={householdSaved} decimals={0} />} delta={householdSaved === 0 ? "Set aside your first deposit" : `${savings.length} deposits total`} />
        <KPI icon={TrendingUp} label="Projected" value={<Money amount={projected} decimals={0} />} delta="3-month average" />
      </div>

      <BudgetEditor />



      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 glass glass-hover rounded-3xl p-6 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Financial Health Score</p>
              <h3 className="font-semibold text-lg mt-1">Live dial</h3>
            </div>
            <span className="text-[10px] px-2 py-1 rounded-full bg-success/15 text-success font-semibold">REAL-TIME</span>
          </div>
          <div className="flex items-center justify-center py-2">
            <RadialGauge value={score} label={scoreLabel} size={260} />
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">{scoreReason}</p>
        </div>

        <div className="lg:col-span-3 glass glass-hover rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Cash flow</p>
              <h3 className="font-semibold text-lg mt-1">Spend trajectory</h3>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="size-4 text-info" />
              Projected: <span className="font-semibold text-foreground"><Money amount={projected} decimals={0} /></span>
            </div>
          </div>
          <div className="h-72">
            {trendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No expenses yet. Add one to see trends.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="ov-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.78 0.2 235)" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="oklch(0.6 0.25 295)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="oklch(1 0 0 / 0.05)" strokeDasharray="3 3" />
                  <XAxis dataKey="month" stroke="oklch(0.7 0.03 260)" fontSize={11} />
                  <YAxis stroke="oklch(0.7 0.03 260)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.05 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
                  <Area type="monotone" dataKey="total" stroke="oklch(0.78 0.2 235)" strokeWidth={2.5} fill="url(#ov-grad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <Pill label="Avg/day" value={<Money amount={thisMonthTotal / 30} decimals={0} />} />
            <Pill label="Largest" value={<Money amount={expenses.length ? Math.max(...expenses.map((e) => Number(e.amount))) : 0} decimals={0} />} />
            <Pill label="Categories" value={String(new Set(expenses.map((e) => e.category)).size)} />
            <Pill label="Saved" value={<Money amount={householdSaved} decimals={0} />} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 glass glass-hover rounded-3xl p-6">
          <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Allocation</p>
          <h3 className="font-semibold text-lg mt-1 mb-4">By category</h3>
          <div className="h-60">
            {byCat.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No spending this month.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2} stroke="none">
                    {byCat.map((entry) => {
                      const c = (entry.name as Category) in CATEGORY_COLORS ? (entry.name as Category) : "Shopping";
                      return <Cell key={entry.name} fill={CATEGORY_COLORS[c]} />;
                    })}
                  </Pie>
                  <Tooltip contentStyle={{ background: "oklch(0.18 0.05 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12, color: "#ffffff" }} itemStyle={{ color: "#ffffff" }} labelStyle={{ color: "#ffffff" }} formatter={(v: number, n: string) => [`Dh ${Number(v).toFixed(0)}`, n]} />

                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 glass glass-hover rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Activity</p>
              <h3 className="font-semibold text-lg mt-1">Recent transactions</h3>
            </div>
            <Link to="/expenses" className="text-xs text-info hover:underline">View all →</Link>
          </div>
          <div className="space-y-1">
            {expenses.length === 0 && (
              <div className="text-sm text-muted-foreground py-6 text-center">No transactions yet.</div>
            )}
            {expenses.slice(0, 7).map((e) => {
              const cat = (e.category as Category) in CATEGORY_COLORS ? (e.category as Category) : "Shopping";
              return (
                <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] transition">
                  <div className="size-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `${CATEGORY_COLORS[cat]}22`, border: `1px solid ${CATEGORY_COLORS[cat]}44` }}>
                    {CATEGORY_ICONS[cat]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{e.merchant}</div>
                    <div className="text-[11px] text-muted-foreground">{e.expense_date} · {e.category}</div>
                  </div>
                  <div className="font-semibold text-sm"><Money amount={Number(e.amount)} sign="-" /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ icon: Icon, label, value, delta, deltaWarn }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; delta: string; deltaWarn?: boolean }) {
  return (
    <div className="glass glass-hover rounded-3xl p-5 relative overflow-hidden">
      <div className="absolute -top-10 -right-10 size-32 rounded-full bg-neon opacity-20 blur-2xl" />
      <div className="flex items-center justify-between relative">
        <div className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">{label}</div>
        <div className="size-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center">
          <Icon className="size-4 text-info" />
        </div>
      </div>
      <div className="text-3xl md:text-4xl font-bold mt-3 relative">{value}</div>
      <div className={`text-xs mt-1 relative font-medium ${deltaWarn ? "text-warning" : "text-success"}`}>{delta}</div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/[0.04] p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="text-base font-bold mt-1">{value}</div>
    </div>
  );
}
