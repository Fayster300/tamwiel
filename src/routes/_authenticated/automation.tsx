import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  Zap, CheckCircle2, Clock, Receipt, Bolt, Wifi, Droplet, Home,
  ArrowRight, Play, Pause, RotateCcw, Sparkles, Calendar, Shield,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_authenticated/automation")({
  head: () => ({ meta: [{ title: "Automation Demo · Tamwil · Family Finance" }] }),
  component: AutomationDemo,
});

type Bill = { id: string; name: string; amount: number; due: string; icon: React.ElementType; status: "scheduled" | "processing" | "paid" };

const initialBills: Bill[] = [
  { id: "rent", name: "Skyline Apartments (Rent)", amount: 4500, due: "1st", icon: Home, status: "scheduled" },
  { id: "elec", name: "PowerCo (Electricity)", amount: 320, due: "5th", icon: Bolt, status: "scheduled" },
  { id: "water", name: "WaterWorks", amount: 95, due: "5th", icon: Droplet, status: "scheduled" },
  { id: "net", name: "FiberNet (Internet)", amount: 180, due: "10th", icon: Wifi, status: "scheduled" },
];

function AutomationDemo() {
  return (
    <div className="space-y-10">
      <Hero />
      <AutoBillSection />
      <SafetySection />
    </div>
  );
}

function Hero() {
  return (
    <div className="glass rounded-3xl p-6 md:p-10 relative overflow-hidden">
      <div className="absolute -top-20 -right-20 size-72 rounded-full bg-neon opacity-20 blur-3xl pointer-events-none" />
      <div className="relative">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase tracking-widest bg-accent/20 border border-accent/30 text-accent-foreground">
          <Sparkles className="size-3" /> Tamwil Automation
        </div>
        <h1 className="text-3xl md:text-5xl font-bold mt-3">
          Set it once. <span className="text-gradient">We handle the rest.</span>
        </h1>
        <p className="text-sm md:text-base text-muted-foreground mt-3 max-w-2xl">
          Watch how Tamwil's automatic bill payments and tax calculations work — step by step, with sample family data. No more late fees, no more tax-day panic.
        </p>
      </div>
    </div>
  );
}

