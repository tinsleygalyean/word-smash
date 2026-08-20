import { describe, it, expect, beforeEach } from 'vitest';
import {
  getProgress, saveProgress, resetProgress,
  getWordQueueForLevel, saveWordQueue, clearWordQueue,
  type Progress,
} from './storage';
import type { WordCompletion } from './types';

const LANG = 'test';

function completion(wordId: string, level: number, playCount = 1): WordCompletion {
  return {
    wordId, display: wordId, units: wordId.split(''),
    ghostDone: level % 2 === 1, noGhostDone: level % 2 === 0,
    highestLevel: level, playCount,
  };
}

beforeEach(() => localStorage.clear());

describe('progress round-trip (TC-STO-01 / TC-STO-07)', () => {
  it('saveProgress → getProgress returns an equal Progress', () => {
    const p: Progress = {
      currentLevel: 4,
      completions: { cat_L3: completion('cat', 3, 2) },
      hammerStage: 3,
      plaques: [{
        plaqueId: 'plq-cat', wordId: 'cat', display: 'cat', units: ['c', 'a', 't'],
        x: 300, y: 120, zOrder: 5, playCount: 2, highestLevel: 3, levelsPlayed: 1,
      }],
      tutorial: { hammerDone: true },
    };
    saveProgress(LANG, p);
    expect(getProgress(LANG)).toEqual(p);
  });

  it('cold start yields safe defaults', () => {
    expect(getProgress(LANG)).toEqual({
      currentLevel: 1, completions: {}, hammerStage: 0, plaques: [], tutorial: { hammerDone: false },
    });
  });
});

describe('legacy save migration (TC-STO-02)', () => {
  it('collapses multiple plaques per wordId keeping most-recent position and max z-order', () => {
    // F-SAVE-LEGACY: several plaques for "up", no highestLevel/playCount/levelsPlayed
    localStorage.setItem(`ws_${LANG}_progress`, JSON.stringify({
      currentLevel: 3,
      completions: { up_L1: completion('up', 1), up_L2: { ...completion('up', 2, 2), highestLevel: undefined } },
      plaques: [
        { plaqueId: 'old-1', wordId: 'up', display: 'up', units: ['u', 'p'], x: 100, y: 80, zOrder: 1 },
        { plaqueId: 'old-2', wordId: 'up', display: 'up', units: ['u', 'p'], x: 400, y: 90, zOrder: 7 },
        { wordId: 'up', display: 'up', units: ['u', 'p'], x: 250, y: 60, zOrder: 3 },
      ],
    }));
    const p = getProgress(LANG);
    expect(p.plaques).toHaveLength(1);
    const plaque = p.plaques[0];
    // first-seen plaqueId is kept stable; latest entry wins position; max z wins
    expect(plaque.plaqueId).toBe('old-1');
    expect(plaque.x).toBe(250);
    expect(plaque.y).toBe(60);
    expect(plaque.zOrder).toBe(7);
  });
});

describe('migration reconciliation (TC-STO-03)', () => {
  it('derives highestLevel/playCount/levelsPlayed from completions — never blind-defaults to 1', () => {
    localStorage.setItem(`ws_${LANG}_progress`, JSON.stringify({
      currentLevel: 5,
      completions: {
        cat_L3: { wordId: 'cat', display: 'cat', units: ['c', 'a', 't'], ghostDone: true, noGhostDone: false, playCount: 3 },
        cat_L4: { wordId: 'cat', display: 'cat', units: ['c', 'a', 't'], ghostDone: true, noGhostDone: true, playCount: 5 },
      },
      // legacy plaque with none of the new fields
      plaques: [{ plaqueId: 'p', wordId: 'cat', display: 'cat', units: ['c', 'a', 't'], x: 1, y: 2, zOrder: 0 }],
    }));
    const p = getProgress(LANG);
    expect(p.plaques).toHaveLength(1);
    // level parsed from the `${wordId}_L${level}` completion keys
    expect(p.plaques[0].highestLevel).toBe(4);
    expect(p.plaques[0].playCount).toBe(5);
    expect(p.plaques[0].levelsPlayed).toBe(2); // distinct levels: 3 and 4
  });

  it('a never-completed plaque still floors counts at 1', () => {
    localStorage.setItem(`ws_${LANG}_progress`, JSON.stringify({
      currentLevel: 1,
      completions: {},
      plaques: [{ plaqueId: 'p', wordId: 'up', display: 'up', units: ['u', 'p'], x: 1, y: 2, zOrder: 0 }],
    }));
    const p = getProgress(LANG);
    expect(p.plaques[0].highestLevel).toBe(1);
    expect(p.plaques[0].playCount).toBe(1);
    expect(p.plaques[0].levelsPlayed).toBe(1);
  });
});

describe('corrupt saves (TC-STO-05)', () => {
  it('malformed JSON yields safe defaults, no throw', () => {
    localStorage.setItem(`ws_${LANG}_progress`, '{not json!!');
    localStorage.setItem(`ws_${LANG}_queue_2`, '[broken');
    expect(() => getProgress(LANG)).not.toThrow();
    expect(getProgress(LANG).currentLevel).toBe(1);
    expect(getWordQueueForLevel(LANG, 2)).toBeNull();
  });

  it('non-object plaque entries are dropped, not crashed on', () => {
    localStorage.setItem(`ws_${LANG}_progress`, JSON.stringify({
      currentLevel: 2, completions: {}, plaques: [null, 42, { noWordId: true }],
    }));
    expect(getProgress(LANG).plaques).toEqual([]);
  });
});

describe('resetProgress (TC-STO-06)', () => {
  it('removes every ws_<lang>_* key and nothing else', () => {
    saveProgress(LANG, { currentLevel: 7, completions: {}, hammerStage: 6, plaques: [], tutorial: { hammerDone: true } });
    saveWordQueue(LANG, 7, ['cat', 'sun']);
    saveWordQueue(LANG, 3, ['pig']);
    localStorage.setItem('ws_otherlang_progress', '{"currentLevel":9}');
    localStorage.setItem('unrelated', 'keep');
    resetProgress(LANG);
    expect(getProgress(LANG).currentLevel).toBe(1); // back to level 1
    expect(getWordQueueForLevel(LANG, 7)).toBeNull();
    expect(getWordQueueForLevel(LANG, 3)).toBeNull();
    expect(localStorage.getItem('ws_otherlang_progress')).not.toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
});

describe('word queue persistence (TC-ENG-05 storage half)', () => {
  it('round-trips and clears the per-level queue', () => {
    expect(getWordQueueForLevel(LANG, 4)).toBeNull();
    saveWordQueue(LANG, 4, ['sun', 'cat', 'top']);
    expect(getWordQueueForLevel(LANG, 4)).toEqual(['sun', 'cat', 'top']);
    clearWordQueue(LANG, 4);
    expect(getWordQueueForLevel(LANG, 4)).toBeNull();
  });
});
