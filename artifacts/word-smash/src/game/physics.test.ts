import { describe, it, expect } from 'vitest';
import { computeScatterPositions, isNearSlot } from './physics';

const W = 1200;
const H = 540;
const WORKBENCH_Y = 248;
const F_SEED = 4242; // F-SEED — fixed physics seed (TESTSPEC §2)

describe('computeScatterPositions (TC-PHY-01 determinism)', () => {
  it('returns identical output for identical seed + count', () => {
    for (const count of [2, 3, 4, 6]) {
      const a = computeScatterPositions(count, W, H, WORKBENCH_Y, F_SEED);
      const b = computeScatterPositions(count, W, H, WORKBENCH_Y, F_SEED);
      expect(a).toEqual(b);
    }
  });

  it('produces different layouts for different seeds', () => {
    const a = computeScatterPositions(4, W, H, WORKBENCH_Y, 1);
    const b = computeScatterPositions(4, W, H, WORKBENCH_Y, 999);
    expect(a).not.toEqual(b);
  });

  it('is deterministic with the default seed too', () => {
    expect(computeScatterPositions(3, W, H, WORKBENCH_Y)).toEqual(
      computeScatterPositions(3, W, H, WORKBENCH_Y),
    );
  });
});

describe('computeScatterPositions (TC-PHY-02 bounds)', () => {
  it('keeps every target inside the scatter box for counts 2–6', () => {
    for (let count = 2; count <= 6; count++) {
      for (const seed of [F_SEED, 1, 77, 1337]) {
        const targets = computeScatterPositions(count, W, H, WORKBENCH_Y, seed);
        expect(targets).toHaveLength(count);
        for (const t of targets) {
          expect(t.x).toBeGreaterThanOrEqual(60);
          expect(t.x).toBeLessThanOrEqual(W - 60);
          expect(t.y).toBeGreaterThanOrEqual(WORKBENCH_Y + 60);
          expect(t.y).toBeLessThanOrEqual(H - 80);
          // §3: ±20° tumble
          expect(Math.abs(t.rotation)).toBeLessThanOrEqual(20);
        }
      }
    }
  });
});

describe('isNearSlot (TC-PHY-03 drop acceptance geometry)', () => {
  it('accepts inside the threshold, rejects outside', () => {
    expect(isNearSlot(100, 100, 100, 100)).toBe(true);
    expect(isNearSlot(100, 100, 100 + 69, 100)).toBe(true);
    expect(isNearSlot(100, 100, 100 + 70, 100)).toBe(false); // exact threshold excluded
    expect(isNearSlot(100, 100, 100, 100 + 200)).toBe(false);
  });

  it('honors a custom threshold (SNAP = 80 used by the drop handler)', () => {
    expect(isNearSlot(0, 0, 79, 0, 80)).toBe(true);
    expect(isNearSlot(0, 0, 81, 0, 80)).toBe(false);
  });
});
