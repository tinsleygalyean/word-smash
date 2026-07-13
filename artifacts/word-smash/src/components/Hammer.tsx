import { useEffect, useRef, useState, type RefObject } from 'react';
import type { GamePhase } from '../game/types';
import {
  HAMMER_STAGES, HAMMER_DOCK, SNAP_RADIUS, C, type HammerStage,
} from '../game/design';
import { screenToStage, dist } from '../game/coords';
import { playFoley } from '../game/audio';

interface Props {
  stageIndex: number;
  phase: GamePhase;
  stageRef: RefObject<HTMLDivElement | null>;
  target: { x: number; y: number };  // plaque / tray center to smash
  interactive: boolean;              // pointer enabled (present or rebuild)
  dimmed: boolean;                   // 90% opacity during rebuild
  onWindupStart: () => void;
  onWindupCancel: () => void;
  onStrike: () => void;
  onResmash: () => void;
}

type Mode = 'dock' | 'drag' | 'windup' | 'return';

const APEX_MS = 620;   // grow to camera
const HANG_MS = 150;   // anticipation hang
const STRIKE_MS = 160; // slam down
const COMMIT_AT = APEX_MS + HANG_MS; // release after this still strikes

export function Hammer({
  stageIndex, phase, stageRef, target, interactive, dimmed,
  onWindupStart, onWindupCancel, onStrike, onResmash,
}: Props) {
  const recipe = HAMMER_STAGES[Math.max(0, Math.min(HAMMER_STAGES.length - 1, stageIndex))];
  const [mode, setMode] = useState<Mode>('dock');
  const [pos, setPos] = useState({ x: HAMMER_DOCK.x, y: HAMMER_DOCK.y });
  const [scale, setScale] = useState(1);
  const [rot, setRot] = useState(-26);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const heldRef = useRef(false);
  const committedRef = useRef(false);
  const resmashFiredRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);

  // §2/§3: normalized ~5.2× wind-up scale, constant across all hammer stages so
  // the swing fills the screen the same way at every level.
  const windupScale = 5.2;

  function clearTimers() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }

  useEffect(() => () => clearTimers(), []);

  // Reset to dock whenever we return to present (new word) or leave rebuild.
  useEffect(() => {
    if (phase === 'present' || phase === 'complete' || phase === 'levelComplete') {
      if (mode !== 'drag' && mode !== 'windup') resetToDock();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function resetToDock() {
    clearTimers();
    committedRef.current = false;
    resmashFiredRef.current = false;
    setMode('dock');
    setPos({ x: HAMMER_DOCK.x, y: HAMMER_DOCK.y });
    setScale(1);
    setRot(-26);
  }

  function beginWindup() {
    if (mode === 'windup') return;
    setMode('windup');
    committedRef.current = false;
    onWindupStart();
    playFoley('whoosh');
    // grow toward camera over the plaque
    setPos({ x: target.x, y: target.y - 40 });
    setScale(windupScale);
    setRot(-6);

    // apex reached → hang → commit + strike
    timers.current.push(
      setTimeout(() => {
        committedRef.current = true;
        // slam
        setPos({ x: target.x, y: target.y });
        setScale(windupScale * 0.92);
        setRot(2);
        timers.current.push(
          setTimeout(() => {
            onStrike();
            // recoil back to dock
            setMode('return');
            setScale(1);
            setPos({ x: HAMMER_DOCK.x, y: HAMMER_DOCK.y });
            setRot(-26);
            timers.current.push(setTimeout(() => setMode('dock'), 260));
          }, STRIKE_MS),
        );
      }, APEX_MS + HANG_MS),
    );
  }

  function cancelWindup() {
    clearTimers();
    setMode('return');
    setScale(1);
    setPos({ x: HAMMER_DOCK.x, y: HAMMER_DOCK.y });
    setRot(-26);
    timers.current.push(setTimeout(() => setMode('dock'), 240));
    onWindupCancel();
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!interactive) return;
    if (mode === 'windup' || mode === 'return') return;
    e.preventDefault();
    heldRef.current = true;
    resmashFiredRef.current = false;
    pointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    setMode('drag');
    setRot(-20);
    const p = screenToStage(stageRef.current, e.clientX, e.clientY);
    setPos(p);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (mode !== 'drag') return;
    const p = screenToStage(stageRef.current, e.clientX, e.clientY);
    setPos(p);
    const d = dist(p.x, p.y, target.x, target.y);
    if (d < SNAP_RADIUS) {
      if (phase === 'present') {
        beginWindup();
      } else if (phase === 'rebuild' && !resmashFiredRef.current) {
        resmashFiredRef.current = true;
        onResmash();
        // quick recoil to dock
        setMode('return');
        setScale(1);
        setPos({ x: HAMMER_DOCK.x, y: HAMMER_DOCK.y });
        setRot(-26);
        timers.current.push(setTimeout(() => setMode('dock'), 220));
      }
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    heldRef.current = false;
    if (pointerIdRef.current != null) {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(pointerIdRef.current);
      pointerIdRef.current = null;
    }
    if (mode === 'drag') {
      resetToDock();
    } else if (mode === 'windup' && !committedRef.current) {
      cancelWindup();
    }
  }

  const w = recipe.size;
  const h = w * (160 / 120);
  const opacity = dimmed && mode === 'dock' ? 0.9 : 1;
  const transition =
    mode === 'windup'
      ? `transform ${APEX_MS}ms cubic-bezier(.5,0,.9,.4)`
      : mode === 'return'
        ? 'transform 240ms cubic-bezier(.3,.8,.4,1)'
        : mode === 'drag'
          ? 'transform 60ms linear'
          : 'transform 300ms ease';

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: h,
        transform: `translate(${pos.x - w / 2}px, ${pos.y - h * 0.62}px) rotate(${rot}deg) scale(${scale})`,
        transformOrigin: '50% 78%',
        transition,
        cursor: interactive ? (mode === 'drag' ? 'grabbing' : 'grab') : 'default',
        opacity,
        zIndex: mode === 'windup' || mode === 'return' ? 900 : 40,
        touchAction: 'none',
      }}
    >
      {/* oval contact shadow, centered at the bottom of the handle */}
      <div
        style={{
          position: 'absolute', left: '50.4%', top: '96%',
          width: w * 0.55, height: w * 0.16,
          transform: 'translate(-50%, -50%)',
          background: 'radial-gradient(ellipse at center, rgba(90,55,20,.4) 0%, rgba(90,55,20,0) 70%)',
          pointerEvents: 'none',
        }}
      />
      <div className={mode === 'dock' && interactive ? 'ws-hammer-rock' : undefined} style={{ position: 'relative', width: '100%', height: '100%' }}>
        <HammerSVG recipe={recipe} />
      </div>
    </div>
  );
}

