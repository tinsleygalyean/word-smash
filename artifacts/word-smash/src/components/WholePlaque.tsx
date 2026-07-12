import { PlaqueFace } from './PlaqueFace';
import { PIECE_H, C } from '../game/design';

interface Props {
  text: string;
  x: number;
  y: number;
  w: number;
  breathe: boolean;
  onPlay: () => void;
}

/** The intact word plaque shown before the smash (no seams, no break hints). */
export function WholePlaque({ text, x, y, w, breathe, onPlay }: Props) {
  return (
    <div
      onPointerDown={(e) => {
        e.preventDefault();
        onPlay();
      }}
      className={breathe ? 'ws-breathe' : undefined}
      style={{
        position: 'absolute',
        left: x - w / 2,
        top: y - PIECE_H / 2,
        width: w,
        height: PIECE_H,
        cursor: 'pointer',
        touchAction: 'none',
        zIndex: 20,
      }}
    >
      <PlaqueFace
        w={w}
        h={PIECE_H}
        text={text}
        faceA={C.faceTop}
        faceB={C.faceBot}
        band={C.faceShadow}
        ink={C.ink}
        style={{ position: 'relative' }}
      />
    </div>
  );
}
