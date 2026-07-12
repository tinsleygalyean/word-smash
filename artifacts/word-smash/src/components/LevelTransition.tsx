import { useEffect, useRef, useState } from 'react';
import {
  HAMMER_STAGES, HAMMER_DOCK, STAGE_W, STAGE_H, TRAY_CENTER, PIECE_H, C,
  finishForPlayCount, type HammerStage,
} from '../game/design';
import { Confetti } from './Effects';
import { PlaqueFace } from './PlaqueFace';
import { playFoley } from '../game/audio';

export interface EarnedPlaque {
  wordId: string;
  display: string;
  x: number;
  y: number;
  playCount: number;
}

interface Props {
  fromStage: number;
  toStage: number;
  earned: EarnedPlaque[];
  playWord: (wordId: string) => void;
  onPersist: () => void;   // beat 2: hammer stage + level index persist
  onStartNext: () => void; // beat 3: real strike (crash/shake) + next level drops
  onDone: () => void;
}

const WALL_PLAQUE_W = 150;
const WALL_PLAQUE_H = Math.round(PIECE_H * 0.62);

type Beat = 1 | 2 | 3;

/**
 * §8 level transition + hammer upgrade — three beats, ~6s, tap-to-skip after beat 1.
 *  Beat 1: earned plaques bow L→R (100ms apart) while their words play back-to-back;
 *          rising fanfare; docked hammer straightens & shivers.
 *  Beat 2: world dims, hammer to center, spins ×2, white flash → next stage,
 *          cymbal + haptic, old-hammer after-image lingers; persist happens here.
 *  Beat 3: practice swing lands as a real strike on the empty bench: confetti +
 *          crash + light shake, next level's first plaque drops & auto-plays.
 */
export function LevelTransition({
  fromStage, toStage, earned, playWord, onPersist, onStartNext, onDone,
}: Props) {
  const [beat, setBeat] = useState<Beat>(1);
  const [flashKey, setFlashKey] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const persisted = useRef(false);
  const startedNext = useRef(false);
  const finished = useRef(false);

  const recapMs = Math.max(1500, earned.length * 700 + 400);

  const goPersist = () => { if (!persisted.current) { persisted.current = true; onPersist(); } };
  const goNext = () => { if (!startedNext.current) { startedNext.current = true; onStartNext(); } };
  const goDone = () => { if (!finished.current) { finished.current = true; onDone(); } };

  useEffect(() => {
    const T = timers.current;
    const add = (fn: () => void, ms: number) => { T.push(setTimeout(fn, ms)); };

    // Beat 1 — recap
    playFoley('fanfare');
    earned.forEach((p, i) => add(() => playWord(p.wordId), i * 700));

    // Beat 2 — transformation
    add(() => {
      setBeat(2);
      goPersist();
      playFoley('cymbal');
      try { navigator.vibrate?.(30); } catch { /* ignore */ }
    }, recapMs);
    add(() => setFlashKey((k) => k + 1), recapMs + 800); // white flash at stage swap

    // Beat 3 — confetti smash + next level drop (overlap)
    add(() => { setBeat(3); goNext(); }, recapMs + 2500);
    add(() => goDone(), recapMs + 4500);

    return () => { T.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // §8: tap-to-skip is only offered AFTER beat 1 (the recap must play in full);
  // a tap during beat 2/3 fast-forwards the remaining beats to completion.
  function skip() {
    if (beat >= 2) {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      goPersist();
      goNext();
      goDone();
    }
  }

  const shownStage = beat >= 2 ? toStage : fromStage;
  const recipe = HAMMER_STAGES[Math.max(0, Math.min(HAMMER_STAGES.length - 1, shownStage))];
  const oldRecipe = HAMMER_STAGES[Math.max(0, Math.min(HAMMER_STAGES.length - 1, fromStage))];

  // hammer position: docked in beat 1, center stage in beat 2/3
  const centerX = STAGE_W / 2;
  const centerY = STAGE_H * 0.42;
  const hammerX = beat === 1 ? HAMMER_DOCK.x : centerX;
  const hammerY = beat === 1 ? HAMMER_DOCK.y : centerY;

  return (
    <div
      onPointerDown={skip}
      style={{ position: 'absolute', inset: 0, zIndex: 940, pointerEvents: beat >= 2 ? 'auto' : 'none' }}
    >
      {/* world dim: warm during beat1, deeper spotlight during beat2 */}
      <div
        className="ws-fade-in"
        style={{
          position: 'absolute',
          inset: 0,
          background:
            beat >= 2
              ? 'radial-gradient(60% 60% at 50% 42%, rgba(255,244,214,.28) 0%, rgba(30,18,6,.28) 70%)'
              : 'radial-gradient(120% 90% at 50% 40%, rgba(255,244,214,.35), transparent 70%)',
        }}
      />

      {/* Beat 1 — earned plaques bow left→right, playing back-to-back */}
      {beat === 1 && earned.map((p, i) => {
        const finish = finishForPlayCount(p.playCount);
        return (
          <div
            key={p.wordId}
            className="ws-plaque-bow"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: WALL_PLAQUE_W,
              height: WALL_PLAQUE_H,
              ['--bx' as string]: `${p.x - WALL_PLAQUE_W / 2}px`,
              ['--by' as string]: `${p.y - WALL_PLAQUE_H / 2}px`,
              animationDelay: `${i * 0.1}s`,
              zIndex: 30,
            }}
          >
            <PlaqueFace
              w={WALL_PLAQUE_W}
              h={WALL_PLAQUE_H}
              text={p.display}
              faceA={finish.faceA}
              faceB={finish.faceB}
              band={finish.band}
              ink={finish.ink}
              goldFace={finish.goldFace}
              fontScale={0.85}
              style={{ position: 'relative' }}
            />
          </div>
        );
      })}

      {/* old-hammer after-image lingering at center as the new one lands (beat2) */}
      {beat === 2 && (
        <div
          className="ws-afterimage"
          style={{
            position: 'absolute',
            left: centerX - oldRecipe.size / 2,
            top: centerY - oldRecipe.size / 2,
            width: oldRecipe.size,
            height: oldRecipe.size * (160 / 120),
            pointerEvents: 'none',
          }}
        >
          <FlourishHammer recipe={oldRecipe} />
        </div>
      )}

      {/* the hammer itself */}
      <div
        className={beat === 1 ? 'ws-hammer-shiver' : beat === 2 ? 'ws-hammer-spin' : undefined}
        style={{
          position: 'absolute',
          left: hammerX - recipe.size / 2,
          top: hammerY - recipe.size / 2,
          width: recipe.size,
          height: recipe.size * (160 / 120),
          filter:
            beat >= 2
              ? 'drop-shadow(0 0 24px rgba(224,161,60,.9))'
              : 'drop-shadow(0 6px 10px rgba(90,55,20,.35))',
          transition: 'left 0.5s ease, top 0.5s ease',
        }}
      >
        <FlourishHammer recipe={recipe} />
      </div>

      {/* white flash at the moment of transformation */}
      {beat === 2 && flashKey > 0 && <div key={flashKey} className="ws-white-flash" />}

      {/* Beat 3 — confetti burst over the empty bench */}
      {beat === 3 && <Confetti seed={toStage * 97 + 13} />}

      {/* draw a strike burst at the bench when the confetti smash lands */}
      {beat === 3 && (
        <div
          className="ws-burst"
          style={{ left: TRAY_CENTER.x, top: TRAY_CENTER.y, width: 120, height: 120, border: `6px solid ${C.flashB}` }}
        />
      )}
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
