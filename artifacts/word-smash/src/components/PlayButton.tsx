import { C } from '../game/design';

interface Props {
  x: number;
  y: number;
  size?: number;
  color?: string;
  pulse?: boolean;
  onPlay: () => void;
}

/** Small circular "hear it" button (ghost play-cue in no-ghost levels). */
export function PlayButton({ x, y, size = 40, color = C.teal, pulse, onPlay }: Props) {
  return (
    <button
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onPlay();
      }}
      className={pulse ? 'ws-slot-hint' : undefined}
      style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        border: 'none',
        background: color,
        boxShadow: '0 3px 6px rgba(90,55,20,.35), inset 0 2px 2px rgba(255,255,255,.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        pointerEvents: 'auto',
        padding: 0,
        touchAction: 'none',
      }}
    >
      <span
        style={{
          width: 0,
          height: 0,
          borderTop: `${size * 0.2}px solid transparent`,
          borderBottom: `${size * 0.2}px solid transparent`,
          borderLeft: `${size * 0.3}px solid #fff`,
          marginLeft: size * 0.08,
        }}
      />
    </button>
  );
}
