import { useEffect, useState } from 'react';
import { HAMMER_STAGES, HAMMER_DOCK, STAGE_W, C, type HammerStage } from '../game/design';
import { Confetti } from './Effects';
import { playFoley } from '../game/audio';

interface Props {
  fromStage: number;
  toStage: number;
  onDone: () => void;
}

/**
 * 3-beat level transition (~6s), no text:
 *  1. plaques bow      (~1.6s)
 *  2. hammer transform (~2.2s) — old stage morphs to new
 *  3. confetti         (~2.2s)
 */
export function LevelTransition({ fromStage, toStage, onDone }: Props) {
  const [beat, setBeat] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setBeat(1);
      playFoley('hammerEvolve');
    }, 1600);
    const t2 = setTimeout(() => {
      setBeat(2);
      playFoley('confetti');
    }, 3800);
    const t3 = setTimeout(() => onDone(), 6000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shownStage = beat >= 1 ? toStage : fromStage;
  const recipe = HAMMER_STAGES[Math.max(0, Math.min(HAMMER_STAGES.length - 1, shownStage))];

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 940, pointerEvents: 'none' }}>
      {/* warm vignette pulse */}
      <div
        className="ws-fade-in"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(120% 90% at 50% 40%, rgba(255,244,214,.35), transparent 70%)',
        }}
      />
      {/* hammer flourish at dock */}
      <div
        style={{
          position: 'absolute',
          left: HAMMER_DOCK.x - recipe.size / 2,
          top: HAMMER_DOCK.y - recipe.size,
          width: recipe.size,
          height: recipe.size * (160 / 120),
          transition: 'all 0.5s cubic-bezier(.34,1.56,.64,1)',
          transform: beat === 1 ? 'scale(1.25) rotate(-8deg)' : 'scale(1)',
          filter: beat === 1 ? 'drop-shadow(0 0 24px rgba(224,161,60,.9))' : 'drop-shadow(0 8px 12px rgba(90,55,20,.35))',
        }}
      >
        <FlourishHammer recipe={recipe} />
      </div>
      {/* radiating glints during transform */}
      {beat === 1 && (
        <div
          className="ws-burst"
          style={{ left: HAMMER_DOCK.x, top: HAMMER_DOCK.y - recipe.size * 0.5, width: 120, height: 120, border: `6px solid ${C.gold}` }}
        />
      )}
      {beat >= 2 && <Confetti seed={toStage * 97 + 13} />}
      {/* subtle bunting sway hint during beat 0 handled by bg; nothing else drawn */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: STAGE_W, height: 1 }} />
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
