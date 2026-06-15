import { useEffect, useState } from "react";
import { type Expense } from "./finance-data";

const KEY = "ffa-expenses-v2";

function load(): Expense[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  localStorage.setItem(KEY, JSON.stringify([]));
  return [];
}

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  useEffect(() => setExpenses(load()), []);
  const add = (e: Expense) => {
    setExpenses((prev) => {
      const next = [e, ...prev];
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  };
  const reset = () => {
    localStorage.removeItem(KEY);
    setExpenses(load());
  };
  return { expenses, add, reset };
}
