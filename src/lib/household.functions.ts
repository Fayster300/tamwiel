import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const addMemberByCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { link_code: string }) =>
    z.object({ link_code: z.string().trim().min(4).max(16) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me, error: meErr } = await supabase
      .from("profiles")
      .select("role, household_id")
      .eq("id", userId)
      .maybeSingle();
    if (meErr) throw meErr;
    if (!me || me.role !== "owner") throw new Error("Only the household owner can add members.");

    const code = data.link_code.toUpperCase().trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target, error: te } = await supabaseAdmin
      .from("profiles")
      .select("id, household_id, full_name, username")
      .eq("link_code", code)
      .maybeSingle();
    if (te) throw te;
    if (!target) throw new Error("No account found with that code.");
    if (target.id === userId) throw new Error("That's your own code.");
    if (target.household_id === me.household_id) throw new Error("That member is already in your household.");

    const oldHousehold = target.household_id;
    const { error: ue } = await supabaseAdmin
      .from("profiles")
      .update({ household_id: me.household_id, role: "member" })
      .eq("id", target.id);
    if (ue) throw ue;

    if (oldHousehold) {
      const { count } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("household_id", oldHousehold);
      if ((count ?? 0) === 0) {
        await supabaseAdmin.from("households").delete().eq("id", oldHousehold);
      }
    }
    return { ok: true, name: target.full_name || target.username };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { profile_id: string }) =>
    z.object({ profile_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("role, household_id")
      .eq("id", userId)
      .maybeSingle();
    if (!me || me.role !== "owner") throw new Error("Only the household owner can remove members.");
    if (data.profile_id === userId) throw new Error("You can't remove yourself.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, household_id, full_name, username")
      .eq("id", data.profile_id)
      .maybeSingle();
    if (!target || target.household_id !== me.household_id) throw new Error("Member not found in your household.");

    // Move to a fresh household of their own
    const invite = Math.random().toString(36).slice(2, 10).toUpperCase();
    const { data: newH, error: hErr } = await supabaseAdmin
      .from("households")
      .insert({
        name: `${target.full_name || target.username}'s household`,
        owner_id: target.id,
        invite_code: invite,
      })
      .select("id")
      .single();
    if (hErr) throw hErr;
    const { error: ue } = await supabaseAdmin
      .from("profiles")
      .update({ household_id: newH.id, role: "owner", account_type: "owner", member_role: null })
      .eq("id", target.id);
    if (ue) throw ue;
    return { ok: true };
  });

