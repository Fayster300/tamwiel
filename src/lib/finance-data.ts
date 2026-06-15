export type Category =
  | "Food"
  | "Rent"
  | "Utilities"
  | "Transport"
  | "Entertainment"
  | "Education"
  | "Shopping"
  | "Health";

export interface Expense {
  id: string;
  date: string;
  merchant: string;
  category: Category;
  amount: number;
  member: string;
}

export const CATEGORY_COLORS: Record<Category, string> = {
  Food: "oklch(0.74 0.24 350)",
  Rent: "oklch(0.7 0.25 295)",
  Utilities: "oklch(0.82 0.18 200)",
  Transport: "oklch(0.85 0.2 130)",
  Entertainment: "oklch(0.82 0.18 75)",
  Education: "oklch(0.78 0.16 230)",
  Shopping: "oklch(0.74 0.2 25)",
  Health: "oklch(0.78 0.2 145)",
};

export const CATEGORY_ICONS: Record<Category, string> = {
  Food: "🍔",
  Rent: "🏠",
  Utilities: "💡",
  Transport: "🚗",
  Entertainment: "🎬",
  Education: "📚",
  Shopping: "🛍️",
  Health: "❤️",
};

const members = ["Mom", "Dad", "Emma", "Liam"];
const merchantsByCat: Record<Category, string[]> = {
  Food: ["Whole Foods", "Pizza Palace", "Starbucks", "Trader Joe's", "Sushi Bar", "Local Diner"],
  Rent: ["Skyline Apartments"],
  Utilities: ["PowerCo", "WaterWorks", "FiberNet", "GasUtility"],
  Transport: ["Shell Gas", "Uber", "Metro Card", "Lyft"],
  Entertainment: ["Netflix", "Spotify", "Cinema City", "Disney+", "Steam"],
  Education: ["Coursera", "Khan Academy+", "School Books", "Math Tutor"],
  Shopping: ["Amazon", "Target", "Nike Store", "IKEA"],
  Health: ["CVS Pharmacy", "Dr. Smith", "FitGym"],
};

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateExpenses(): Expense[] {
  const out: Expense[] = [];
  const cats = Object.keys(merchantsByCat) as Category[];
  const today = new Date();
  // 90 days of data
  for (let d = 0; d < 90; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const count = 1 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      const cat = rand(cats);
      const base =
        cat === "Rent" ? 1800 :
        cat === "Utilities" ? 80 + Math.random() * 120 :
        cat === "Food" ? 12 + Math.random() * 85 :
        cat === "Transport" ? 8 + Math.random() * 60 :
        cat === "Entertainment" ? 9 + Math.random() * 45 :
        cat === "Education" ? 15 + Math.random() * 100 :
        cat === "Shopping" ? 20 + Math.random() * 200 :
        25 + Math.random() * 150;
      if (cat === "Rent" && d % 30 !== 1) continue;
      out.push({
        id: `${d}-${i}-${cat}`,
        date: date.toISOString().slice(0, 10),
        merchant: rand(merchantsByCat[cat]),
        category: cat,
        amount: Math.round(base * 100) / 100,
        member: rand(members),
      });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export interface Child {
  id: string;
  name: string;
  emoji: string;
  allowance: number;
  saved: number;
  goal: number;
  goalName: string;
  streak: number;
}

export const CHILDREN: Child[] = [
  { id: "1", name: "Emma", emoji: "👧", allowance: 25, saved: 0, goal: 200, goalName: "Nintendo Switch Game", streak: 0 },
  { id: "2", name: "Liam", emoji: "👦", allowance: 20, saved: 0, goal: 120, goalName: "LEGO Set", streak: 0 },
];

export function monthOf(date: string) {
  return date.slice(0, 7);
}

export function computeInsights(expenses: Expense[]) {
  const byMonth: Record<string, number> = {};
  expenses.forEach((e) => {
    byMonth[monthOf(e.date)] = (byMonth[monthOf(e.date)] ?? 0) + e.amount;
  });
  const months = Object.keys(byMonth).sort();
  const thisMonth = months[months.length - 1];
  const lastMonth = months[months.length - 2];
  const thisFood = expenses.filter((e) => e.category === "Food" && monthOf(e.date) === thisMonth).reduce((a, b) => a + b.amount, 0);
  const lastFood = expenses.filter((e) => e.category === "Food" && monthOf(e.date) === lastMonth).reduce((a, b) => a + b.amount, 0);
  const foodChange = lastFood ? ((thisFood - lastFood) / lastFood) * 100 : 0;

  const subs = expenses.filter((e) => ["Netflix", "Spotify", "Disney+"].includes(e.merchant));
  const subTotal = subs.reduce((a, b) => a + b.amount, 0);

  const insights: { type: "warn" | "good" | "info"; title: string; detail: string }[] = [];
  if (foodChange > 10) insights.push({ type: "warn", title: `Food spending up ${foodChange.toFixed(0)}%`, detail: "Consider meal-prepping to cut takeout." });
  else if (foodChange < -5) insights.push({ type: "good", title: `Great! Food spending down ${Math.abs(foodChange).toFixed(0)}%`, detail: "Keep up the home cooking." });

  if (subs.length > 2) insights.push({ type: "info", title: `${subs.length} active subscriptions`, detail: `Costing ~$${subTotal.toFixed(0)} — review unused ones.` });

  const entertainment = expenses.filter((e) => e.category === "Entertainment" && monthOf(e.date) === thisMonth).reduce((a, b) => a + b.amount, 0);
  if (entertainment > 150) insights.push({ type: "warn", title: "High entertainment spend", detail: `You've spent $${entertainment.toFixed(0)} this month.` });

  const avg = months.slice(-3).reduce((a, m) => a + byMonth[m], 0) / Math.min(3, months.length);
  const projected = avg;
  insights.push({ type: "info", title: "End-of-month forecast", detail: `Projected total: $${projected.toFixed(0)} based on recent trends.` });

  return { thisMonth, lastMonth, byMonth, insights, projected };
}

export function healthScore(expenses: Expense[]): { score: number; label: string; color: string } {
  const { byMonth } = computeInsights(expenses);
  const months = Object.keys(byMonth).sort();
  if (months.length < 2) return { score: 75, label: "Good", color: "var(--success)" };
  const recent = byMonth[months[months.length - 1]];
  const prev = byMonth[months[months.length - 2]];
  let s = 70;
  if (recent < prev) s += 15;
  else if (recent > prev * 1.15) s -= 20;
  const subs = expenses.filter((e) => ["Netflix", "Spotify", "Disney+"].includes(e.merchant)).length;
  if (subs > 3) s -= 8;
  s += Math.floor(Math.random() * 8);
  s = Math.max(0, Math.min(100, s));
  const label = s >= 85 ? "Excellent" : s >= 70 ? "Good" : s >= 50 ? "Fair" : "Poor";
  const color = s >= 85 ? "oklch(0.78 0.2 145)" : s >= 70 ? "oklch(0.82 0.18 200)" : s >= 50 ? "oklch(0.82 0.18 75)" : "oklch(0.65 0.25 25)";
  return { score: s, label, color };
}
