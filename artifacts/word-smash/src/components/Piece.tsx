import { useRef, type RefObject } from 'react';
import type { PieceState } from '../game/types';
import { PIECE_H, C, unitColorId, colorSet } from '../game/design';
import { screenToStage } from '../game/coords';
import { PlaqueFace } from './PlaqueFace';

interface Props {
  piece: PieceState;
  w: number;
  hint: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
  onPickup: (id: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDrop: (id: string, x: number, y: number) => void;
  seatKey: number; // bump animation trigger when placed
}

export function Piece({ piece, w, hint, stageRef, onPickup, onMove, onDrop }: Props) {
  const draggingRef = useRef(false);
  const grabOffset = useRef({ dx: 0, dy: 0 });
  const cs = colorSet(unitColorId(piece.unitIndex));

  function down(e: React.PointerEvent) {
    if (piece.placed) return;
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = screenToStage(stageRef.current, e.clientX, e.clientY);
    grabOffset.current = { dx: p.x - piece.x, dy: p.y - piece.y };
    onPickup(piece.id);
  }
  function move(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const p = screenToStage(stageRef.current, e.clientX, e.clientY);
    onMove(piece.id, p.x - grabOffset.current.dx, p.y - grabOffset.current.dy);
  }
  function up(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    const p = screenToStage(stageRef.current, e.clientX, e.clientY);
    onDrop(piece.id, p.x - grabOffset.current.dx, p.y - grabOffset.current.dy);
  }

  return (
    <div
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className={hint && !piece.placed ? 'ws-piece-hint' : undefined}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: w,
        height: PIECE_H,
        transform: `translate(${piece.x - w / 2}px, ${piece.y - PIECE_H / 2}px) rotate(${piece.rotation}deg)`,
        transition: draggingRef.current ? 'none' : 'transform 0.28s cubic-bezier(.34,1.56,.64,1)',
        zIndex: 50 + piece.zIndex,
        cursor: piece.placed ? 'default' : 'grab',
        touchAction: 'none',
        willChange: 'transform',
      }}
    >
      <PlaqueFace
        w={w}
        h={PIECE_H}
        text={piece.unit}
        faceA={C.faceTop}
        faceB={C.faceBot}
        band={cs.band}
        ink={cs.letter}
        className={piece.placed ? 'ws-seat' : undefined}
        style={{ position: 'relative' }}
      />
    </div>
  );
}
