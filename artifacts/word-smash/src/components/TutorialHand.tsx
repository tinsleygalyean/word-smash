import { HAMMER_DOCK, C } from '../game/design';

interface Props {
  target: { x: number; y: number };
}

/**
 * Demonstrating hand: a ghost hand + faint hammer glides from the dock toward
 * the plaque on a loop, tracing a dotted path. Never smashes — the payoff is
 * reserved for the child. Fades if the child touches anything (handled by the
 * parent unmounting this component). §6a
 */
export function TutorialHand({ target }: Props) {
  const from = HAMMER_DOCK;
  const midX = (from.x + target.x) / 2;
  const midY = Math.min(from.y, target.y) - 60;

  return (
    <svg
      viewBox="0 0 1200 540"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 500 }}
    >
      {/* dotted path */}
      <path
        d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${target.x + 90} ${target.y}`}
        fill="none"
        stroke={C.faceTop}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="2 18"
        opacity="0.85"
      />
      {/* travelling ghost hammer + hand */}
      <g opacity="0.9">
        <animateMotion dur="1.6s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.72;1" calcMode="spline" keySplines="0.4 0 0.2 1;0 0 1 1">
          <mpath href="#ws-tut-path" />
        </animateMotion>
        {/* faint hammer */}
        <g transform="translate(-30,-40) rotate(-20)" opacity="0.6">
          <rect x="18" y="30" width="10" height="46" rx="5" fill={C.handle} />
          <rect x="2" y="10" width="44" height="24" rx="8" fill={C.red} />
        </g>
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
      <path id="ws-tut-path" d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${target.x + 90} ${target.y}`} fill="none" stroke="none" />
    </svg>
  );
}
