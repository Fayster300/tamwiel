import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, LogIn, UserPlus } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in · Tamwil · Family Finance" }] }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

type Mode = "signin" | "signup";

function usernameToEmail(u: string) {
  return `${u.toLowerCase().trim()}@finai.local`;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", fullName: "" });

  function up<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const username = form.username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
      toast.error("Username must be 3–24 chars: letters, numbers, underscore.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: usernameToEmail(username),
          password: form.password,
        });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/" });
      } else {
        if (!form.fullName.trim()) {
          toast.error("Please enter your full name.");
          setBusy(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: usernameToEmail(username),
          password: form.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: form.fullName.trim(),
              username,
            },
          },
        });
        if (error) {
          if (error.message?.toLowerCase().includes("already")) {
            throw new Error("That username is already taken.");
          }
          throw error;
        }
        toast.success("Account created!");
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md glass rounded-3xl p-7 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 size-64 rounded-full bg-neon opacity-25 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="size-10 rounded-xl bg-neon shadow-glow flex items-center justify-center">
              <Sparkles className="size-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight">
                <span className="text-gradient">Tamwil</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Family Finance Tracker</div>
            </div>
          </div>
          <h1 className="text-2xl font-bold mt-5">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin"
              ? "Sign in to your family workspace."
              : "Every new account gets a unique link code. Share it with your household owner to be added — or stay solo and run your own household."}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/5">
            <Tab active={mode === "signin"} onClick={() => setMode("signin")}><LogIn className="size-3.5" /> Sign in</Tab>
            <Tab active={mode === "signup"} onClick={() => setMode("signup")}><UserPlus className="size-3.5" /> Sign up</Tab>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
            {mode === "signup" && (
              <Field label="Full name">
                <input required value={form.fullName} onChange={(e) => up("fullName", e.target.value)} placeholder="e.g. Aisha Rahman" className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60 transition" />
              </Field>
            )}
            <Field label="Username">
              <input required value={form.username} onChange={(e) => up("username", e.target.value)} placeholder="e.g. aisha_r" autoComplete="username" className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60 transition" />
            </Field>
            <Field label="Password">
              <input required type="password" value={form.password} onChange={(e) => up("password", e.target.value)} placeholder="At least 6 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60 transition" />
            </Field>

            <button type="submit" disabled={busy} className="w-full mt-2 px-4 py-3 rounded-xl bg-neon text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition disabled:opacity-50 disabled:hover:scale-100">
              {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Tab({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition ${active ? "bg-neon text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}>
      {children}
    </button>
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
