import type { SlotState } from '../game/types';

interface Props {
  slot: SlotState;
  x: number;
  y: number;
  size: number;
  ghost: boolean;
  hintPulse: boolean;
  onPlay: () => void;
}

export function WordSlot({ slot, x, y, size, ghost, hintPulse, onPlay }: Props) {
  const filled = slot.filled;

  return (
    <div
      className={`ws-slot${hintPulse ? ' ws-slot--hint' : ''}${filled ? ' ws-slot--filled' : ''}`}
      style={{
        position: 'absolute',
        left: `${x - size / 2}px`,
        top: `${y - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '12px',
        border: `3px dashed ${filled ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)'}`,
        backgroundColor: filled ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.25)',
        pointerEvents: 'none',
        transition: 'background-color 0.2s',
      }}
    >
      {ghost && !filled && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: slot.unit.length > 3 ? '1.5rem' : slot.unit.length > 1 ? '2rem' : '2.6rem',
            fontWeight: 900,
            color: 'rgba(255,255,255,0.22)',
            letterSpacing: '-0.02em',
            fontFamily: "'Fredoka One', 'Nunito', system-ui, sans-serif",
            userSelect: 'none',
          }}
        >
          {slot.unit}
        </div>
      )}

      {!filled && (
        <button
          className="ws-slot-play-btn"
          onPointerDown={(e) => { e.stopPropagation(); onPlay(); }}
          aria-label={`Play sound for ${slot.unit}`}
          style={{
            position: 'absolute',
            top: '-32px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255,255,255,0.85)',
            border: 'none',
            borderRadius: '50%',
            width: '28px',
            height: '28px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            pointerEvents: 'auto',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <polygon points="4,2 14,8 4,14" fill="#c9a040" />
          </svg>
        </button>
      )}
    </div>
  );
}
