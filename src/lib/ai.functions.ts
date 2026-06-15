import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

function authHeaders() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${key}`,
    "Lovable-API-Key": key,
  };
}

// ---------- Receipt Scanner ----------
export const scanReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { image_base64: string; mime_type?: string }) =>
    z
      .object({
        image_base64: z.string().min(20),
        mime_type: z.string().default("image/jpeg"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const dataUrl = data.image_base64.startsWith("data:")
      ? data.image_base64
      : `data:${data.mime_type};base64,${data.image_base64}`;

    const body = {
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You extract structured data from grocery/retail receipts. Always reply with a single JSON object matching the schema. Categories must be one of: Food, Rent, Utilities, Transport, Entertainment, Education, Shopping, Health. Amounts are numbers in the receipt currency without symbols.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                'Extract the merchant name, currency, total amount, and each line item with its name, quantity if visible, unit amount, and best-guess category. Reply ONLY with JSON like: {"merchant":"...","currency":"AED","total":12.34,"items":[{"name":"Milk 1L","amount":4.50,"category":"Food"}]}',
            },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    };

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("Rate limit reached — please wait a moment and try again.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
      throw new Error(`AI error (${res.status}): ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Could not understand the receipt. Try a clearer photo.");
    const parsed = JSON.parse(match[0]) as {
      merchant?: string;
      currency?: string;
      total?: number;
      items?: { name: string; amount: number; category?: string }[];
    };
    return {
      merchant: parsed.merchant ?? "Receipt",
      currency: parsed.currency ?? "AED",
      total: Number(parsed.total ?? 0),
      items: (parsed.items ?? []).map((i) => ({
        name: String(i.name ?? "Item"),
        amount: Number(i.amount ?? 0),
        category: String(i.category ?? "Shopping"),
      })),
    };
  });

// ---------- Shared household snapshot loader ----------
type AnyRow = Record<string, unknown> & { [k: string]: any };

async function loadHouseholdSnapshot(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, full_name, username, role, member_role, household_id, household:households(id, name, savings_goal, savings_goal_name, monthly_budget)",
    )
    .eq("id", userId)
    .maybeSingle();

  const householdId = (profile as AnyRow | null)?.household_id;
  if (!householdId)
    return { profile, members: [] as AnyRow[], expenses: [] as AnyRow[], savings: [] as AnyRow[], rewards: [] as AnyRow[], goals: [] as AnyRow[] };

  const [{ data: members }, { data: expenses }, { data: savings }, { data: rewards }, { data: goals }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, username, role, member_role, gender")
        .eq("household_id", householdId),
      supabase
        .from("expenses")
        .select("profile_id, merchant, amount, category, expense_date")
        .eq("household_id", householdId)
        .order("expense_date", { ascending: false })
        .limit(200),
      supabase
        .from("savings")
        .select("profile_id, amount, note, created_at")
        .eq("household_id", householdId)
        .limit(200),
      supabase
        .from("rewards")
        .select("amount, note, to_profile_id, from_profile_id, created_at")
        .eq("household_id", householdId)
        .limit(200),
      supabase
        .from("goals")
        .select("profile_id, name, target, saved")
        .eq("household_id", householdId)
        .limit(50),
    ]);

  return {
    profile,
    members: (members ?? []) as AnyRow[],
    expenses: (expenses ?? []) as AnyRow[],
    savings: (savings ?? []) as AnyRow[],
    rewards: (rewards ?? []) as AnyRow[],
    goals: (goals ?? []) as AnyRow[],
  };
}

function nameOf(members: AnyRow[], id: string) {
  const m = members.find((x) => x.id === id);
  if (!m) return "Unknown";
  const base = m.full_name || m.username || "Member";
  return m.member_role ? `${base} (${m.member_role})` : base;
}

function perMemberBreakdown(snap: Awaited<ReturnType<typeof loadHouseholdSnapshot>>) {
  return snap.members.map((m) => {
    const spent = snap.expenses.filter((e) => e.profile_id === m.id).reduce((a, e) => a + Number(e.amount), 0);
    const saved = snap.savings.filter((s) => s.profile_id === m.id).reduce((a, s) => a + Number(s.amount), 0);
    const credited = snap.rewards.filter((r) => r.to_profile_id === m.id).reduce((a, r) => a + Number(r.amount), 0);
    const myGoals = snap.goals.filter((g) => g.profile_id === m.id);
    return {
      id: m.id as string,
      name: (m.full_name || m.username || "Member") as string,
      role: m.role === "owner" ? "Household Owner" : ((m.member_role as string) ?? "Member"),
      spent,
      saved,
      credited,
      balance: credited - spent - saved,
      goals: myGoals.map((g) => ({ name: g.name as string, target: Number(g.target), saved: Number(g.saved) })),
    };
  });
}

