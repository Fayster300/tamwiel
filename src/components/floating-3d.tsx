import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * Decorative floating 3D shapes (CSS perspective) — playful, kid-friendly background.
 * Positioned fixed behind UI, pointer-events disabled.
 */
export function Floating3D() {
  const cube = useRef<HTMLDivElement>(null);
  const pyramid = useRef<HTMLDivElement>(null);
  const sphere = useRef<HTMLDivElement>(null);
  const coin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t1 = gsap.to(cube.current, {
      rotateY: 360,
      rotateX: 360,
      duration: 18,
      repeat: -1,
      ease: "none",
    });
    const t2 = gsap.to(pyramid.current, {
      rotateY: -360,
      duration: 22,
      repeat: -1,
      ease: "none",
    });
    const t3 = gsap.to(sphere.current, {
      y: -30,
      duration: 4,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    const t4 = gsap.to(coin.current, {
      rotateY: 360,
      duration: 6,
      repeat: -1,
      ease: "none",
    });
    return () => {
      t1.kill();
      t2.kill();
      t3.kill();
      t4.kill();
    };
  }, []);

  return (
    <div
      aria-hidden
      className="fixed inset-0 pointer-events-none overflow-hidden -z-10"
      style={{ perspective: "900px" }}
    >
      {/* Floating cube */}
      <div
        ref={cube}
        className="absolute top-[12%] left-[6%] opacity-70"
        style={{ transformStyle: "preserve-3d", width: 100, height: 100 }}
      >
        <Face style={{ transform: "translateZ(50px)", background: "var(--gradient-neon)" }} />
        <Face style={{ transform: "rotateY(180deg) translateZ(50px)", background: "var(--gradient-aurora)" }} />
        <Face style={{ transform: "rotateY(90deg) translateZ(50px)", background: "oklch(0.85 0.18 70 / 0.9)" }} />
        <Face style={{ transform: "rotateY(-90deg) translateZ(50px)", background: "oklch(0.78 0.2 320 / 0.9)" }} />
        <Face style={{ transform: "rotateX(90deg) translateZ(50px)", background: "oklch(0.82 0.2 195 / 0.9)" }} />
        <Face style={{ transform: "rotateX(-90deg) translateZ(50px)", background: "oklch(0.8 0.2 25 / 0.9)" }} />
      </div>

      {/* Sphere blob */}
      <div
        ref={sphere}
        className="absolute top-[58%] left-[10%] size-32 rounded-full blur-[2px] opacity-60 shadow-glow"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.95 0.1 80), oklch(0.7 0.22 30) 70%)",
        }}
      />

      {/* Pyramid */}
      <div
        ref={pyramid}
        className="absolute top-[20%] right-[8%] opacity-70"
        style={{ transformStyle: "preserve-3d", width: 90, height: 90 }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, oklch(0.85 0.2 195), oklch(0.7 0.22 250))",
            clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
            transform: "rotateY(0deg)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, oklch(0.82 0.22 40), oklch(0.7 0.24 350))",
            clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
            transform: "rotateY(120deg) translateZ(30px)",
          }}
        />
      </div>

      {/* Spinning gold coin */}
      <div
        ref={coin}
        className="absolute bottom-[12%] right-[12%] size-24 rounded-full opacity-80"
        style={{
          transformStyle: "preserve-3d",
          background:
            "radial-gradient(circle at 30% 30%, oklch(0.95 0.18 90), oklch(0.75 0.2 70) 60%, oklch(0.55 0.18 60) 100%)",
          boxShadow: "0 10px 40px oklch(0.75 0.2 70 / 0.6), inset 0 0 20px oklch(1 0 0 / 0.3)",
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-yellow-900 select-none">
          $
        </div>
      </div>
    </div>
  );
}

function Face({ style }: { style: React.CSSProperties }) {
  return (
    <div
      className="absolute inset-0 rounded-xl border border-white/30"
      style={{
        boxShadow: "inset 0 0 20px oklch(1 0 0 / 0.2)",
        ...style,
      }}
    />
  );
}
