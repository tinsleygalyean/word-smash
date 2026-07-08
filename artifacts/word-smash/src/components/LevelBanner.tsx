interface Props {
  text: string;
  hammerStage: number;
}

const STAGE_NAMES = ['Starter', 'Iron', 'Cobalt', 'Royal'];
const STAGE_COLORS = ['#c9a040', '#6b9b3a', '#2a7fa8', '#8a2ab0'];

export function LevelBanner({ text, hammerStage }: Props) {
  const stageName = STAGE_NAMES[Math.min(hammerStage, 3)];
  const stageColor = STAGE_COLORS[Math.min(hammerStage, 3)];

  return (
    <div className="ws-level-banner">
      <div className="ws-level-banner-card">
        <div className="ws-level-banner-text">{text}</div>
        {hammerStage > 0 && (
          <div className="ws-level-banner-upgrade" style={{ color: stageColor }}>
            🔨 {stageName} Hammer!
          </div>
        )}
        <div className="ws-level-banner-stars">⭐⭐⭐</div>
      </div>
    </div>
  );
}