// ---------- Bola Chatbot ----------
export const askBola = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { messages: { role: "user" | "assistant"; content: string }[] }) =>
      z
        .object({
          messages: z
            .array(
              z.object({
                role: z.enum(["user", "assistant"]),
                content: z.string().min(1).max(4000),
              }),
            )
            .min(1)
            .max(30),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const snap = await loadHouseholdSnapshot(supabase, userId);
    const h = (snap.profile as AnyRow | null)?.household as AnyRow | undefined;
    const breakdown = perMemberBreakdown(snap);
    const me = breakdown.find((b) => b.id === userId);

    const familySection = breakdown
      .map(
        (b) =>
          `• ${b.name} — ${b.role}: balance AED ${b.balance.toFixed(2)} (credits ${b.credited.toFixed(2)}, spent ${b.spent.toFixed(2)}, saved ${b.saved.toFixed(2)})${b.goals.length ? `; goals: ${b.goals.map((g) => `${g.name} ${g.saved}/${g.target}`).join(", ")}` : ""}`,
      )
      .join("\n");

    const recentExpenses = snap.expenses
      .slice(0, 15)
      .map((e) => `${e.expense_date} · ${nameOf(snap.members, e.profile_id as string)} · ${e.merchant} AED ${e.amount} (${e.category})`)
      .join("\n");

    const ctx = `HOUSEHOLD CONTEXT:
Household: ${h?.name ?? "—"}
Monthly budget: ${h?.monthly_budget ? `AED ${h.monthly_budget}` : "not set"}
Savings goal: ${h?.savings_goal ? `AED ${h.savings_goal} for ${h.savings_goal_name ?? "—"}` : "not set"}

YOU ARE TALKING TO: ${(snap.profile as AnyRow | null)?.full_name ?? (snap.profile as AnyRow | null)?.username ?? "user"} — ${(snap.profile as AnyRow | null)?.role === "owner" ? "Household Owner" : `Member (${(snap.profile as AnyRow | null)?.member_role ?? "member"})`}
Their balance: AED ${me?.balance.toFixed(2) ?? "0.00"}

FAMILY MEMBERS (each is a distinct person — never mix their data):
${familySection || "(no members yet)"}

RECENT HOUSEHOLD EXPENSES (with who spent):
${recentExpenses || "(none)"}`;

    const system = `You are Pecunia, a warm, kid-friendly family finance coach inside the Tamwil app. Speak simply and briefly using short paragraphs and plain numbers.

CRITICAL RULES about family members:
1. Each person in FAMILY MEMBERS is unique. NEVER mix up their balances, spending, savings, or goals.
2. When the user asks about a specific person ("How much did Mom spend?", "What is Liam's balance?"), match by name OR role (Mom, Dad, Child, etc.) from the list and only quote THAT person's numbers.
3. If the named person isn't in the list, say so honestly — do not guess.
4. If the user says "I" / "my", use the YOU ARE TALKING TO row.
5. Never invent transactions, members, or amounts that aren't in the context.
If the user writes Arabic, reply in Arabic; otherwise reply in their language.

${ctx}`;

    const body = {
      model: MODEL,
      messages: [{ role: "system", content: system }, ...data.messages],
    };

    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("Bola is taking a quick break — try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted.");
      throw new Error(`AI error (${res.status}): ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { reply: json.choices?.[0]?.message?.content ?? "Sorry, I didn't catch that." };
  });

// ---------- AI Insights (real predictions from real data) ----------
export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const snap = await loadHouseholdSnapshot(supabase, userId);
    const h = (snap.profile as AnyRow | null)?.household as AnyRow | undefined;

    // Need member account_balance too — fetch it explicitly.
    const householdId = (snap.profile as AnyRow | null)?.household_id as string | undefined;
    const { data: balRows } = householdId
      ? await supabase.from("profiles").select("id, account_balance").eq("household_id", householdId)
      : { data: [] as AnyRow[] };
    const balanceMap = new Map<string, number>();
    (balRows ?? []).forEach((r: AnyRow) => balanceMap.set(r.id as string, Number(r.account_balance ?? 0)));

    const byMonth: Record<string, number> = {};
    const byCat: Record<string, number> = {};
    const byMonthCat: Record<string, Record<string, number>> = {};
    snap.expenses.forEach((e) => {
      const m = String(e.expense_date).slice(0, 7);
      byMonth[m] = (byMonth[m] ?? 0) + Number(e.amount);
      byCat[e.category as string] = (byCat[e.category as string] ?? 0) + Number(e.amount);
      byMonthCat[m] = byMonthCat[m] ?? {};
      byMonthCat[m][e.category as string] = (byMonthCat[m][e.category as string] ?? 0) + Number(e.amount);
    });
    const months = Object.keys(byMonth).sort();
    const thisMonth = months[months.length - 1] ?? new Date().toISOString().slice(0, 7);
    const lastMonth = months[months.length - 2];
    const last3 = months.slice(-3);
    const avg3 = last3.length ? last3.reduce((a, m) => a + byMonth[m], 0) / last3.length : 0;

    const today = new Date();
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const thisMonthSpent = byMonth[thisMonth] ?? 0;
    // Only project once we have a few days of data; otherwise use raw figure.
    const projectedMonth = dayOfMonth >= 3
      ? (thisMonthSpent / dayOfMonth) * daysInMonth
      : thisMonthSpent;

    const totalCredits = snap.rewards.reduce((a, r) => a + Number(r.amount), 0);
    const totalSpent = snap.expenses.reduce((a, e) => a + Number(e.amount), 0);
    const totalSaved = snap.savings.reduce((a, s) => a + Number(s.amount), 0);
    const startingBalance = Array.from(balanceMap.values()).reduce((a, b) => a + b, 0);
    const householdBalance = startingBalance + totalCredits - totalSpent - totalSaved;

    const savedThisMonth = snap.savings
      .filter((s) => String(s.created_at).slice(0, 7) === thisMonth)
      .reduce((a, s) => a + Number(s.amount), 0);
    const savingsRate = savedThisMonth + thisMonthSpent > 0 ? (savedThisMonth / (savedThisMonth + thisMonthSpent)) * 100 : 0;

    const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
    let growthCat: { cat: string; pct: number } | null = null;
    type GrowthCat = { cat: string; pct: number };
    if (lastMonth) {
      let bestPct = -Infinity;
      Object.keys(byMonthCat[thisMonth] ?? {}).forEach((c) => {
        const tm = byMonthCat[thisMonth]?.[c] ?? 0;
        const lm = byMonthCat[lastMonth]?.[c] ?? 0;
        // Only report a growth category if both months actually have spend
        // (avoids "+∞%" or weird first-month jumps).
        if (lm >= 20 && tm > lm) {
          const pct = ((tm - lm) / lm) * 100;
          if (pct > bestPct) {
            bestPct = pct;
            growthCat = { cat: c, pct };
          }
        }
      });
    }

    const monthlySavePace = last3.length
      ? snap.savings
          .filter((s) => last3.includes(String(s.created_at).slice(0, 7)))
          .reduce((a, s) => a + Number(s.amount), 0) / last3.length
      : 0;
    const goal = Number(h?.savings_goal ?? 0);
    const monthsToGoal = goal > 0 && monthlySavePace > 0 ? Math.max(0, (goal - totalSaved) / monthlySavePace) : null;

    const trend: { month: string; spent: number; forecast: number }[] = months.slice(-6).map((m) => ({
      month: m,
      spent: Math.round(byMonth[m]),
      forecast: 0,
    }));
    const lastDate = months.length ? new Date(months[months.length - 1] + "-01") : new Date();
    for (let i = 1; i <= 3; i++) {
      const d = new Date(lastDate.getFullYear(), lastDate.getMonth() + i, 1);
      trend.push({ month: d.toISOString().slice(0, 7), spent: 0, forecast: Math.round(avg3) });
    }

    const savingsForecast: { month: string; saved: number }[] = [];
    let cum = totalSaved;
    for (let i = 0; i < 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
      cum += monthlySavePace;
      savingsForecast.push({ month: d.toISOString().slice(0, 7), saved: Math.round(cum) });
    }

    const risks: { level: "high" | "med" | "low"; title: string; detail: string }[] = [];
    if (h?.monthly_budget && projectedMonth > Number(h.monthly_budget) && thisMonthSpent > 0) {
      risks.push({
        level: "high",
        title: "Projected to exceed monthly budget",
        detail: `On pace for AED ${projectedMonth.toFixed(0)} vs budget AED ${Number(h.monthly_budget).toFixed(0)} — over by AED ${(projectedMonth - Number(h.monthly_budget)).toFixed(0)}.`,
      });
    }
    if (householdBalance < projectedMonth * 0.5 && thisMonthSpent > 0) {
      risks.push({
        level: "high",
        title: "Low household cash buffer",
        detail: `Available household balance is AED ${householdBalance.toFixed(0)} — less than half of projected monthly spend (AED ${projectedMonth.toFixed(0)}).`,
      });
    }
    if (savingsRate < 10 && thisMonthSpent > 0) {
      risks.push({
        level: "med",
        title: "Savings rate is low",
        detail: `Only ${savingsRate.toFixed(0)}% of this month went to savings. Aim for 20%.`,
      });
    }
    const gc = growthCat as GrowthCat | null;
    if (gc && gc.pct > 25) {
      risks.push({
        level: "low",
        title: `${gc.cat} jumped ${gc.pct.toFixed(0)}%`,
        detail: `Spending on ${gc.cat} grew sharply vs last month.`,
      });
    }

    const recs: { title: string; detail: string }[] = [];
    if (topCat && topCat[1] > 0) {
      recs.push({
        title: `Trim 10% off ${topCat[0]}`,
        detail: `${topCat[0]} is your largest category (AED ${topCat[1].toFixed(0)}). A 10% trim frees ~AED ${(topCat[1] * 0.1).toFixed(0)} for savings.`,
      });
    }
    if (h?.monthly_budget) {
      const safeDaily = Math.max(0, (Number(h.monthly_budget) - thisMonthSpent) / Math.max(1, daysInMonth - dayOfMonth));
      recs.push({
        title: "Safe daily spend",
        detail: `Spend up to AED ${safeDaily.toFixed(0)}/day for the rest of the month to stay on budget.`,
      });
    }
    if (goal > 0 && monthsToGoal != null) {
      if (totalSaved >= goal) {
        recs.push({ title: "Goal reached 🎉", detail: `You've already saved AED ${totalSaved.toFixed(0)} toward ${h?.savings_goal_name ?? "your goal"}.` });
      } else if (monthlySavePace > 0) {
        recs.push({
          title: `~${Math.ceil(monthsToGoal)} months to reach ${h?.savings_goal_name ?? "your goal"}`,
          detail: `At the current pace of AED ${monthlySavePace.toFixed(0)}/mo, you hit AED ${goal.toFixed(0)} in ~${Math.ceil(monthsToGoal)} months.`,
        });
      } else {
        recs.push({
          title: `Start saving for ${h?.savings_goal_name ?? "your goal"}`,
          detail: `Your goal is AED ${goal.toFixed(0)} but no savings have been logged yet. Even AED 100/mo gets you started.`,
        });
      }
    }

    const hasEnoughData = snap.expenses.length >= 3 || snap.savings.length >= 1;
    let narrative = "";
    if (hasEnoughData) {
      try {
        const body = {
          model: MODEL,
          messages: [
            {
              role: "system",
              content:
                "You are a friendly family-finance analyst. Write 3 short paragraphs (max 90 words total) summarising the family's financial picture, the key risk, and one specific actionable suggestion. CRITICAL: only cite numbers that appear in the data block. Never invent transactions or members. If monthly budget is 'not set', do NOT mention being over/under budget. If a metric is zero, say so honestly. Plain language for kids and adults. Numbers in AED. No markdown headings.",
            },
            {
              role: "user",
              content: `Real data (do not invent anything not here):
- Members: ${snap.members.length}
- Household balance available: AED ${householdBalance.toFixed(0)}
- This month spent: AED ${thisMonthSpent.toFixed(0)}
- Projected month-end spend: AED ${projectedMonth.toFixed(0)}
- Monthly budget: ${h?.monthly_budget ? `AED ${h.monthly_budget}` : "not set"}
- Total saved (all time): AED ${totalSaved.toFixed(0)} ${goal ? `(goal AED ${goal})` : "(no goal set)"}
- Saved this month: AED ${savedThisMonth.toFixed(0)}
- Savings rate this month: ${savingsRate.toFixed(0)}%
- Monthly savings pace (last 3mo): AED ${monthlySavePace.toFixed(0)}
- Top spend category: ${topCat ? `${topCat[0]} AED ${topCat[1].toFixed(0)}` : "none yet"}
- Biggest category growth vs last month: ${gc ? `${gc.cat} +${gc.pct.toFixed(0)}%` : "none"}`,
            },
          ],
        };
        const res = await fetch(GATEWAY, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
          narrative = j.choices?.[0]?.message?.content ?? "";
        }
      } catch {
        // narrative is optional
      }
    } else {
      narrative = `Your family hasn't logged enough activity yet for a full AI summary. Add a few expenses${snap.savings.length === 0 ? " and your first savings deposit" : ""} and refresh to unlock personalised insights.`;
    }

    return {
      summary: {
        thisMonthSpent,
        projectedMonth,
        monthlyBudget: h?.monthly_budget ?? null,
        totalCredits,
        totalSpent,
        totalSaved,
        savedThisMonth,
        savingsRate,
        monthlySavePace,
        goal,
        goalName: h?.savings_goal_name ?? null,
        monthsToGoal,
        householdBalance,
      },
      trend,
      savingsForecast,
      byCategory: Object.entries(byCat).map(([cat, amt]) => ({ cat, amt: Math.round(amt) })),
      perMember: perMemberBreakdown(snap),
      risks,
      recommendations: recs,
      narrative,
    };
  });
