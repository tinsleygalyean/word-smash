import { useRef, useState, type RefObject } from 'react';
import type { PlaqueState } from '../game/types';
import { PIECE_H, WALL_H, finishForPlayCount } from '../game/design';
import { screenToStage } from '../game/coords';
import { PlaqueFace } from './PlaqueFace';

interface Props {
  plaques: PlaqueState[];
  stageRef: RefObject<HTMLDivElement | null>;
  onReplay: (plaqueId: string, wordId: string) => void;
  onMove: (plaqueId: string, x: number, y: number) => void;
  onBringFront: (plaqueId: string) => void;
}

const WALL_PLAQUE_W = 150;
const WALL_PLAQUE_H = Math.round(PIECE_H * 0.62);

/** The trophy wall of completed words. Draggable, stackable; drag a plaque
 * down toward the bench to replay its word. §6 */
export function Wall({ plaques, stageRef, onReplay, onMove, onBringFront }: Props) {
  return (
    <>
      {plaques.map((p) => (
        <WallPlaque
          key={p.plaqueId}
          plaque={p}
          stageRef={stageRef}
          onReplay={onReplay}
          onMove={onMove}
          onBringFront={onBringFront}
        />
      ))}
    </>
  );
}

function WallPlaque({
  plaque, stageRef, onReplay, onMove, onBringFront,
}: {
  plaque: PlaqueState;
  stageRef: RefObject<HTMLDivElement | null>;
  onReplay: (plaqueId: string, wordId: string) => void;
  onMove: (plaqueId: string, x: number, y: number) => void;
  onBringFront: (plaqueId: string) => void;
}) {
  const [pos, setPos] = useState({ x: plaque.x, y: plaque.y });
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const grab = useRef({ dx: 0, dy: 0 });
  const start = useRef({ x: plaque.x, y: plaque.y });
  const finish = finishForPlayCount(plaque.playCount);

  function down(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    setDragging(true);
    onBringFront(plaque.plaqueId);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const sp = screenToStage(stageRef.current, e.clientX, e.clientY);
    grab.current = { dx: sp.x - pos.x, dy: sp.y - pos.y };
    start.current = { ...pos };
  }
  function move(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const sp = screenToStage(stageRef.current, e.clientX, e.clientY);
    setPos({ x: sp.x - grab.current.dx, y: sp.y - grab.current.dy });
  }
  function up(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    const sp = screenToStage(stageRef.current, e.clientX, e.clientY);
    const dropped = sp.y - grab.current.dy;
    const draggedDown = dropped > WALL_H + 20 || dropped - start.current.y > 90;
    const moved = Math.hypot(pos.x - start.current.x, pos.y - start.current.y) > 6;
    if (draggedDown) {
      onReplay(plaque.plaqueId, plaque.wordId);
      setPos(start.current); // snap back to wall
    } else if (moved) {
      const clampedY = Math.min(WALL_H - WALL_PLAQUE_H / 2 - 6, Math.max(WALL_PLAQUE_H / 2 + 30, pos.y));
      const np = { x: Math.max(90, Math.min(1110, pos.x)), y: clampedY };
      setPos(np);
      onMove(plaque.plaqueId, np.x, np.y);
    } else {
      onReplay(plaque.plaqueId, plaque.wordId); // tap = play
      setPos(start.current);
    }
  }

  return (
    <div
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: WALL_PLAQUE_W,
        height: WALL_PLAQUE_H,
        transform: `translate(${pos.x - WALL_PLAQUE_W / 2}px, ${pos.y - WALL_PLAQUE_H / 2}px) rotate(${dragging ? 0 : (plaque.zOrder % 5 - 2) * 1.5}deg)`,
        transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(.34,1.56,.64,1)',
        zIndex: 30 + plaque.zOrder,
        cursor: 'grab',
        touchAction: 'none',
      }}
    >
      <PlaqueFace
        w={WALL_PLAQUE_W}
        h={WALL_PLAQUE_H}
        text={plaque.display}
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
}
