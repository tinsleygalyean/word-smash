import { describe, it, expect } from 'vitest';
import { finishForLevelCount, hammerStageForLevel, HAMMER_STAGES, C, unitWidth } from './design';

describe('finishForLevelCount (TC-STO-04 finish mapping)', () => {
  it('maps 1→red, 2→teal, 3→gold, 4+→gold-face', () => {
    expect(finishForLevelCount(1).band).toBe(C.red);
    expect(finishForLevelCount(1).goldFace).toBe(false);
    expect(finishForLevelCount(2).band).toBe(C.teal);
    expect(finishForLevelCount(3).band).toBe(C.gold);
    expect(finishForLevelCount(3).goldFace).toBe(false);
    expect(finishForLevelCount(4).goldFace).toBe(true);
    expect(finishForLevelCount(9).goldFace).toBe(true);
  });

  it('a replay (same levelsPlayed) yields the identical finish — replays never advance it', () => {
    // levelsPlayed is what drives the finish; playCount is irrelevant by design.
    expect(finishForLevelCount(2)).toEqual(finishForLevelCount(2));
    expect(finishForLevelCount(1)).not.toEqual(finishForLevelCount(2));
  });
});

describe('hammer stages (TC-UI-07)', () => {
  it('has exactly 10 stages with size ramp 76→156', () => {
    expect(HAMMER_STAGES).toHaveLength(10);
    expect(HAMMER_STAGES[0].size).toBe(76);
    expect(HAMMER_STAGES[9].size).toBe(156);
    for (let i = 1; i < HAMMER_STAGES.length; i++) {
      expect(HAMMER_STAGES[i].size).toBeGreaterThan(HAMMER_STAGES[i - 1].size);
    }
  });

  it('maps level → stage index level-1, clamped to the valid range', () => {
    expect(hammerStageForLevel(1)).toBe(0);
    expect(hammerStageForLevel(10)).toBe(9);
    expect(hammerStageForLevel(0)).toBe(0);
    expect(hammerStageForLevel(99)).toBe(9);
  });
});

describe('unitWidth', () => {
  it('single letters get the base width; digraphs/syllables grow', () => {
    expect(unitWidth('a')).toBe(104);
    expect(unitWidth('ee')).toBeGreaterThan(104);
    expect(unitWidth('cac')).toBeGreaterThan(unitWidth('ee'));
  });
});
