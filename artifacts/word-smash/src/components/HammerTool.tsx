import { useRef, useState, useEffect, MutableRefObject } from 'react';
import type { GamePhase } from '../game/types';

interface HammerColor {
  head: string;
  handle: string;
}

interface Props {
  stage: number;
  color: HammerColor;
  phase: GamePhase;
  onSmash: () => void;
  tutorialSeen: boolean;
  containerRef: MutableRefObject<HTMLDivElement | null>;
}

const STAGE_SIZES = [64, 74, 84, 96];
const STAGE_NAMES = ['Starter', 'Iron', 'Cobalt', 'Royal'];

export function HammerTool({ stage, color, phase, onSmash, tutorialSeen, containerRef }: Props) {
  const hammerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    setPos({ x: w - 100, y: h * 0.52 });
    setInitialized(true);
  }, []);

  const size = STAGE_SIZES[Math.min(stage, 3)];
  const canSmash = phase === 'present' || phase === 'rebuild';

  function handlePointerDown(e: React.PointerEvent) {
    if (!canSmash) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setIsDragging(true);
    startPosRef.current = { x: e.clientX, y: e.clientY };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    e.preventDefault();
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect() ?? { left: 0, top: 0 };
    setPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setIsDragging(false);

    const el = containerRef.current;
    const rect = el?.getBoundingClientRect() ?? { left: 0, top: 0, width: 800, height: 450 };
    const dropX = e.clientX - rect.left;
    const dropY = e.clientY - rect.top;

    const workbenchCY = rect.height * 0.52;
    const workbenchTop = workbenchCY - 60;
    const workbenchBottom = workbenchCY + 60;
    const workbenchLeft = rect.width * 0.2;
    const workbenchRight = rect.width * 0.8;

    if (
      dropX > workbenchLeft && dropX < workbenchRight &&
      dropY > workbenchTop && dropY < workbenchBottom
    ) {
      onSmash();
    }

    const w = rect.width;
    const h = rect.height;
    setPos({ x: w - 100, y: h * 0.52 });
  }

  if (!initialized) return null;

  return (
    <div
      ref={hammerRef}
      className={`ws-hammer${isDragging ? ' ws-hammer--dragging' : ''}${!tutorialSeen ? ' ws-hammer--wiggle' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      title={`${STAGE_NAMES[Math.min(stage, 3)]} Hammer`}
      style={{
        position: 'absolute',
        left: `${pos.x - size / 2}px`,
        top: `${pos.y - size / 2}px`,
        width: `${size}px`,
        height: `${size * 1.4}px`,
        cursor: canSmash ? 'grab' : 'default',
        userSelect: 'none',
        touchAction: 'none',
        zIndex: isDragging ? 800 : 50,
        opacity: canSmash ? 1 : 0.5,
        transition: isDragging ? 'none' : 'left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), top 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
        filter: isDragging ? `drop-shadow(0 12px 24px ${color.head}88)` : `drop-shadow(0 4px 8px rgba(0,0,0,0.4))`,
      }}
    >
      <svg width={size} height={size * 1.4} viewBox="0 0 64 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="8" y="2" width="48" height="32" rx="6" fill={color.head} />
        <rect x="14" y="2" width="12" height="32" rx="3" fill="rgba(255,255,255,0.2)" />
        <rect x="28" y="28" width="8" height="58" rx="4" fill={color.handle} />
        <rect x="28" y="28" width="4" height="58" rx="4" fill="rgba(255,255,255,0.15)" />
      </svg>
    </div>
  );
}
