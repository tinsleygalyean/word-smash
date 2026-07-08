import type { PieceState } from '../game/types';

interface Props {
  piece: PieceState;
  color: string;
  hintGlow: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}

export function WordPiece({ piece, color, hintGlow, onPointerDown, onPointerMove, onPointerUp }: Props) {
  const size = piece.unit.length > 2 ? 96 : 88;

  return (
    <div
      id={`piece-${piece.id}`}
      className={`ws-piece${hintGlow ? ' ws-piece--hint' : ''}${piece.placed ? ' ws-piece--placed' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        position: 'absolute',
        left: `${piece.x - size / 2}px`,
        top: `${piece.y - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        transform: `rotate(${piece.rotation}deg)`,
        zIndex: piece.zIndex,
        backgroundColor: color,
        borderRadius: '14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: piece.unit.length > 3 ? '1.6rem' : piece.unit.length > 1 ? '2.2rem' : '2.8rem',
        fontWeight: 900,
        color: '#fff',
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
        boxShadow: piece.placed
          ? `0 2px 8px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.3)`
          : `0 6px 20px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.3)`,
        border: '3px solid rgba(255,255,255,0.4)',
        transition: piece.placed ? 'left 0.2s, top 0.2s, transform 0.2s' : 'box-shadow 0.15s',
        letterSpacing: '-0.02em',
        textShadow: '0 2px 4px rgba(0,0,0,0.4)',
        fontFamily: "'Fredoka One', 'Nunito', system-ui, sans-serif",
      }}
    >
      {piece.unit}
    </div>
  );
}
