import type { PlaqueState } from '../game/types';

interface Props {
  plaques: PlaqueState[];
}

const ANCHOR_POSITIONS = [
  { x: 8, y: 2 }, { x: 22, y: 4 }, { x: 37, y: 2 }, { x: 52, y: 4 }, { x: 67, y: 2 },
  { x: 82, y: 4 }, { x: 15, y: 14 }, { x: 30, y: 12 }, { x: 45, y: 14 }, { x: 60, y: 12 },
  { x: 75, y: 14 }, { x: 8, y: 24 }, { x: 23, y: 22 }, { x: 38, y: 24 }, { x: 53, y: 22 },
  { x: 68, y: 24 }, { x: 83, y: 22 },
];

export function WallPlaques({ plaques }: Props) {
  if (plaques.length === 0) return <div className="ws-wall" />;

  return (
    <div className="ws-wall">
      {plaques.map((plaque, i) => {
        const anchorIdx = plaque.anchorIndex % ANCHOR_POSITIONS.length;
        const anchor = ANCHOR_POSITIONS[anchorIdx];
        const x = anchor.x + plaque.offsetX;
        const y = anchor.y + plaque.offsetY;

        return (
          <div
            key={`${plaque.wordId}-${i}`}
            className={`ws-plaque${plaque.ghost ? ' ws-plaque--ghost' : ''}`}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              transform: `rotate(${plaque.rotation}deg)`,
              zIndex: 10 + plaque.zOrder,
            }}
            title={plaque.display}
          >
            <div className="ws-plaque-inner">
              <div className="ws-plaque-word">{plaque.display}</div>
              <div className="ws-plaque-units">
                {plaque.units.map((u, j) => (
                  <span key={j} className="ws-plaque-unit">{u}</span>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
