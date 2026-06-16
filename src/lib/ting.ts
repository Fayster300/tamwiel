// WebAudio "ting" — short bell sound, no asset required.
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function ting() {
  const ac = getCtx();
  if (!ac) return;
  try {
    const now = ac.currentTime;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(1320, now);
    o.frequency.exponentialRampToValueAtTime(880, now + 0.25);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.3, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    o.connect(g).connect(ac.destination);
    o.start(now);
    o.stop(now + 0.65);
  } catch {
    /* ignore */
  }
}
