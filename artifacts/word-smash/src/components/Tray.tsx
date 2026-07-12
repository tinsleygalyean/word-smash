import type { SlotState } from '../game/types';
import { PIECE_H, PIECE_RADIUS, C, unitColorId, colorSet } from '../game/design';
import { PlayButton } from './PlayButton';

interface Props {
  slots: SlotState[];
  ghost: boolean;               // ghost level → outline letters in recesses
  hintSlotIndex: number | null; // pulse this recess
  onSlotPlay: (index: number) => void;
}

/** Routed recesses in the bench that receive the scattered pieces. */
export function Tray({ slots, ghost, hintSlotIndex, onSlotPlay }: Props) {
  return (
    <>
      {slots.map((slot) => {
        const cs = colorSet(unitColorId(slot.index));
        const left = slot.x - slot.w / 2;
        const top = slot.y - PIECE_H / 2;
        return (
          <div key={slot.index}>
            {/* sunken recess */}
            <div
              className={hintSlotIndex === slot.index && !ghost ? undefined : undefined}
              style={{
                position: 'absolute',
                left,
                top,
                width: slot.w,
                height: PIECE_H,
                borderRadius: PIECE_RADIUS,
                background: C.recess,
                boxShadow: `inset 0 4px 8px rgba(90,55,20,.35), inset 0 -2px 2px rgba(255,255,255,.18)`,
              }}
            />
            {/* hint ring */}
            {hintSlotIndex === slot.index && (
              <div
                className="ws-slot-hint"
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width: slot.w,
                  height: PIECE_H,
                  borderRadius: PIECE_RADIUS,
                  pointerEvents: 'none',
                }}
              />
            )}
            {/* ghost outline letter (ghost levels only) */}
            {ghost && !slot.filled && (
              <div
                style={{
                  position: 'absolute',
                  left,
                  top,
                  width: slot.w,
                  height: PIECE_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    fontFamily: "'Fredoka', system-ui, sans-serif",
                    fontWeight: 700,
                    fontSize: Math.round(PIECE_H * 0.5),
                    letterSpacing: '0.04em',
                    color: 'transparent',
                    WebkitTextStroke: `2px ${cs.band}`,
                    opacity: 0.55,
                  }}
                >
                  {slot.unit}
                </span>
              </div>
            )}
            {/* ghost play button (no-ghost levels only) */}
            {!ghost && !slot.filled && (
              <PlayButton
                x={slot.x}
                y={slot.y}
                color={cs.band}
                pulse={hintSlotIndex === slot.index}
                onPlay={() => onSlotPlay(slot.index)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