export const sendReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { to_profile_id: string; amount: number; note?: string }) =>
    z
      .object({
        to_profile_id: z.string().uuid(),
        amount: z.number().positive().max(1_000_000),
        note: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("role, household_id")
      .eq("id", userId)
      .maybeSingle();
    if (!me || me.role !== "owner") throw new Error("Only the household owner can send rewards.");
    const { error } = await supabase.from("rewards").insert({
      household_id: me.household_id,
      to_profile_id: data.to_profile_id,
      from_profile_id: userId,
      amount: data.amount,
      note: data.note ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

export const addExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { merchant: string; amount: number; category: string; expense_date?: string }) =>
      z
        .object({
          merchant: z.string().trim().min(1).max(120),
          amount: z.number().positive().max(1_000_000),
          category: z.string().trim().min(1).max(40),
          expense_date: z.string().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("role, household_id, account_balance")
      .eq("id", userId)
      .maybeSingle();
    if (!me) throw new Error("Profile not found.");

    // Everyone must have sufficient funds (account balance + rewards − spent − saved)
    const [{ data: rewards }, { data: expenses }, { data: savings }] = await Promise.all([
      supabase.from("rewards").select("amount").eq("to_profile_id", userId),
      supabase.from("expenses").select("amount").eq("profile_id", userId),
      supabase.from("savings").select("amount").eq("profile_id", userId),
    ]);
    const credits = (rewards ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const spent = (expenses ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const saved = (savings ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const balance = Number(me.account_balance ?? 0) + credits - spent - saved;
    if (data.amount > balance) {
      throw new Error(`Insufficient funds. Your available balance is Dh ${balance.toFixed(2)}.`);
    }

    const { error } = await supabase.from("expenses").insert({
      household_id: me.household_id,
      profile_id: userId,
      merchant: data.merchant,
      amount: data.amount,
      category: data.category,
      expense_date: data.expense_date ?? new Date().toISOString().slice(0, 10),
    });
    if (error) throw error;
    return { ok: true };
  });


export const addSaving = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { amount: number; note?: string }) =>
    z
      .object({
        amount: z.number().positive().max(1_000_000),
        note: z.string().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("role, household_id, account_balance")
      .eq("id", userId)
      .maybeSingle();
    if (!me) throw new Error("Profile not found.");

    if (me.role === "member") {
      const [{ data: rewards }, { data: expenses }, { data: savings }] = await Promise.all([
        supabase.from("rewards").select("amount").eq("to_profile_id", userId),
        supabase.from("expenses").select("amount").eq("profile_id", userId),
        supabase.from("savings").select("amount").eq("profile_id", userId),
      ]);
      const credits = (rewards ?? []).reduce((a, r) => a + Number(r.amount), 0);
      const spent = (expenses ?? []).reduce((a, r) => a + Number(r.amount), 0);
      const saved = (savings ?? []).reduce((a, r) => a + Number(r.amount), 0);
      const balance = Number(me.account_balance ?? 0) + credits - spent - saved;
      if (data.amount > balance) {
        throw new Error(`Insufficient funds. Your balance is Dh ${balance.toFixed(2)}.`);
      }
    }

    const { error } = await supabase.from("savings").insert({
      household_id: me.household_id,
      profile_id: userId,
      amount: data.amount,
      note: data.note ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

export const updateHouseholdBudget = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { savings_goal?: number | null; savings_goal_name?: string | null; monthly_budget?: number | null; currency?: string | null }) =>
      z
        .object({
          savings_goal: z.number().nonnegative().nullable().optional(),
          savings_goal_name: z.string().max(80).nullable().optional(),
          monthly_budget: z.number().nonnegative().nullable().optional(),
          currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("profiles")
      .select("role, household_id")
      .eq("id", userId)
      .maybeSingle();
    if (!me || me.role !== "owner") throw new Error("Only the household owner can update budgets.");
    const patch: { savings_goal?: number | null; savings_goal_name?: string | null; monthly_budget?: number | null; currency?: string } = {};
    if (data.savings_goal !== undefined) patch.savings_goal = data.savings_goal;
    if (data.savings_goal_name !== undefined) patch.savings_goal_name = data.savings_goal_name;
    if (data.monthly_budget !== undefined) patch.monthly_budget = data.monthly_budget;
    if (data.currency) patch.currency = data.currency;
    const { error } = await supabase.from("households").update(patch).eq("id", me.household_id);
    if (error) throw error;
    return { ok: true };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { full_name?: string; username?: string; avatar_url?: string | null }) =>
      z
        .object({
          full_name: z.string().trim().min(1).max(80).optional(),
          username: z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9_]{3,24}$/)
            .optional(),
          avatar_url: z.string().url().nullable().optional(),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: { full_name?: string; username?: string; avatar_url?: string | null } = {};
    if (data.full_name !== undefined) patch.full_name = data.full_name;
    if (data.username !== undefined) patch.username = data.username;
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    if (error) {
      if (error.code === "23505") throw new Error("That username is already taken.");
      throw error;
    }
    return { ok: true };
});

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { account_type: "owner" | "member"; gender: "male" | "female"; member_role?: string; account_balance: number }) =>
      z
        .object({
          account_type: z.enum(["owner", "member"]),
          gender: z.enum(["male", "female"]),
          member_role: z.string().trim().min(1).max(40).optional(),
          account_balance: z.number().nonnegative().max(100_000_000),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        account_type: data.account_type,
        gender: data.gender,
        role: data.account_type,
        member_role: data.account_type === "member" ? data.member_role ?? null : null,
        account_balance: data.account_balance,
        onboarded: true,
      })
      .eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });
