import { HAMMER_DOCK, C } from '../game/design';

export type HandMode = 'hammer' | 'holdThrough' | 'dragPiece';

interface Props {
  target: { x: number; y: number };
  mode?: HandMode;
  from?: { x: number; y: number }; // dragPiece: piece origin
  to?: { x: number; y: number };   // dragPiece: slot destination
}

/**
 * Demonstrating hand (§9). Three demo loops:
 *  - 'hammer':      drag a ghost hammer from the dock toward the plaque, stopping
 *                   short of the strike zone (never smashes — that payoff is the child's).
 *  - 'holdThrough': drag the ghost hammer all the way in and visibly HOLD through
 *                   the wind-up (shown for repeated released-early half-swings).
 *  - 'dragPiece':   drag a loose piece to its slot (shown when nothing is dragged).
 * The parent unmounts this on any child touch, which is the handoff.
 */
export function TutorialHand({ target, mode = 'hammer', from, to }: Props) {
  const src = mode === 'dragPiece' && from ? from : HAMMER_DOCK;
  const dstX = mode === 'hammer' ? target.x + 90 : mode === 'dragPiece' && to ? to.x : target.x;
  const dstY = mode === 'dragPiece' && to ? to.y : target.y;
  const midX = (src.x + dstX) / 2;
  const midY = Math.min(src.y, dstY) - 60;
  const pathD = `M ${src.x} ${src.y} Q ${midX} ${midY} ${dstX} ${dstY}`;
  // hold-through pauses longer at the destination to show "keep holding"
  const keyTimes = mode === 'holdThrough' ? '0;0.55;1' : '0;0.72;1';
  const dur = mode === 'dragPiece' ? '1.8s' : '1.6s';
  const showGhostHammer = mode !== 'dragPiece';

  return (
    <svg
      viewBox="0 0 1200 540"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 500 }}
    >
      {/* dotted path */}
      <path
        d={pathD}
        fill="none"
        stroke={C.faceTop}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="2 18"
        opacity="0.85"
      />
      {/* travelling ghost hand (+ hammer when demoing the swing) */}
      <g opacity="0.9">
        <animateMotion dur={dur} repeatCount="indefinite" keyPoints="0;1;1" keyTimes={keyTimes} calcMode="spline" keySplines="0.4 0 0.2 1;0 0 1 1">
          <mpath href="#ws-tut-path" />
        </animateMotion>
        {showGhostHammer && (
          <g transform="translate(-30,-40) rotate(-20)" opacity="0.6">
            <rect x="18" y="30" width="10" height="46" rx="5" fill={C.handle} />
            <rect x="2" y="10" width="44" height="24" rx="8" fill={C.red} />
          </g>
        )}
        {/* hand */}
        <g className="ws-hand-grip">
          <circle cx="0" cy="0" r="20" fill="#fff" opacity="0.95" />
          <circle cx="0" cy="0" r="20" fill="none" stroke={C.gold} strokeWidth="3">
            <animate attributeName="r" values="20;26;20" dur="0.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.9;0.2;0.9" dur="0.8s" repeatCount="indefinite" />
          </circle>
          <path d="M-6 6 q6 -14 12 0 z" fill={C.ink} opacity="0.7" />
        </g>
      </g>
      <path id="ws-tut-path" d={pathD} fill="none" stroke="none" />
    </svg>
  );
}
