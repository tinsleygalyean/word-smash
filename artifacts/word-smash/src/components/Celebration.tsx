import { useEffect, useState } from 'react';

const PARTICLES = 20;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
}

const COLORS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#f783ac', '#ff922b'];

export function Celebration() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    const ps: Particle[] = Array.from({ length: PARTICLES }, () => ({
      x: 40 + Math.random() * 20,
      y: 45,
      vx: (Math.random() - 0.5) * 6,
      vy: -(3 + Math.random() * 4),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 8 + Math.random() * 10,
      rotation: Math.random() * 360,
    }));
    setParticles(ps);
  }, []);

  return (
    <div className="ws-celebration" aria-hidden="true">
      <div className="ws-celebration-burst">🌟</div>
      {particles.map((p, i) => (
        <div
          key={i}
          className="ws-confetti"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            backgroundColor: p.color,
            '--vx': `${p.vx * 10}vw`,
            '--vy': `${p.vy * 10}vh`,
            '--rot': `${p.rotation + 360}deg`,
            animationDelay: `${Math.random() * 0.2}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