// ============== Auto Bill Pay ==============
function AutoBillSection() {
  const [bills, setBills] = useState<Bill[]>(initialBills);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useState(0);
  const total = bills.reduce((a, b) => a + b.amount, 0);
  const paid = bills.filter((b) => b.status === "paid").reduce((a, b) => a + b.amount, 0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reset() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setBills(initialBills.map((b) => ({ ...b })));
    setStep(0);
    setPlaying(false);
  }

  useEffect(() => {
    if (!playing) return;
    if (step >= bills.length) { setPlaying(false); return; }
    setBills((bs) => bs.map((b, i) => (i === step ? { ...b, status: "processing" } : b)));
    timeoutRef.current = setTimeout(() => {
      setBills((bs) => bs.map((b, i) => (i === step ? { ...b, status: "paid" } : b)));
      setStep((s) => s + 1);
    }, 1100);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, [playing, step, bills.length]);

  const monthlyHistory = [
    { m: "Jul", auto: 5095, manual: 0 },
    { m: "Aug", auto: 5095, manual: 0 },
    { m: "Sep", auto: 5095, manual: 0 },
    { m: "Oct", auto: 5095, manual: 0 },
    { m: "Nov", auto: 5095, manual: 0 },
    { m: "Dec", auto: 5095, manual: 0 },
  ];

  return (
    <section className="space-y-5">
      <SectionHeader
        icon={<Receipt className="size-5" />}
        title="Automatic Bill Payment System"
        subtitle="Tamwil checks your scheduled bills daily, holds the money aside, and pays each one on its due date — automatically."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Workflow */}
        <Card className="lg:col-span-2">
          <CardHeader title="Live demo: December payments" right={
            <div className="flex gap-2">
              <button onClick={() => setPlaying((p) => !p)} className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5">
                {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                {playing ? "Pause" : "Run automation"}
              </button>
              <button onClick={reset} className="px-3 py-1.5 rounded-xl glass text-xs inline-flex items-center gap-1.5">
                <RotateCcw className="size-3.5" /> Reset
              </button>
            </div>
          } />

          <Steps current={step} total={bills.length} />

          <div className="mt-4 space-y-2">
            {bills.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  b.status === "paid" ? "bg-success/10 border-success/30" :
                  b.status === "processing" ? "bg-info/10 border-info/40 animate-pulse" :
                  "bg-white/5 border-white/10"
                }`}>
                  <div className="size-10 rounded-xl bg-white/10 flex items-center justify-center"><Icon className="size-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{b.name}</div>
                    <div className="text-[11px] text-muted-foreground">Due {b.due} of month · AED {b.amount.toLocaleString()}</div>
                  </div>
                  <div className="text-xs font-semibold inline-flex items-center gap-1.5">
                    {b.status === "scheduled" && (<><Clock className="size-3.5 text-muted-foreground" /> Scheduled</>)}
                    {b.status === "processing" && (<><Bolt className="size-3.5 text-info" /> Paying…</>)}
                    {b.status === "paid" && (<><CheckCircle2 className="size-3.5 text-success" /> Paid</>)}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* KPI */}
        <Card>
          <CardHeader title="This month" />
          <div className="space-y-3 mt-2">
            <Stat label="Bills scheduled" value={`AED ${total.toLocaleString()}`} />
            <Stat label="Auto-paid so far" value={`AED ${paid.toLocaleString()}`} tone="ok" />
            <Stat label="Pending" value={`AED ${(total - paid).toLocaleString()}`} />
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-success to-secondary transition-all" style={{ width: `${(paid / total) * 100}%` }} />
            </div>
            <p className="text-[11px] text-muted-foreground">Late-fee savings estimated this month: <span className="text-success font-semibold">AED 75</span></p>
          </div>
        </Card>
      </div>

      {/* History chart */}
      <Card>
        <CardHeader title="6-month auto-pay history" subtitle="100% on-time rate · zero late fees" />
        <div className="h-56 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyHistory}>
              <CartesianGrid stroke="oklch(1 0 0 / 0.08)" />
              <XAxis dataKey="m" stroke="oklch(0.85 0 0)" fontSize={11} />
              <YAxis stroke="oklch(0.85 0 0)" fontSize={11} />
              <Tooltip contentStyle={{ background: "oklch(0.22 0.05 270)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: 12 }} />
              <Bar dataKey="auto" name="Auto-paid" fill="oklch(0.78 0.2 145)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <FlowDiagram
        steps={[
          { icon: Calendar, label: "Schedule bill", note: "Add the merchant, amount and due date once." },
          { icon: Shield, label: "Funds reserved", note: "Tamwil holds the amount aside 2 days early." },
          { icon: Bolt, label: "Auto-pay on due date", note: "Payment is sent on the exact due day." },
          { icon: CheckCircle2, label: "Receipt logged", note: "Transaction added to your expenses automatically." },
        ]}
      />
    </section>
  );
}


function SafetySection() {
  return (
    <section className="glass rounded-3xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      <Safety icon={<Shield className="size-5" />} title="Always opt-in" body="You approve each automation. Pause or change anytime." />
      <Safety icon={<Zap className="size-5" />} title="Real-time alerts" body="A friendly push notification before any payment is made." />
      <Safety icon={<CheckCircle2 className="size-5" />} title="Full audit trail" body="Every automatic move is recorded for parents and members." />
    </section>
  );
}

// ============== Bits ==============
function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" });
  }, []);
  return (
    <div ref={ref}>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/15 border border-secondary/30 text-secondary-foreground text-[10px] uppercase tracking-widest">{icon} Demo</div>
      <h2 className="text-2xl md:text-3xl font-bold mt-2">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>
    </div>
  );
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`glass rounded-3xl p-5 ${className}`}>{children}</div>;
}
function CardHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${tone === "ok" ? "text-success" : ""}`}>{value}</div>
    </div>
  );
}
function MiniStat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-sm font-bold mt-1 ${tone === "warn" ? "text-warning" : ""}`}>{value}</div>
    </div>
  );
}
function Steps({ current, total }: { current: number; total: number }) {
  return (
    <div className="mt-4 flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i < current ? "bg-success" : i === current ? "bg-info animate-pulse" : "bg-white/10"}`} />
      ))}
    </div>
  );
}
function FlowDiagram({ steps }: { steps: { icon: React.ElementType; label: string; note: string }[] }) {
  return (
    <div className="glass rounded-3xl p-5">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="relative flex flex-col items-center text-center p-4 rounded-2xl bg-white/5 border border-white/10">
              <div className="size-12 rounded-2xl bg-neon shadow-glow flex items-center justify-center text-primary-foreground">
                <Icon className="size-5" />
              </div>
              <div className="font-semibold text-sm mt-3">{s.label}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{s.note}</div>
              {i < steps.length - 1 && (
                <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground/50" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
function Safety({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="size-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent-foreground">{icon}</div>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{body}</div>
      </div>
    </div>
  );
}
