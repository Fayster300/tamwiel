import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function logAudit(quest_id: string, household_id: string, actor_id: string, action: string, meta: Record<string, unknown> = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("quest_audit_log").insert({ quest_id, household_id, actor_id, action, meta });
}

export const listQuests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("quests")
      .select("id, household_id, owner_id, assignee_id, title, description, reward, due_date, status, savings_split_pct, submitted_notes, rejection_reason, decided_at, completed_at, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const listQuestProofs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { quest_id: string }) => z.object({ quest_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("quest_proofs")
      .select("id, image_path, created_at")
      .eq("quest_id", data.quest_id)
      .order("created_at", { ascending: true });
    if (error) throw error;
    // sign URLs
    const out: { id: string; url: string; created_at: string }[] = [];
    for (const r of rows ?? []) {
      const { data: sig } = await supabase.storage.from("quest-proofs").createSignedUrl(r.image_path, 60 * 60);
      if (sig?.signedUrl) out.push({ id: r.id, url: sig.signedUrl, created_at: r.created_at });
    }
    return out;
  });

export const listQuestAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("quest_audit_log")
      .select("id, quest_id, actor_id, action, meta, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

export const createQuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; description?: string; reward: number; due_date?: string; assignee_id: string }) =>
    z.object({
      title: z.string().trim().min(1).max(120),
      description: z.string().trim().max(800).optional(),
      reward: z.number().positive().max(1_000_000),
      due_date: z.string().optional(),
      assignee_id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("profiles").select("role, household_id").eq("id", userId).maybeSingle();
    if (!me || me.role !== "owner") throw new Error("Only the household owner can create quests.");
    const { data: target } = await supabase.from("profiles").select("id, household_id").eq("id", data.assignee_id).maybeSingle();
    if (!target || target.household_id !== me.household_id) throw new Error("Assignee must be in your household.");

    const { data: q, error } = await supabase
      .from("quests")
      .insert({
        household_id: me.household_id,
        owner_id: userId,
        assignee_id: data.assignee_id,
        title: data.title,
        description: data.description ?? null,
        reward: data.reward,
        due_date: data.due_date ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    await logAudit(q.id, me.household_id, userId, "created", { title: data.title, reward: data.reward, assignee_id: data.assignee_id });
    return { ok: true, id: q.id };
  });

export const acceptQuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { quest_id: string; savings_split_pct: number }) =>
    z.object({ quest_id: z.string().uuid(), savings_split_pct: z.number().int().min(0).max(100) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: q } = await supabase.from("quests").select("id, assignee_id, household_id, status").eq("id", data.quest_id).maybeSingle();
    if (!q) throw new Error("Quest not found.");
    if (q.assignee_id !== userId) throw new Error("Not your quest.");
    if (q.status !== "pending_acceptance") throw new Error("Quest is no longer pending.");
    const { error } = await supabase
      .from("quests")
      .update({ status: "accepted", savings_split_pct: data.savings_split_pct, decided_at: new Date().toISOString() })
      .eq("id", data.quest_id);
    if (error) throw error;
    await logAudit(q.id, q.household_id, userId, "accepted", { savings_split_pct: data.savings_split_pct });
    return { ok: true };
  });

export const declineQuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { quest_id: string }) => z.object({ quest_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: q } = await supabase.from("quests").select("id, assignee_id, household_id, status").eq("id", data.quest_id).maybeSingle();
    if (!q) throw new Error("Quest not found.");
    if (q.assignee_id !== userId) throw new Error("Not your quest.");
    if (q.status !== "pending_acceptance") throw new Error("Quest is no longer pending.");
    const { error } = await supabase.from("quests").update({ status: "declined", decided_at: new Date().toISOString() }).eq("id", data.quest_id);
    if (error) throw error;
    await logAudit(q.id, q.household_id, userId, "declined");
    return { ok: true };
  });

export const submitQuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { quest_id: string; notes?: string; proofs: { base64: string; mime: string }[] }) =>
    z.object({
      quest_id: z.string().uuid(),
      notes: z.string().max(800).optional(),
      proofs: z.array(z.object({ base64: z.string().min(20), mime: z.string().max(40) })).min(1).max(8),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: q } = await supabase.from("quests").select("id, assignee_id, household_id, status").eq("id", data.quest_id).maybeSingle();
    if (!q) throw new Error("Quest not found.");
    if (q.assignee_id !== userId) throw new Error("Not your quest.");
    if (q.status !== "accepted" && q.status !== "rejected") throw new Error("Cannot submit at this stage.");

    // Upload proofs to storage
    for (const p of data.proofs) {
      const ext = p.mime.includes("png") ? "png" : "jpg";
      const filename = `${q.household_id}/${userId}/${q.id}/${crypto.randomUUID()}.${ext}`;
      const bytes = Buffer.from(p.base64, "base64");
      const { error: ue } = await supabase.storage.from("quest-proofs").upload(filename, bytes, { contentType: p.mime, upsert: false });
      if (ue) throw ue;
      const { error: re } = await supabase.from("quest_proofs").insert({ quest_id: q.id, uploader_id: userId, image_path: filename });
      if (re) throw re;
    }

    const { error: qe } = await supabase
      .from("quests")
      .update({ status: "submitted", submitted_notes: data.notes ?? null, completed_at: new Date().toISOString(), rejection_reason: null })
      .eq("id", data.quest_id);
    if (qe) throw qe;
    await logAudit(q.id, q.household_id, userId, "submitted", { proofs: data.proofs.length });
    return { ok: true };
  });

