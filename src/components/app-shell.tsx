import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { Preloader } from "./preloader";
import { OnboardingModal } from "./onboarding-modal";
import { BolaChatbot } from "./chatbot";
import { Floating3D } from "./floating-3d";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/use-profile";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import avatarMale from "@/assets/avatar-male.png";
import avatarFemale from "@/assets/avatar-female.png";
import {
  LayoutDashboard,
  Receipt,
  Sparkles,
  Users,
  Menu,
  X,
  Search,
  Bell,
  LogOut,
  Copy,
  User,
  Crown,
  PiggyBank,
  Zap,
} from "lucide-react";

const links = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/expenses", label: "Expenses", icon: Receipt },
  { to: "/savings", label: "Savings", icon: PiggyBank },
  { to: "/insights", label: "AI Insights", icon: Sparkles },
  { to: "/automation", label: "Automation", icon: Zap },
  { to: "/family", label: "Family Hub", icon: Users },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const main = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function copyLinkCode() {
    const code = profile?.link_code;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => toast.success("Your link code copied", { description: code }));
  }

  const initials = (profile?.full_name || profile?.username || "AR")
    .split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    if (!loading && main.current) {
      gsap.fromTo(
        main.current,
        { opacity: 0, filter: "blur(10px)" },
        { opacity: 1, filter: "blur(0px)", duration: 0.9, ease: "power2.out" },
      );
    }
  }, [loading]);

  useEffect(() => { setMobileOpen(false); setMenuOpen(false); }, [loc.pathname]);

  // close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handler(e: MouseEvent) {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-user-menu]")) setMenuOpen(false);
    }
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [menuOpen]);

  return (
    <>
      {loading && <Preloader onDone={() => setLoading(false)} />}

      <div ref={main} style={{ opacity: loading ? 0 : undefined }} className="min-h-screen relative">
        <Floating3D />

        <div className="relative flex min-h-screen">
          {/* Desktop sidebar */}
          <aside className="hidden sm:flex w-56 lg:w-64 shrink-0 flex-col gap-2 p-4 lg:p-5 border-r border-border/60 backdrop-blur-xl bg-background/30 sticky top-0 h-screen">
            <Brand />
            <nav className="mt-6 flex flex-col gap-1">
              {links.map((l) => {
                const active = isActive(loc.pathname, l.to);
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      active
                        ? "bg-neon text-primary-foreground shadow-glow"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                  >
                    <l.icon className={`size-4 ${active ? "" : "group-hover:scale-110 transition"}`} />
                    {l.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto glass rounded-2xl p-4">
              {profile ? (
                <>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Your link code</div>
                  <button onClick={copyLinkCode} className="mt-1 w-full flex items-center justify-between gap-2 text-sm font-mono font-semibold hover:text-primary transition">
                    <span className="tracking-widest">{profile.link_code}</span>
                    <Copy className="size-3.5 opacity-60" />
                  </button>
                  <div className="text-[10px] text-muted-foreground mt-1.5 truncate flex items-center gap-1">
                    {profile.role === "owner" && <Crown className="size-3 text-warning" />}
                    {profile.household?.name}
                  </div>
                  {profile.role !== "owner" && (
                    <p className="text-[10px] text-info mt-2 leading-snug">
                      Use this code to ask the household owner to add you to their family dashboard.
                    </p>
                  )}
                </>
              ) : (
                <div className="text-xs text-muted-foreground">Loading…</div>
              )}
            </div>
          </aside>

          {/* Mobile drawer */}
          <div
            className={`sm:hidden fixed inset-0 z-50 transition-opacity ${mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          >
            <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" onClick={() => setMobileOpen(false)} />
            <div
              className={`absolute inset-y-0 left-0 w-72 p-6 border-r border-border bg-background/90 backdrop-blur-2xl transition-transform ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
            >
              <div className="flex items-center justify-between">
                <Brand />
                <button onClick={() => setMobileOpen(false)} className="size-9 rounded-lg glass flex items-center justify-center">
                  <X className="size-4" />
                </button>
              </div>
              <nav className="mt-8 flex flex-col gap-1">
                {links.map((l) => {
                  const active = isActive(loc.pathname, l.to);
                  return (
                    <Link
                      key={l.to}
                      to={l.to}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium ${active ? "bg-neon text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-white/5"}`}
                    >
                      <l.icon className="size-4" />
                      {l.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main */}
          <div className="flex-1 min-w-0">
            <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/40 border-b border-border/60">
              <div className="flex items-center gap-3 px-5 md:px-8 py-3.5">
                <button onClick={() => setMobileOpen(true)} className="sm:hidden size-9 rounded-lg glass flex items-center justify-center">
                  <Menu className="size-4" />
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => toast.info("No new notifications", { description: "You're all caught up." })}
                  className="relative size-9 rounded-lg glass flex items-center justify-center hover:scale-105 transition"
                >
                  <Bell className="size-4" />
                  <span className="absolute top-2 right-2 size-1.5 rounded-full bg-neon" />
                </button>

                {/* User menu */}
                <div className="relative" data-user-menu>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                    className="size-9 rounded-full bg-neon shadow-glow flex items-center justify-center text-xs font-bold text-primary-foreground hover:scale-105 transition overflow-hidden"
                  >
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="size-full object-cover" />
                    ) : profile?.gender === "male" ? (
                      <img src={avatarMale} alt="" className="size-full object-cover bg-white" />
                    ) : profile?.gender === "female" ? (
                      <img src={avatarFemale} alt="" className="size-full object-cover bg-white" />
                    ) : (
                      initials
                    )}
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 top-11 w-64 glass rounded-2xl p-2 shadow-2xl border border-white/10 z-40">
                      <div className="px-3 py-2.5 border-b border-white/10">
                        <div className="text-sm font-semibold flex items-center gap-1.5">
                          {profile?.full_name || profile?.username}
                          {profile?.role === "owner" && <Crown className="size-3.5 text-warning" />}
                        </div>
                        <div className="text-[11px] text-muted-foreground">@{profile?.username} · {profile?.role === "owner" ? "Owner" : "Member"}</div>
                      </div>
                      <Link to="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/5 transition">
                        <User className="size-4" /> Profile settings
                      </Link>
                      <button onClick={() => { setMenuOpen(false); copyLinkCode(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-white/5 transition text-left">
                        <Copy className="size-4" /> Copy my link code
                      </button>
                      <button onClick={() => { setMenuOpen(false); signOut(); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-destructive/10 hover:text-destructive transition text-left">
                        <LogOut className="size-4" /> Sign out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </header>

            <main className="px-5 md:px-8 py-8">{children}</main>
          </div>
        </div>
      </div>

      <OnboardingModal />
      <BolaChatbot />
    </>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      <div className="size-10 rounded-2xl bg-neon shadow-glow flex items-center justify-center group-hover:scale-110 transition text-lg font-bold text-primary-foreground">
        🌟
      </div>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-tight">
          <span className="text-gradient">Tamwil</span>
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Family Finance Tracker</div>
      </div>
    </Link>
  );
}

function isActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";
  return pathname.startsWith(to);
}
