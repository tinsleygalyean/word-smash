import { useMemo } from 'react';
import { C } from '../game/design';

function seeded(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

/** Impact burst at a point: flash + expanding rings + wood chips. §5 */
export function ImpactFX({ x, y, seed }: { x: number; y: number; seed: number }) {
  const chips = useMemo(() => {
    const rand = seeded(seed);
    const n = 8 + Math.floor(rand() * 5); // <= 12
    return Array.from({ length: n }, () => {
      const ang = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.1;
      const dvel = 80 + rand() * 140;
      return {
        cx: Math.cos(ang) * dvel,
        cy: Math.sin(ang) * dvel + 60,
        cr: (rand() - 0.5) * 720,
        cd: 0.55 + rand() * 0.35,
        size: 6 + rand() * 8,
        color: rand() > 0.5 ? C.rawWood : C.handle,
      };
    });
  }, [seed]);

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 850 }}>
      <div className="ws-flash" style={{ background: `radial-gradient(closest-side at ${x}px ${y}px, ${C.flashA}, transparent 40%)` }} />
      <div className="ws-burst" style={{ left: x, top: y, width: 90, height: 90, border: `6px solid ${C.flashB}` }} />
      <div className="ws-burst" style={{ left: x, top: y, width: 60, height: 60, border: `4px solid #fff`, animationDelay: '0.04s' }} />
      {chips.map((c, i) => (
        <div
          key={i}
          className="ws-chip"
          style={{
            left: x,
            top: y,
            width: c.size,
            height: c.size * 0.7,
            borderRadius: 2,
            background: c.color,
            ['--cx' as string]: `${c.cx}px`,
            ['--cy' as string]: `${c.cy}px`,
            ['--cr' as string]: `${c.cr}deg`,
            ['--cd' as string]: `${c.cd}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Expanding amber "sound rings" that pulse in sync with a word/unit playing. §3 */
export function SoundRings({ x, y, seed }: { x: number; y: number; seed: number }) {
  const rings = [0, 1, 2];
  return (
    <div key={seed} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 25 }}>
      {rings.map((i) => (
        <div
          key={i}
          className="ws-ring"
          style={{
            left: x,
            top: y,
            width: 120,
            height: 120,
            border: `4px solid ${C.gold}`,
            animationDelay: `${i * 0.22}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Small drifting sparkles for word-complete (≤6). §4 */
export function Sparkles({ x, y, seed }: { x: number; y: number; seed: number }) {
  const items = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: 6 }, () => ({
      sx: (rand() - 0.5) * 220,
      sy: -40 - rand() * 120,
      left: x + (rand() - 0.5) * 200,
      top: y + (rand() - 0.5) * 40,
      color: [C.red, C.teal, C.gold][Math.floor(rand() * 3)],
      delay: rand() * 0.3,
    }));
  }, [seed, x, y]);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 860 }}>
      {items.map((s, i) => (
        <div
          key={i}
          className="ws-sparkle"
          style={{
            left: s.left,
            top: s.top,
            width: 12,
            height: 12,
            background: s.color,
            clipPath: 'polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)',
            animationDelay: `${s.delay}s`,
            ['--sx' as string]: `${s.sx}px`,
            ['--sy' as string]: `${s.sy}px`,
          }}
        />
      ))}
    </div>
  );
}

/** Full-screen confetti burst for level transition. */
export function Confetti({ seed }: { seed: number }) {
  const items = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: 60 }, () => ({
      left: rand() * 1200,
      top: -20 - rand() * 120,
      vx: (rand() - 0.5) * 200,
      vy: 380 + rand() * 300,
      rot: (rand() - 0.5) * 900,
      dur: 1.6 + rand() * 1.1,
      size: 8 + rand() * 8,
      color: [C.red, C.teal, C.gold, C.faceTop][Math.floor(rand() * 4)],
    }));
  }, [seed]);
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 950 }}>
      {items.map((c, i) => (
        <div
          key={i}
          className="ws-confetti"
          style={{
            left: c.left,
            top: c.top,
            width: c.size,
            height: c.size * 0.5,
            background: c.color,
            ['--vx' as string]: `${c.vx}px`,
            ['--vy' as string]: `${c.vy}px`,
            ['--rot' as string]: `${c.rot}deg`,
            ['--dur' as string]: `${c.dur}s`,
          }}
        />
      ))}
    </div>
  );
}