export const rejectQuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { quest_id: string; reason: string }) =>
    z.object({ quest_id: z.string().uuid(), reason: z.string().trim().min(1).max(400) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("profiles").select("role, household_id").eq("id", userId).maybeSingle();
    if (!me || me.role !== "owner") throw new Error("Only the owner can reject.");
    const { data: q } = await supabase.from("quests").select("id, household_id, status").eq("id", data.quest_id).maybeSingle();
    if (!q || q.household_id !== me.household_id) throw new Error("Quest not found.");
    if (q.status !== "submitted") throw new Error("Quest is not awaiting review.");
    const { error } = await supabase.from("quests").update({ status: "rejected", rejection_reason: data.reason }).eq("id", data.quest_id);
    if (error) throw error;
    await logAudit(q.id, q.household_id, userId, "rejected", { reason: data.reason });
    return { ok: true };
  });

export const approveQuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { quest_id: string }) => z.object({ quest_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase.from("profiles").select("role, household_id, account_balance").eq("id", userId).maybeSingle();
    if (!me || me.role !== "owner") throw new Error("Only the owner can approve.");
    const { data: q } = await supabase
      .from("quests")
      .select("id, household_id, assignee_id, title, reward, savings_split_pct, status")
      .eq("id", data.quest_id)
      .maybeSingle();
    if (!q || q.household_id !== me.household_id) throw new Error("Quest not found.");
    if (q.status !== "submitted") throw new Error("Quest is not awaiting review.");

    // Verify owner balance
    const [{ data: rewards }, { data: expenses }, { data: savings }] = await Promise.all([
      supabase.from("rewards").select("amount").eq("to_profile_id", userId),
      supabase.from("expenses").select("amount").eq("profile_id", userId),
      supabase.from("savings").select("amount").eq("profile_id", userId),
    ]);
    const credits = (rewards ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const spent = (expenses ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const saved = (savings ?? []).reduce((a, r) => a + Number(r.amount), 0);
    const balance = Number(me.account_balance ?? 0) + credits - spent - saved;
    const reward = Number(q.reward);
    if (reward > balance) {
      throw new Error(`Insufficient funds — please add Dh ${(reward - balance).toFixed(2)} before approving.`);
    }

    const pct = Number(q.savings_split_pct ?? 0);
    const savingsAmt = Math.round(reward * pct) / 100;

    // Owner pays: expense from owner
    const { error: oe } = await supabase.from("expenses").insert({
      household_id: q.household_id,
      profile_id: userId,
      merchant: `Quest payout · ${q.title}`,
      amount: reward,
      category: "Education",
      expense_date: new Date().toISOString().slice(0, 10),
    });
    if (oe) throw oe;

    // Assignee receives full reward as credit
    const { error: re } = await supabase.from("rewards").insert({
      household_id: q.household_id,
      to_profile_id: q.assignee_id,
      from_profile_id: userId,
      amount: reward,
      note: `Quest: ${q.title}`,
    });
    if (re) throw re;

    // Move savings portion into savings (decreases spendable by that amount)
    if (savingsAmt > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: se } = await supabaseAdmin.from("savings").insert({
        household_id: q.household_id,
        profile_id: q.assignee_id,
        amount: savingsAmt,
        note: `Quest savings: ${q.title}`,
      });
      if (se) throw se;
    }

    const { error: ue } = await supabase
      .from("quests")
      .update({ status: "approved", completed_at: new Date().toISOString(), rejection_reason: null })
      .eq("id", q.id);
    if (ue) throw ue;
    await logAudit(q.id, q.household_id, userId, "approved", { reward, savings_split_pct: pct });
    return { ok: true, reward, savings: savingsAmt };
  });

export const suggestQuests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { assignee_role?: string; assignee_name?: string }) =>
    z.object({ assignee_role: z.string().max(40).optional(), assignee_name: z.string().max(60).optional() }).parse(d),
  )
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const prompt = `Suggest 5 age-appropriate household quests for ${data.assignee_name ?? "the household member"} whose role is "${data.assignee_role ?? "Member"}". Each should teach financial responsibility, saving, or earning money. Reply ONLY with JSON: {"suggestions":[{"title":"...","description":"...","reward":10}]}. Rewards in AED, between 5 and 100.`;
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You generate fun, practical quest ideas for kids and family members." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`AI error (${res.status})`);
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content ?? "";
    const m = content.match(/\{[\s\S]*\}/);
    if (!m) return { suggestions: [] };
    try {
      const parsed = JSON.parse(m[0]) as { suggestions?: { title: string; description: string; reward: number }[] };
      return { suggestions: (parsed.suggestions ?? []).slice(0, 5) };
    } catch {
      return { suggestions: [] };
    }
  });
