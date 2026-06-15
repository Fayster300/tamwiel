import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

export function Preloader({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const tl = gsap.timeline();
    const progress = { v: 0 };
    tl.to(progress, {
      v: 100,
      duration: 2,
      ease: "power2.out",
      onUpdate: () => {
        setPct(Math.round(progress.v));
        if (bar.current) bar.current.style.width = `${progress.v}%`;
      },
    });
    tl.to(bar.current, { opacity: 0, duration: 0.4, ease: "power1.out" }, ">0.1");
    tl.to(root.current, {
      scale: 0.95,
      opacity: 0,
      duration: 0.6,
      ease: "power2.inOut",
      onComplete: () => {
        setHidden(true);
        onDone();
      },
    });
    return () => { tl.kill(); };
  }, [onDone]);

  if (hidden) return null;

  return (
    <div
      ref={root}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background"
      style={{ background: "radial-gradient(ellipse at center, oklch(0.32 0.12 320) 0%, oklch(0.16 0.05 295) 70%)" }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 size-96 rounded-full bg-neon opacity-30 blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 size-96 rounded-full bg-aurora opacity-30 blur-3xl animate-float" style={{ animationDelay: "1s" }} />
      </div>

      <div className="text-6xl mb-2 animate-float">🌟</div>
      <h1
        className="animate-logo-pulse text-4xl md:text-5xl font-bold tracking-tight relative z-10"
        style={{
          background: "linear-gradient(135deg, oklch(0.85 0.2 40), oklch(0.78 0.18 195))",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        Tamwil
      </h1>
      <p className="mt-3 text-xs uppercase tracking-[0.4em] text-muted-foreground relative z-10">
        Family Financial Tracker
      </p>


      <div className="mt-10 w-[min(420px,80vw)] relative z-10">
        <div className="h-[3px] w-full rounded-full bg-white/5 overflow-hidden">
          <div
            ref={bar}
            className="h-full rounded-full"
            style={{
              width: "0%",
              background: "linear-gradient(90deg, oklch(0.78 0.2 235), oklch(0.7 0.25 295))",
              boxShadow: "0 0 20px oklch(0.78 0.2 235 / 0.8)",
            }}
          />
        </div>
        <div className="mt-3 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>Loading workspace</span>
          <span>{pct}%</span>
        </div>
      </div>
    </div>
  );
}
