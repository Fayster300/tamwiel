import { useState, useMemo } from "react";
import { useProfile } from "@/lib/use-profile";
import { useServerFn } from "@tanstack/react-start";
import { updateHouseholdBudget, completeOnboarding } from "@/lib/household.functions";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Target, Wallet, Sparkles, Crown, Users, Copy, Check, Banknote, Globe, Search } from "lucide-react";
import avatarMale from "@/assets/avatar-male.png";
import avatarFemale from "@/assets/avatar-female.png";
import { Dh } from "@/components/dh";
import { COUNTRIES, currencySymbol, type CountryEntry } from "@/lib/currency";

const MEMBER_ROLES = ["Mom", "Dad", "Child", "Teen", "Grandparent", "Sibling", "Other"];

export function OnboardingModal() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const saveBudget = useServerFn(updateHouseholdBudget);
  const finishOnboarding = useServerFn(completeOnboarding);

  // Steps:
  // 0 account type, 1 gender, 2 member role (member only),
  // 7 owner country (new), 3 owner goal, 4 owner monthly budget,
  // 5 balance (both), 6 member done
  const [step, setStep] = useState(0);
  const [accountType, setAccountType] = useState<"owner" | "member" | null>(null);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [memberRole, setMemberRole] = useState<string>("");
  const [country, setCountry] = useState<CountryEntry | null>(null);
  const [countryQuery, setCountryQuery] = useState("");
  const [goalName, setGoalName] = useState("");
  const [goalAmt, setGoalAmt] = useState("");
  const [budget, setBudget] = useState("");
  const [balance, setBalance] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!profile) return null;

  const needsIdentity = !profile.onboarded;
  const ownerNeedsBudget = profile.onboarded && profile.role === "owner" && profile.household?.savings_goal == null;
  if (!needsIdentity && !ownerNeedsBudget) return null;

  // If owner only needs the budget portion, jump straight to step 3
  const effectiveStep = needsIdentity ? step : Math.max(step, 3);

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.currency.toLowerCase().includes(q));
  }, [countryQuery]);

  async function saveIdentity(type: "owner" | "member", bal: number) {
    setBusy(true);
    try {
      await finishOnboarding({
        data: {
          account_type: type,
          gender: gender!,
          member_role: type === "member" ? memberRole || "Member" : undefined,
          account_balance: bal,
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  async function next() {
    if (effectiveStep === 0) {
      if (!accountType) return toast.error("Pick one to continue.");
      setStep(1);
      return;
    }
    if (effectiveStep === 1) {
      if (!gender) return toast.error("Pick your avatar to continue.");
      if (accountType === "member") setStep(2);
      else setStep(7); // owner → country picker
      return;
    }
    if (effectiveStep === 2) {
      if (!memberRole) return toast.error("Pick your role in the household.");
      setStep(5);
      return;
    }
    if (effectiveStep === 7) {
      if (!country) return toast.error("Pick your country to set the currency.");
      setStep(3);
      return;
    }
    if (effectiveStep === 3) {
      const amt = parseFloat(goalAmt);
      if (!goalName.trim() || isNaN(amt) || amt <= 0) return toast.error("Add a name and positive amount for your savings goal.");
      setStep(4);
      return;
    }
    if (effectiveStep === 4) {
      const b = parseFloat(budget);
      if (isNaN(b) || b <= 0) return toast.error("Add a positive monthly budget.");
      setStep(5);
      return;
    }
    if (effectiveStep === 5) {
      const bal = parseFloat(balance);
      if (isNaN(bal) || bal < 0) return toast.error("Enter your current account balance (0 or more).");
      const effectiveRole: "owner" | "member" =
        needsIdentity ? (accountType ?? "owner") : (profile?.role ?? "owner");
      setBusy(true);
      try {
        if (effectiveRole === "owner") {
          if (needsIdentity) {
            await saveIdentity("owner", bal);
          } else {
            await finishOnboarding({
              data: {
                account_type: "owner",
                gender: (profile?.gender as "male" | "female") ?? "male",
                account_balance: bal,
              },
            });
          }
          const goalAmtNum = parseFloat(goalAmt);
          const budgetNum = parseFloat(budget);
          await saveBudget({
            data: {
              savings_goal: isNaN(goalAmtNum) ? null : goalAmtNum,
              savings_goal_name: goalName.trim() || null,
              monthly_budget: isNaN(budgetNum) ? null : budgetNum,
              currency: country?.currency ?? null,
            },
          });
          toast.success("Household setup complete!");
          qc.invalidateQueries({ queryKey: ["profile"] });
        } else {
          await saveIdentity("member", bal);
          setStep(6);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save.");
      } finally {
        setBusy(false);
      }
      return;
    }
  }

  function copyCode() {
    if (!profile?.link_code) return;
    navigator.clipboard.writeText(profile.link_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const isMember = accountType === "member";
  const totalSteps = isMember ? 4 : 6; // owner now has country step
  const progressIndex = (() => {
    if (effectiveStep <= 1) return effectiveStep + 1;
    if (effectiveStep === 2) return 3; // member role
    if (effectiveStep === 7) return 3; // owner country
    if (effectiveStep === 3) return 4; // owner goal
    if (effectiveStep === 4) return 5; // owner budget
    if (effectiveStep === 5) return isMember ? 4 : 6; // balance
    return totalSteps;
  })();
  const isFinalInput = effectiveStep === 5;
  const isDoneScreen = effectiveStep === 6;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-background/85 backdrop-blur-xl">
      <div className="glass rounded-3xl p-7 w-full max-w-lg relative overflow-hidden">
        <div className="absolute -top-24 -right-24 size-64 rounded-full bg-neon opacity-25 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="size-10 rounded-xl bg-neon shadow-glow flex items-center justify-center">
              <Sparkles className="size-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Welcome, {profile.full_name || profile.username}
              </p>
              <h2 className="text-xl font-bold">Let's set up your account</h2>
            </div>
          </div>

          {!isDoneScreen && (
            <div className="flex gap-1 mt-4 mb-5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div key={i} className={`flex-1 h-1 rounded-full ${i < progressIndex ? "bg-neon" : "bg-white/10"}`} />
              ))}
            </div>
          )}

          {effectiveStep === 0 && (
            <div>
              <h3 className="font-semibold mb-1">Are you the household owner or a member?</h3>
              <p className="text-sm text-muted-foreground mb-4">Owners set budgets and rewards. Members track their own goals and expenses.</p>
              <div className="grid grid-cols-2 gap-3">
                <PickCard active={accountType === "owner"} onClick={() => setAccountType("owner")} icon={<Crown className="size-5 text-warning" />} title="Household owner" subtitle="Run the family dashboard" />
                <PickCard active={accountType === "member"} onClick={() => setAccountType("member")} icon={<Users className="size-5 text-info" />} title="Household member" subtitle="Join an existing family" />
              </div>
            </div>
          )}

          {effectiveStep === 1 && (
            <div>
              <h3 className="font-semibold mb-1">Pick your profile avatar</h3>
              <p className="text-sm text-muted-foreground mb-4">You can replace it any time from your profile page.</p>
              <div className="grid grid-cols-2 gap-3">
                <AvatarPick active={gender === "male"} onClick={() => setGender("male")} src={avatarMale} label="Male" />
                <AvatarPick active={gender === "female"} onClick={() => setGender("female")} src={avatarFemale} label="Female" />
              </div>
            </div>
          )}

          {effectiveStep === 2 && (
            <div>
              <h3 className="font-semibold mb-1">What's your role in the household?</h3>
              <p className="text-sm text-muted-foreground mb-4">This helps the owner recognize you.</p>
              <div className="flex flex-wrap gap-2">
                {MEMBER_ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setMemberRole(r)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${memberRole === r ? "bg-neon text-primary-foreground border-transparent shadow-glow" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {memberRole === "Other" && (
                <input
                  autoFocus
                  placeholder="Type your role"
                  onChange={(e) => setMemberRole(e.target.value || "Other")}
                  className="mt-3 w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60"
                />
              )}
            </div>
          )}

          {effectiveStep === 7 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Globe className="size-4 text-info" />
                <h3 className="font-semibold">Where is your household based?</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                We'll use this to set your household currency. {country && (
                  <span className="text-foreground font-medium">
                    {country.flag} {country.name} → <span className="text-info">{country.currency}</span> ({currencySymbol(country.currency)})
                  </span>
                )}
              </p>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  autoFocus
                  value={countryQuery}
                  onChange={(e) => setCountryQuery(e.target.value)}
                  placeholder="Search country or currency…"
                  className="w-full pl-9 bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60"
                />
              </div>
              <div className="max-h-72 overflow-auto rounded-xl border border-white/10 bg-white/[0.02]">
                {filteredCountries.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">No match.</div>
                )}
                {filteredCountries.map((c) => {
                  const active = country?.code === c.code;
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setCountry(c)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-left transition border-b border-white/5 last:border-b-0 ${active ? "bg-primary/15 text-foreground" : "hover:bg-white/5"}`}
                    >
                      <span className="flex items-center gap-2"><span className="text-lg leading-none">{c.flag}</span>{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.currency} <span className="text-foreground/70">{currencySymbol(c.currency)}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {effectiveStep === 3 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target className="size-4 text-info" />
                <h3 className="font-semibold">Savings goal</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">What is your household saving toward?</p>
              <Field label="Goal name">
                <input autoFocus value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder="Family vacation, emergency fund…" className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60" />
              </Field>
              <div className="h-3" />
              <Field label={<>Target amount ({country ? currencySymbol(country.currency) : <Dh />})</>}>
                <input value={goalAmt} onChange={(e) => setGoalAmt(e.target.value)} placeholder="5000" inputMode="decimal" className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60" />
              </Field>
            </div>
          )}

          {effectiveStep === 4 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="size-4 text-info" />
                <h3 className="font-semibold">Monthly budget</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">How much can your household spend per month?</p>
              <Field label={<>Monthly budget ({country ? currencySymbol(country.currency) : <Dh />})</>}>
                <input autoFocus value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="8000" inputMode="decimal" className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60" />
              </Field>
            </div>
          )}

          {effectiveStep === 5 && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="size-4 text-success" />
                <h3 className="font-semibold">Current account balance</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                How much money is in your account right now? Expenses you log will be deducted from this balance — you'll get an error if you try to spend more than you have.
              </p>
              <Field label={<>Current balance ({country ? currencySymbol(country.currency) : <Dh />})</>}>
                <input autoFocus value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="1000" inputMode="decimal" className="w-full bg-white/5 rounded-lg px-3 py-2.5 outline-none text-sm border border-white/10 focus:border-primary/60" />
              </Field>
            </div>
          )}

          {isDoneScreen && (
            <div className="text-center">
              <div className="size-16 rounded-2xl bg-neon shadow-glow flex items-center justify-center mx-auto mb-3">
                <Check className="size-8 text-primary-foreground" />
              </div>
              <h3 className="font-semibold text-lg">You're almost in!</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-5">Share the code below with your household owner.</p>
              <button onClick={copyCode} className="w-full glass rounded-2xl p-5 hover:bg-white/[0.04] transition group">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Your unique household code</div>
                <div className="flex items-center justify-center gap-3 text-3xl font-mono font-bold tracking-[0.3em] text-gradient">
                  {profile.link_code}
                  {copied ? <Check className="size-5 text-success" /> : <Copy className="size-5 opacity-50 group-hover:opacity-100 transition" />}
                </div>
              </button>
              <p className="text-sm text-info mt-4 font-medium">
                Use this code to ask the household owner to add you to their family dashboard.
              </p>
            </div>
          )}

          <div className="flex gap-2 mt-6">
            {isDoneScreen ? (
              <button onClick={() => { qc.invalidateQueries({ queryKey: ["profile"] }); }} className="flex-1 px-4 py-2.5 rounded-xl bg-neon text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition">
                Got it
              </button>
            ) : (
              <button onClick={next} disabled={busy} className="flex-1 px-4 py-2.5 rounded-xl bg-neon text-primary-foreground text-sm font-semibold shadow-glow hover:scale-[1.02] transition disabled:opacity-50">
                {busy ? "Saving…" : isFinalInput ? "Finish setup" : "Continue"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PickCard({ active, onClick, icon, title, subtitle }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <button type="button" onClick={onClick} className={`text-left rounded-2xl p-4 border transition ${active ? "border-primary/60 bg-primary/10 shadow-glow" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
      <div className="mb-2">{icon}</div>
      <div className="font-semibold text-sm">{title}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
    </button>
  );
}

function AvatarPick({ active, onClick, src, label }: { active: boolean; onClick: () => void; src: string; label: string }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-2xl p-3 border transition flex flex-col items-center gap-2 ${active ? "border-primary/60 bg-primary/10 shadow-glow" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}>
      <img src={src} alt={label} loading="lazy" width={512} height={512} className="size-24 rounded-2xl object-cover bg-white" />
      <div className="text-sm font-medium">{label}</div>
    </button>
  );
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1.5">{label}</div>
      {children}
    </label>
  );
}