function HammerSVG({ recipe }: { recipe: HammerStage }) {
  const hid = `hg-${recipe.headA.replace('#', '')}-${recipe.size}`;
  return (
    <svg viewBox="0 0 120 160" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={hid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={recipe.headA} />
          <stop offset="1" stopColor={recipe.headB} />
        </linearGradient>
      </defs>
      {/* handle */}
      <rect x="53" y="58" width="15" height="96" rx="7" fill={recipe.grip} stroke={recipe.gripStroke} strokeWidth="2" />
      {recipe.handleRing && (
        <rect x="51" y="70" width="19" height="7" rx="3.5" fill={recipe.gripStroke} opacity="0.7" />
      )}
      {/* head */}
      <rect x="18" y="20" width="84" height="46" rx="15" fill={`url(#${hid})`} stroke={recipe.headStroke} strokeWidth="3" />
      {/* highlight stripe */}
      {recipe.stripe && (
        <rect x="24" y="26" width="72" height="8" rx="4" fill="rgba(255,255,255,.45)" />
      )}
      {/* gold inlay bands */}
      {recipe.goldBand >= 1 && <rect x="18" y="55" width="84" height="4" fill={C.gold} opacity="0.9" />}
      {recipe.goldBand >= 2 && <rect x="18" y="28" width="84" height="3" fill={C.gold} opacity="0.85" />}
      {/* cream dot emblem */}
      {recipe.creamDot && <circle cx="60" cy="43" r="7" fill={C.faceTop} opacity="0.9" />}
      {/* star emblem */}
      {recipe.star > 0 && (
        <path
          d="M60 30 l4.3 8.7 9.6 1.4 -6.95 6.77 1.64 9.56 -8.59 -4.52 -8.59 4.52 1.64 -9.56 -6.95 -6.77 9.6 -1.4 Z"
          fill={recipe.star === 1 ? C.faceTop : 'none'}
          stroke={C.faceTop}
          strokeWidth={recipe.star === 2 ? 2.5 : 0}
          strokeLinejoin="round"
        />
      )}
      {/* sparkle glints */}
      {recipe.sparkle && (
        <>
          <circle cx="26" cy="24" r="2.5" fill="#fff" opacity="0.9" />
          <circle cx="96" cy="30" r="2" fill="#fff" opacity="0.8" />
        </>
      )}
    </svg>
  );
}
