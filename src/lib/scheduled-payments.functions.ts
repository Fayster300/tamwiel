import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CATS = ["Rent", "Utilities", "Transport", "Education", "Health", "Entertainment", "Shopping", "Food"] as const;

export const listScheduledPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("scheduled_payments")
      .select("id, name, amount, category, icon, next_due_date, frequency, last_paid_at, last_reminded_on, created_at")
      .order("next_due_date", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const addScheduledPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; amount: number; category: string; icon?: string; next_due_date: string; frequency: "once" | "weekly" | "monthly" }) =>
    z.object({
      name: z.string().trim().min(1).max(80),
      amount: z.number().positive().max(1_000_000),
      category: z.enum(CATS),
      icon: z.string().max(20).optional(),
      next_due_date: z.string(),
      frequency: z.enum(["once", "weekly", "monthly"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("profiles").select("role, household_id").eq("id", userId).maybeSingle();
    if (!me || me.role !== "owner") throw new Error("Only the household owner can schedule payments.");
    const { error } = await supabase.from("scheduled_payments").insert({
      household_id: me.household_id,
      owner_id: userId,
      name: data.name,
      amount: data.amount,
      category: data.category,
      icon: data.icon ?? null,
      next_due_date: data.next_due_date,
      frequency: data.frequency,
    });
    if (error) throw error;
    return { ok: true };
  });

export const deleteScheduledPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("scheduled_payments").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

function rollDate(d: string, freq: "once" | "weekly" | "monthly"): string | null {
  if (freq === "once") return null;
  const dt = new Date(d + "T00:00:00Z");
  if (freq === "weekly") dt.setUTCDate(dt.getUTCDate() + 7);
  else dt.setUTCMonth(dt.getUTCMonth() + 1);
  return dt.toISOString().slice(0, 10);
}

export const runScheduledPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("profiles").select("role, household_id, account_balance").eq("id", userId).maybeSingle();
    if (!me || me.role !== "owner") throw new Error("Only the household owner can run automations.");

    const { data: bill, error: be } = await supabase
      .from("scheduled_payments")
      .select("id, name, amount, category, next_due_date, frequency, household_id")
      .eq("id", data.id)
      .maybeSingle();
    if (be) throw be;
    if (!bill) throw new Error("Payment not found.");

    // Check available balance
    const [{ data: rewards }, { data: expenses }, { data: savings }] = await Promise.all([
      supabase.from("rewards").select("amount").eq("to_profile_id", userId),
      supabase.from("expenses").select("amount").eq("profile_id", userId),
      supabase.from("savings").select("amount").eq("profile_id", userId),
    ]);
    const credits = (rewards ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const spent = (expenses ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const saved = (savings ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const balance = Number(me.account_balance ?? 0) + credits - spent - saved;
    if (Number(bill.amount) > balance) {
      throw new Error(`Insufficient funds. Your balance is Dh ${balance.toFixed(2)}.`);
    }

    // Insert expense
    const { error: xe } = await supabase.from("expenses").insert({
      household_id: bill.household_id,
      profile_id: userId,
      merchant: `Auto-pay · ${bill.name}`,
      amount: Number(bill.amount),
      category: bill.category,
      expense_date: new Date().toISOString().slice(0, 10),
    });
    if (xe) throw xe;

    // Roll forward or remove
    const next = rollDate(bill.next_due_date, bill.frequency as "once" | "weekly" | "monthly");
    if (next === null) {
      await supabase.from("scheduled_payments").delete().eq("id", bill.id);
    } else {
      await supabase
        .from("scheduled_payments")
        .update({ next_due_date: next, last_paid_at: new Date().toISOString() })
        .eq("id", bill.id);
    }
    return { ok: true, amount: Number(bill.amount), name: bill.name };
  });

export const markPaymentReminded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { ids: string[] }) => z.object({ ids: z.array(z.string().uuid()).max(50) }).parse(d))
  .handler(async ({ data, context }) => {
    if (data.ids.length === 0) return { ok: true };
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await context.supabase
      .from("scheduled_payments")
      .update({ last_reminded_on: today })
      .in("id", data.ids);
    if (error) throw error;
    return { ok: true };
  });
