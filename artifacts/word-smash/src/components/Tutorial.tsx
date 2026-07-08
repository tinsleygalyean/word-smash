interface Props {
  type: 'hammer' | 'drag';
}

export function Tutorial({ type }: Props) {
  if (type === 'hammer') {
    return (
      <div className="ws-tutorial ws-tutorial--hammer" aria-hidden="true">
        <div className="ws-tutorial-hand">
          <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
            <ellipse cx="30" cy="38" rx="22" ry="18" fill="rgba(0,0,0,0.5)" />
            <text x="30" y="44" textAnchor="middle" fontSize="36" fill="white">👆</text>
          </svg>
        </div>
        <div className="ws-tutorial-arrow">→</div>
        <svg width="40" height="56" viewBox="0 0 64 90" fill="none" opacity="0.6">
          <rect x="8" y="2" width="48" height="32" rx="6" fill="#8B6914" />
          <rect x="28" y="28" width="8" height="58" rx="4" fill="#6b4c1c" />
        </svg>
      </div>
    );
  }

  return (
    <div className="ws-tutorial ws-tutorial--drag" aria-hidden="true">
      <div className="ws-tutorial-hand ws-tutorial-hand--moving">
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <ellipse cx="30" cy="38" rx="22" ry="18" fill="rgba(0,0,0,0.5)" />
          <text x="30" y="44" textAnchor="middle" fontSize="36" fill="white">👆</text>
        </svg>
      </div>
    </div>
  );
}
