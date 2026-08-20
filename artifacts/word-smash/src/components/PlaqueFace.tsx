import type { CSSProperties } from 'react';
import { PIECE_RADIUS } from '../game/design';

interface Props {
  w: number;
  h: number;
  text: string;
  faceA: string;
  faceB: string;
  band: string;
  ink: string;
  ghost?: boolean;    // outline letters only (ghost recess target)
  goldFace?: boolean; // 4×+ gold-on-gold shimmer
  fontScale?: number; // multiplies default letter size
  radius?: number;
  style?: CSSProperties;
  className?: string;
}

/**
 * A single carved wooden plaque/piece face.
 * Cream front face + coloured bottom band (bevel) + rounded serif-free letters.
 */
export function PlaqueFace({
  w, h, text, faceA, faceB, band, ink,
  ghost = false, goldFace = false, fontScale = 1, radius = PIECE_RADIUS, style, className,
}: Props) {
  const bandH = Math.max(8, Math.round(h * 0.09));
  const fontSize = Math.round(h * 0.52 * fontScale);

  const faceStyle: CSSProperties = {
    position: 'absolute',
    width: w,
    height: h,
    borderRadius: radius,
    background: goldFace
      ? `linear-gradient(160deg, ${faceA} 0%, ${faceB} 100%)`
      : `linear-gradient(170deg, ${faceA} 0%, ${faceB} 100%)`,
    boxShadow: `0 ${Math.round(h * 0.06)}px ${Math.round(h * 0.12)}px rgba(90,55,20,.32), inset 0 2px 2px rgba(255,255,255,.7), inset 0 ${-bandH}px 0 ${band}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...style,
  };

  const textStyle: CSSProperties = {
    fontFamily: "'Fredoka', system-ui, sans-serif",
    fontWeight: 600,
    fontSize,
    lineHeight: 1,
    letterSpacing: '0.04em',
    marginBottom: bandH * 0.4,
    userSelect: 'none',
    color: ghost ? 'transparent' : ink,
    WebkitTextStroke: ghost ? `2px ${band}` : undefined,
    textShadow: ghost ? undefined : goldFace ? '0 1px 0 rgba(255,255,255,.6)' : '0 1px 0 rgba(255,255,255,.5)',
    opacity: ghost ? 0.75 : 1,
  };

  return (
    <div className={className} style={faceStyle}>
      {goldFace && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(115deg, transparent 30%, rgba(255,255,255,.55) 47%, transparent 60%)',
            mixBlendMode: 'screen',
          }}
        />
      )}
      <span style={textStyle}>{text}</span>
    </div>
  );
}
