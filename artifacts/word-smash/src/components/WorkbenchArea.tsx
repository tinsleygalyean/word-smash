import { useRef, useCallback, MutableRefObject } from 'react';
import type { Word, Level, PieceState, SlotState, GamePhase, HintState } from '../game/types';
import { WordPiece } from './WordPiece';
import { WordSlot } from './WordSlot';

interface Props {
  word: Word | null;
  levelData: Level | null;
  pieces: PieceState[];
  slots: SlotState[];
  phase: GamePhase;
  hint: HintState | null;
  pieceColors: string[];
  onPiecePickup: (id: string) => void;
  onPieceDrop: (id: string, x: number, y: number) => void;
  onWordPlay: () => void;
  onSlotPlay: (index: number) => void;
  containerRef: MutableRefObject<HTMLDivElement | null>;
}

export function WorkbenchArea({
  word,
  levelData,
  pieces,
  slots,
  phase,
  hint,
  pieceColors,
  onPiecePickup,
  onPieceDrop,
  onWordPlay,
  onSlotPlay,
  containerRef,
}: Props) {
  const draggingRef = useRef<{ id: string; startX: number; startY: number; initPieceX: number; initPieceY: number } | null>(null);

  function getSlotLayout(count: number) {
    const el = containerRef.current;
    const w = el ? el.clientWidth : window.innerWidth;
    const h = el ? el.clientHeight : window.innerHeight;
    const workbenchCY = h * 0.52;
    const slotWidth = Math.min(120, (w * 0.55) / count);
    const totalW = count * slotWidth;
    const startX = w / 2 - totalW / 2 + slotWidth / 2;
    return { startX, slotWidth, workbenchCY };
  }

  const handlePointerDown = useCallback((e: React.PointerEvent, id: string) => {
    if (phase !== 'rebuild') return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const piece = pieces.find(p => p.id === id);
    if (!piece) return;
    draggingRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      initPieceX: piece.x,
      initPieceY: piece.y,
    };
    onPiecePickup(id);
  }, [phase, pieces, onPiecePickup]);

  const handlePointerMove = useCallback((e: React.PointerEvent, id: string) => {
    const d = draggingRef.current;
    if (!d || d.id !== id) return;
    e.preventDefault();
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pieceEl = document.getElementById(`piece-${id}`);
    if (pieceEl) {
      pieceEl.style.left = `${x - 40}px`;
      pieceEl.style.top = `${y - 40}px`;
      pieceEl.style.transform = `rotate(0deg) scale(1.08)`;
      pieceEl.style.zIndex = '999';
    }
  }, [containerRef]);

  const handlePointerUp = useCallback((e: React.PointerEvent, id: string) => {
    const d = draggingRef.current;
    if (!d || d.id !== id) return;
    draggingRef.current = null;
    const el = containerRef.current;
    const rect = el?.getBoundingClientRect() ?? { left: 0, top: 0 };
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onPieceDrop(id, x, y);
  }, [containerRef, onPieceDrop]);

  if (!word || !levelData) return <div className="ws-workbench" />;

  const { startX, slotWidth, workbenchCY } = getSlotLayout(slots.length);
  const ghost = levelData.ghost;

  return (
    <div className="ws-workbench">
      <div className="ws-workbench-surface" />

      <button
        className="ws-word-play-btn"
        onPointerDown={(e) => { e.stopPropagation(); onWordPlay(); }}
        aria-label="Play word"
        style={{
          position: 'absolute',
          left: '50%',
          top: `${workbenchCY - 95}px`,
          transform: 'translateX(-50%)',
        }}
      >
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <circle cx="18" cy="18" r="17" fill="#fff8e7" stroke="#c9a040" strokeWidth="2" />
          <polygon points="13,10 28,18 13,26" fill="#c9a040" />
        </svg>
      </button>

      {slots.map((slot, i) => {
        const x = startX + i * slotWidth;
        const hintActive = hint?.type === 'slot' && hint.slotIndex === i;
        return (
          <WordSlot
            key={`slot-${i}`}
            slot={slot}
            x={x}
            y={workbenchCY}
            size={slotWidth - 8}
            ghost={ghost}
            hintPulse={hintActive}
            onPlay={() => onSlotPlay(i)}
          />
        );
      })}

      {pieces.map((piece, i) => {
        const pieceEl = document.getElementById(`piece-${piece.id}`);
        const isDragging = draggingRef.current?.id === piece.id;

        const hintGlow =
          hint?.type === 'piece' ||
          (hint?.type === 'ghost' && !piece.placed);

        return (
          <WordPiece
            key={piece.id}
            piece={piece}
            color={pieceColors[i]}
            hintGlow={hintGlow}
            onPointerDown={(e) => handlePointerDown(e, piece.id)}
            onPointerMove={(e) => handlePointerMove(e, piece.id)}
            onPointerUp={(e) => handlePointerUp(e, piece.id)}
          />
        );
      })}
    </div>
  );
}
