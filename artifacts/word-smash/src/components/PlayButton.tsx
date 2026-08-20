import { C } from '../game/design';

interface Props {
  x: number;
  y: number;
  size?: number;
  color?: string;
  pulse?: boolean;
  playing?: boolean; // §4: solidify + pulse while its sound speaks
  onPlay: () => void;
}

/**
 * No-ghost slot cue (§4): a FAINT DASHED ghost play button (dashed circle +
 * hollow triangle). Touching it speaks the sound of the piece that belongs
 * there; the button solidifies and its recess pulses during playback, then it
 * fades back to a ghost.
 */
export function PlayButton({ x, y, size = 44, color = C.teal, pulse, playing, onPlay }: Props) {
  const solid = !!playing;
  return (
    <button
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onPlay();
      }}
      className={playing ? 'ws-playbtn-pulse' : pulse ? 'ws-playbtn-pulse' : undefined}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        transform: 'translate(-50%,-50%)',
        borderRadius: '50%',
        border: solid ? 'none' : `2.5px dashed ${color}`,
        background: solid ? color : 'transparent',
        opacity: solid ? 1 : 0.5,
        boxShadow: solid ? '0 3px 6px rgba(90,55,20,.35), inset 0 2px 2px rgba(255,255,255,.35)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        pointerEvents: 'auto',
        padding: 0,
        touchAction: 'none',
        transition: 'background 0.2s ease, opacity 0.3s ease, border-color 0.2s ease',
      }}
    >
      {solid ? (
        <span
          style={{
            width: 0,
            height: 0,
            borderTop: `${size * 0.18}px solid transparent`,
            borderBottom: `${size * 0.18}px solid transparent`,
            borderLeft: `${size * 0.28}px solid #fff`,
            marginLeft: size * 0.08,
          }}
        />
      ) : (
        // hollow ghost triangle
        <span
          style={{
            width: 0,
            height: 0,
            borderTop: `${size * 0.18}px solid transparent`,
            borderBottom: `${size * 0.18}px solid transparent`,
            borderLeft: `${size * 0.28}px solid ${color}`,
            opacity: 0.8,
            marginLeft: size * 0.08,
          }}
        />
      )}
    </button>
  );
}
