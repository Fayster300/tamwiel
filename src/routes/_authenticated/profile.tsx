import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useProfile } from "@/lib/use-profile";
import { useServerFn } from "@tanstack/react-start";
import { updateMyProfile } from "@/lib/household.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Save, User } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My profile · Tamwil · Family Finance" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const save = useServerFn(updateMyProfile);
  const [form, setForm] = useState({ full_name: "", username: "", avatar_url: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        username: profile.username || "",
        avatar_url: profile.avatar_url || "",
      });
    }
  }, [profile]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !profile) return;
    setBusy(true);
    try {
      await save({
        data: {
          full_name: form.full_name.trim() || undefined,
          username: form.username.trim().toLowerCase() || undefined,
          avatar_url: form.avatar_url.trim() ? form.avatar_url.trim() : null,
        },
      });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["household-members"] });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  function copyCode() {
    if (!profile?.link_code) return;
    navigator.clipboard.writeText(profile.link_code);
    toast.success("Link code copied", { description: profile.link_code });
  }

  const initials = (form.full_name || form.username || "?")
    .split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.3em] text-muted-foreground">Account</p>
        <h1 className="text-3xl md:text-4xl font-bold mt-1">My <span className="text-gradient">profile</span></h1>
        <p className="text-sm text-muted-foreground mt-1">Edit your name, username, and avatar.</p>
      </div>

      <div className="glass rounded-3xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your link code</div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-info/15 text-info">Share with household owner</span>
        </div>
        <button onClick={copyCode} className="flex items-center gap-3 text-2xl font-mono font-bold tracking-widest text-gradient hover:opacity-80 transition">
          {profile?.link_code ?? "…"} <Copy className="size-4 opacity-60" />
        </button>
        <p className="text-xs text-muted-foreground mt-2">
          The owner of the household you want to join enters this code on their Family Hub to add you.
        </p>
      </div>

      <form onSubmit={onSave} className="glass rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <div className="size-20 rounded-2xl bg-neon shadow-glow flex items-center justify-center overflow-hidden">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="" className="size-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
              <span className="text-2xl font-bold text-primary-foreground">{initials}</span>
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">{form.full_name || "—"}</div>
            <div className="text-xs text-muted-foreground">@{form.username || "—"} · {profile?.role === "owner" ? "Household owner" : "Member"}</div>
          </div>
        </div>

        <Field label="Full name">
          <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60 transition" />
        </Field>
        <Field label="Username">
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60 transition" />
        </Field>
        <Field label="Avatar URL">
          <input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…" className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60 transition" />
          <div className="text-[11px] text-muted-foreground mt-1">Paste a link to any image. Leave blank to use your initials.</div>
        </Field>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={busy} className="px-4 py-2.5 rounded-xl bg-neon text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition disabled:opacity-50 flex items-center gap-2">
            <Save className="size-4" /> {busy ? "Saving…" : "Save changes"}
          </button>
          <button type="button" onClick={() => navigate({ to: "/" })} className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium flex items-center gap-2">
            <User className="size-4" /> Back to dashboard
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}
