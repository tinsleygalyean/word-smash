import type { SlotState } from '../game/types';
import { PIECE_H, PIECE_RADIUS, C } from '../game/design';
import { PlayButton } from './PlayButton';

interface Props {
  slots: SlotState[];
  ghost: boolean;               // ghost level → outline letters in recesses
  hintSlotIndex: number | null; // pulse this recess
  playingSlotIndex: number | null; // §4: this slot's ghost play button is speaking
  accentColor: string;          // shared band color for all slots of this word
  onSlotPlay: (index: number) => void;
}

/** Routed recesses in the bench that receive the scattered pieces. */
export function Tray({ slots, ghost, hintSlotIndex, playingSlotIndex, accentColor, onSlotPlay }: Props) {
  return (
    <>
      {slots.map((slot) => {
        const left = slot.x - slot.w / 2;
        const top = slot.y - PIECE_H / 2;
        const playing = playingSlotIndex === slot.index;
        return (
          <div key={slot.index}>
            {/* sunken recess */}
            <div
              className={playing && !ghost ? 'ws-recess-pulse' : undefined}
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
                    fontWeight: 600,
                    fontSize: Math.round(PIECE_H * 0.5),
                    letterSpacing: '0.04em',
                    color: 'transparent',
                    WebkitTextStroke: `2px ${accentColor}`,
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
                color={accentColor}
                pulse={hintSlotIndex === slot.index}
                playing={playing}
                onPlay={() => onSlotPlay(slot.index)}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
