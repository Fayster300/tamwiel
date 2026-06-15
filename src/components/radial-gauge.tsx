import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface Props {
  value: number; // 0-100
  size?: number;
  label?: string;
}

export function RadialGauge({ value, size = 240, label = "Good" }: Props) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // Arc from 135° to 405° (270° sweep)
  const startAngle = 135;
  const endAngle = 405;
  const sweep = endAngle - startAngle;
  const circumference = (Math.PI * 2 * radius * sweep) / 360;

  const arc = useRef<SVGCircleElement>(null);
  const num = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (arc.current) {
      const offset = circumference - (value / 100) * circumference;
      gsap.fromTo(
        arc.current,
        { strokeDashoffset: circumference },
        { strokeDashoffset: offset, duration: 1.8, ease: "power3.out", delay: 0.2 },
      );
    }
    if (num.current) {
      const obj = { v: 0 };
      gsap.to(obj, {
        v: value,
        duration: 1.8,
        ease: "power3.out",
        delay: 0.2,
        onUpdate: () => { if (num.current) num.current.textContent = String(Math.round(obj.v)); },
      });
    }
  }, [value, circumference]);

  // Convert sweep arc into stroke-dasharray on a full circle
  // Rotate so gap is at the bottom
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-[135deg]">
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="oklch(0.78 0.2 235)" />
            <stop offset="50%" stopColor="oklch(0.7 0.22 265)" />
            <stop offset="100%" stopColor="oklch(0.62 0.27 295)" />
          </linearGradient>
          <filter id="gauge-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="oklch(1 0 0 / 0.07)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${Math.PI * 2 * radius}`}
        />
        {/* Value arc */}
        <circle
          ref={arc}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="url(#gauge-grad)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${Math.PI * 2 * radius}`}
          filter="url(#gauge-glow)"
        />
        {/* Tick marks */}
        {Array.from({ length: 11 }).map((_, i) => {
          const angle = (sweep / 10) * i;
          const rad = (angle * Math.PI) / 180;
          const r1 = radius - stroke / 2 - 6;
          const r2 = radius - stroke / 2 - 12;
          return (
            <line
              key={i}
              x1={cx + Math.cos(rad) * r1}
              y1={cy + Math.sin(rad) * r1}
              x2={cx + Math.cos(rad) * r2}
              y2={cy + Math.sin(rad) * r2}
              stroke="oklch(1 0 0 / 0.25)"
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Health</div>
        <div ref={num} className="text-6xl font-bold text-gradient leading-none mt-1">0</div>
        <div className="text-sm font-semibold mt-2 text-foreground/90">{label}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5">/ 100</div>
      </div>
    </div>
  );
}
