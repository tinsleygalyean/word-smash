import { STAGE_W } from './design';

/** Convert a screen (client) point into reference-canvas (1200×540) coords. */
export function screenToStage(
  stageEl: HTMLElement | null,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  if (!stageEl) return { x: clientX, y: clientY };
  const rect = stageEl.getBoundingClientRect();
  const scale = rect.width / STAGE_W;
  return {
    x: (clientX - rect.left) / scale,
    y: (clientY - rect.top) / scale,
  };
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
