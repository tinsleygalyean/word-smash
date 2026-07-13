import { useEffect, useRef, useState } from 'react';
import {
  HAMMER_STAGES, HAMMER_DOCK, STAGE_W, STAGE_H, C, type HammerStage,
} from '../game/design';
import { Sparkles } from './Effects';
import { playFoley } from '../game/audio';

interface Props {
  fromStage: number;
  toStage: number;
  onPersist: () => void;   // swap to the new hammer stage + persist at the flash
  onStartNext: () => void; // load the next level's first word (behind the dim)
  onDone: () => void;      // remove the overlay, revealing the ready bench
}

type Phase = 'hop' | 'spin' | 'flash' | 'return';

const centerX = STAGE_W / 2;
const centerY = STAGE_H * 0.42;

// beat timing (ms from mount)
const HOP_MS = 500;    // dock → center
const SPIN_MS = 900;   // two accelerating turns
const BURST_MS = 600;  // radiant burst + sparkles fade
const RETURN_MS = 500; // center → dock

/**
 * Single focused hammer-upgrade sequence (~2.5s), tap-to-fast-forward.
 *  1. World dims + a warm spotlight blooms; the hammer hops dock → center.
 *  2. It spins twice (accelerating, blur-streak ghosts) → white flash lands it
 *     as the next stage (bigger + new paint per §7); haptic tick + cymbal.
 *  3. A radiant burst + sparkles bloom, then the upgraded hammer returns to the
 *     dock and the next level's first word is revealed ready on the bench.
 * Persist happens at the flash so an app kill mid-celebration reopens upgraded.
 */
export function LevelTransition({ fromStage, toStage, onPersist, onStartNext, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>('hop');
  const [atCenter, setAtCenter] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const persisted = useRef(false);
  const startedNext = useRef(false);
  const finished = useRef(false);

  const goPersist = () => { if (!persisted.current) { persisted.current = true; onPersist(); } };
  const goNext = () => { if (!startedNext.current) { startedNext.current = true; onStartNext(); } };
  const goDone = () => { if (!finished.current) { finished.current = true; onDone(); } };

  useEffect(() => {
    const T = timers.current;
    const add = (fn: () => void, ms: number) => { T.push(setTimeout(fn, ms)); };

    // beat 1: dim + spotlight bloom, hammer hops dock → center
    add(() => setAtCenter(true), 30);
    // beat 2: spin ×2 accelerating
    add(() => setPhase('spin'), HOP_MS);
    // white flash → lands as the new stage + haptic + cymbal + burst/sparkles
    add(() => {
      setPhase('flash');
      setFlashKey((k) => k + 1);
      setBurstKey((k) => k + 1);
      goPersist();
      playFoley('cymbal');
      try { navigator.vibrate?.(30); } catch { /* ignore */ }
    }, HOP_MS + SPIN_MS);
    // beat 3: upgraded hammer returns to dock; next word loads behind the dim
    add(() => { setPhase('return'); setAtCenter(false); goNext(); }, HOP_MS + SPIN_MS + BURST_MS);
    // reveal the ready bench
    add(goDone, HOP_MS + SPIN_MS + BURST_MS + RETURN_MS);

    return () => { T.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A tap fast-forwards the remaining beats to completion, idempotently.
  function skip() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    goPersist();
    goNext();
    goDone();
  }

  const upgraded = phase === 'flash' || phase === 'return';
  const shownStage = upgraded ? toStage : fromStage;
  const recipe = HAMMER_STAGES[Math.max(0, Math.min(HAMMER_STAGES.length - 1, shownStage))];

  const hammerX = atCenter ? centerX : HAMMER_DOCK.x;
  const hammerY = atCenter ? centerY : HAMMER_DOCK.y;
  const hammerH = recipe.size * (160 / 120);
  // Match the real Hammer's dock pose so the return-to-dock handoff is seamless.
  const rot = atCenter ? 0 : -26;

  return (
    <div onPointerDown={skip} style={{ position: 'absolute', inset: 0, zIndex: 940, pointerEvents: 'auto' }}>
      {/* world dim + warm spotlight bloom at center */}
      <div
        className="ws-fade-in"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(60% 60% at 50% 42%, rgba(255,244,214,.30) 0%, rgba(30,18,6,.28) 70%)',
        }}
      />

      {/* radiant burst + sparkles bloom at the transformation */}
      {burstKey > 0 && <div key={burstKey} className="ws-radiant" style={{ left: centerX, top: centerY }} />}
      {burstKey > 0 && <Sparkles key={`s${burstKey}`} x={centerX} y={centerY} seed={toStage * 97 + 13} />}

      {/* blur-streak ghost trail during the spin (transform/opacity only) */}
      {phase === 'spin' && [0.15, 0.3].map((delay, i) => (
        <div
          key={i}
          style={{
            position: 'absolute', left: 0, top: 0,
            width: recipe.size, height: hammerH,
            transform: `translate(${centerX - recipe.size / 2}px, ${centerY - hammerH * 0.62}px)`,
            opacity: 0.22 - i * 0.1,
            pointerEvents: 'none',
          }}
        >
          <div className="ws-hammer-spin" style={{ width: '100%', height: '100%', animationDelay: `${delay}s` }}>
            <FlourishHammer recipe={recipe} />
          </div>
        </div>
      ))}

      {/* the hammer itself — dock pose matches the real Hammer for a seamless handoff */}
      <div
        style={{
          position: 'absolute', left: 0, top: 0,
          width: recipe.size, height: hammerH,
          transform: `translate(${hammerX - recipe.size / 2}px, ${hammerY - hammerH * 0.62}px) rotate(${rot}deg)`,
          transformOrigin: '50% 78%',
          filter:
            upgraded || phase === 'spin'
              ? 'drop-shadow(0 0 24px rgba(224,161,60,.9))'
              : 'drop-shadow(0 8px 12px rgba(90,55,20,.35))',
          transition: 'transform 0.5s ease, width 0.3s ease, height 0.3s ease',
        }}
      >
        <div className={phase === 'spin' ? 'ws-hammer-spin' : undefined} style={{ width: '100%', height: '100%' }}>
          <FlourishHammer recipe={recipe} />
        </div>
      </div>

      {/* white flash at the moment of transformation */}
      {flashKey > 0 && <div key={flashKey} className="ws-white-flash" />}
    </div>
  );
}

function FlourishHammer({ recipe }: { recipe: HammerStage }) {
  return (
    <svg viewBox="0 0 120 160" width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="ws-flourish-head" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={recipe.headA} />
          <stop offset="1" stopColor={recipe.headB} />
        </linearGradient>
      </defs>
      <rect x="53" y="58" width="15" height="96" rx="7" fill={recipe.grip} stroke={recipe.gripStroke} strokeWidth="2" />
      <rect x="18" y="20" width="84" height="46" rx="15" fill="url(#ws-flourish-head)" stroke={recipe.headStroke} strokeWidth="3" />
      {recipe.goldBand >= 1 && <rect x="18" y="55" width="84" height="4" fill={C.gold} />}
      {recipe.star > 0 && (
        <path
          d="M60 30 l4.3 8.7 9.6 1.4 -6.95 6.77 1.64 9.56 -8.59 -4.52 -8.59 4.52 1.64 -9.56 -6.95 -6.77 9.6 -1.4 Z"
          fill={recipe.star === 1 ? C.faceTop : 'none'}
          stroke={C.faceTop}
          strokeWidth={recipe.star === 2 ? 2.5 : 0}
        />
      )}
    </svg>
  );
}
