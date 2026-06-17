import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ProfileWithHousehold {
  id: string;
  full_name: string;
  username: string;
  role: "owner" | "member";
  household_id: string;
  link_code: string;
  avatar_url: string | null;
  gender: "male" | "female" | null;
  member_role: string | null;
  account_type: "owner" | "member";
  onboarded: boolean;
  account_balance: number;
  household: {
    id: string;
    name: string;
    invite_code: string;
    owner_id: string;
    savings_goal: number | null;
    savings_goal_name: string | null;
    monthly_budget: number | null;
    currency: string | null;
  } | null;
}

export function useProfile() {
  return useQuery<ProfileWithHousehold | null>({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, role, household_id, link_code, avatar_url, gender, member_role, account_type, onboarded, account_balance, household:households(id, name, invite_code, owner_id, savings_goal, savings_goal_name, monthly_budget, currency)",
        )
        .eq("id", userRes.user.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ProfileWithHousehold;
    },
  });
}

export interface HouseholdMember {
  id: string;
  full_name: string;
  username: string;
  role: "owner" | "member";
  link_code: string;
  avatar_url: string | null;
  gender: "male" | "female" | null;
  member_role: string | null;
  account_balance: number;
}

export function useHouseholdMembers(householdId: string | undefined) {
  return useQuery<HouseholdMember[]>({
    enabled: !!householdId,
    queryKey: ["household-members", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, role, link_code, avatar_url, gender, member_role, account_balance")
        .eq("household_id", householdId!)
        .order("role", { ascending: true });
      if (error) throw error;
      return (data ?? []) as HouseholdMember[];
    },
  });
}


export interface Reward {
  id: string;
  amount: number;
  note: string | null;
  to_profile_id: string;
  from_profile_id: string;
  created_at: string;
}

export function useRewards(householdId: string | undefined) {
  return useQuery<Reward[]>({
    enabled: !!householdId,
    queryKey: ["rewards", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards")
        .select("id, amount, note, to_profile_id, from_profile_id, created_at")
        .eq("household_id", householdId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Reward[];
    },
  });
}

export interface Goal {
  id: string;
  profile_id: string;
  name: string;
  target: number;
  saved: number;
  created_at: string;
}

export function useHouseholdGoals(householdId: string | undefined) {
  return useQuery<Goal[]>({
    enabled: !!householdId,
    queryKey: ["goals", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("goals")
        .select("id, profile_id, name, target, saved, created_at")
        .eq("household_id", householdId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Goal[];
    },
  });
}

export interface DbExpense {
  id: string;
  household_id: string;
  profile_id: string;
  merchant: string;
  category: string;
  amount: number;
  expense_date: string;
  created_at: string;
}

export function useHouseholdExpenses(householdId: string | undefined) {
  return useQuery<DbExpense[]>({
    enabled: !!householdId,
    queryKey: ["expenses", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, household_id, profile_id, merchant, category, amount, expense_date, created_at")
        .eq("household_id", householdId!)
        .order("expense_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbExpense[];
    },
  });
}

export interface DbSaving {
  id: string;
  household_id: string;
  profile_id: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export function useHouseholdSavings(householdId: string | undefined) {
  return useQuery<DbSaving[]>({
    enabled: !!householdId,
    queryKey: ["savings", householdId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("savings")
        .select("id, household_id, profile_id, amount, note, created_at")
        .eq("household_id", householdId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DbSaving[];
    },
  });
}
