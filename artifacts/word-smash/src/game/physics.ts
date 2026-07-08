export interface ScatterTarget {
  x: number;
  y: number;
  rotation: number;
}

const UNIT_SEED = 13;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

export function computeScatterPositions(
  count: number,
  containerWidth: number,
  containerHeight: number,
  workbenchY: number,
  seed: number = UNIT_SEED
): ScatterTarget[] {
  const rand = seededRandom(seed + count * 137);
  const positions: ScatterTarget[] = [];

  const scatterTop = workbenchY + 60;
  const scatterBottom = containerHeight - 80;
  const scatterLeft = 60;
  const scatterRight = containerWidth - 60;

  const angleStep = (Math.PI * 0.8) / Math.max(count - 1, 1);
  const baseAngle = Math.PI * 0.1;

  for (let i = 0; i < count; i++) {
    const angle = baseAngle + angleStep * i + (rand() - 0.5) * 0.3;
    const distance = 120 + rand() * 180;
    const cx = containerWidth / 2;
    const cy = workbenchY - 30;

    let x = cx + Math.cos(angle) * distance * 1.2;
    let y = cy + Math.sin(angle) * distance;

    x = Math.max(scatterLeft, Math.min(scatterRight, x));
    y = Math.max(scatterTop, Math.min(scatterBottom, y));

    positions.push({
      x,
      y,
      rotation: (rand() - 0.5) * 40,
    });
  }

  return positions;
}

export function isNearSlot(
  pieceX: number,
  pieceY: number,
  slotX: number,
  slotY: number,
  threshold = 70
): boolean {
  const dx = pieceX - slotX;
  const dy = pieceY - slotY;
  return Math.sqrt(dx * dx + dy * dy) < threshold;
}
