import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { LangPack } from './types';
import { PHONEME_TTS, phonemeApprox } from './audio';

const LANG_DIR = path.resolve(__dirname, '../../public/lang/english');
const pack: LangPack = JSON.parse(readFileSync(path.join(LANG_DIR, 'wordsmash.json'), 'utf8'));

const allWords = pack.levels.flatMap((l) => l.words);
const allUnits = Array.from(new Set(allWords.flatMap((w) => w.units)));

describe('English pack content (TC-CNT-01)', () => {
  it('every word has units↔audio parity and all referenced MP3s exist on disk', () => {
    for (const w of allWords) {
      expect(w.units.length, `${w.id} units/audio mismatch`).toBe(w.audio.units.length);
      for (const p of [w.audio.slow, w.audio.natural, ...w.audio.units]) {
        expect(p.endsWith('.mp3'), `${w.id}: ${p} not an mp3`).toBe(true);
        expect(existsSync(path.join(LANG_DIR, p)), `missing file: ${p}`).toBe(true);
      }
      // units must recombine into the displayed word
      expect(w.units.join('')).toBe(w.display);
    }
  });
});

describe('level structure (TC-CNT-02)', () => {
  it('levels are 1–10, odd ghost / even no-ghost, 6 words each', () => {
    expect(pack.levels.map((l) => l.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const l of pack.levels) {
      expect(l.ghost, `level ${l.level} ghost flag`).toBe(l.level % 2 === 1);
      expect(l.words, `level ${l.level} word count`).toHaveLength(6);
    }
  });

  it('has the shipped totals: 24 distinct words, 144 MP3 references', () => {
    expect(new Set(allWords.map((w) => w.id)).size).toBe(24);
    const refs = new Set(allWords.flatMap((w) => [w.audio.slow, w.audio.natural, ...w.audio.units]));
    expect(refs.size).toBe(144);
  });
});

describe('recurring words (TC-CNT-03)', () => {
  it('keeps a stable id and display across levels while units may differ', () => {
    const byId = new Map<string, { display: string; unitVariants: Set<string> }>();
    for (const w of allWords) {
      const e = byId.get(w.id);
      if (e) {
        expect(w.display, `id ${w.id} display drift`).toBe(e.display);
        e.unitVariants.add(JSON.stringify(w.units));
      } else {
        byId.set(w.id, { display: w.display, unitVariants: new Set([JSON.stringify(w.units)]) });
      }
    }
    // e.g. cactus appears in multiple levels (L7/L8 and L9/L10)
    expect(byId.get('cactus')).toBeDefined();
    const recurring = allWords.filter((w) => w.id === 'cactus');
    expect(recurring.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// TC-AUD-03 — CRITICAL GUARD: no letter names, ever.
// The TTS fallback for every unit in the shipped pack must be a phoneme
// approximation from the map — never the raw unit (which TTS would read as a
// letter name like "bee" or "double-u").
// ---------------------------------------------------------------------------
const LETTER_NAMES: Record<string, string[]> = {
  a: ['ay', 'a'], b: ['bee', 'be'], c: ['see', 'cee'], d: ['dee'], e: ['ee', 'e'],
  f: ['ef', 'eff'], g: ['jee', 'gee'], h: ['aitch', 'haitch'], i: ['eye', 'i'],
  j: ['jay'], k: ['kay'], l: ['el', 'ell'], m: ['em'], n: ['en'], o: ['oh', 'o'],
  p: ['pee'], q: ['cue', 'queue'], r: ['ar'], s: ['ess', 'es'], t: ['tee'],
  u: ['you', 'yoo', 'u'], v: ['vee'], w: ['double you', 'doubleyou'], x: ['ex'],
  y: ['why', 'wye'], z: ['zee', 'zed'],
};

describe('no letter names, ever (TC-AUD-03 / release gate G4)', () => {
  it('every unit in the English pack has an explicit phoneme mapping', () => {
    for (const unit of allUnits) {
      expect(PHONEME_TTS[unit.toLowerCase()], `unit "${unit}" missing from phoneme map`).toBeDefined();
      expect(phonemeApprox(unit).length).toBeGreaterThan(0);
    }
  });

  it('no single-letter unit falls back to its letter NAME', () => {
    for (const unit of allUnits.filter((u) => u.length === 1)) {
      const spoken = phonemeApprox(unit).toLowerCase();
      const forbidden = LETTER_NAMES[unit.toLowerCase()] ?? [];
      expect(forbidden, `unit "${unit}" would be spoken as its letter name ("${spoken}")`)
        .not.toContain(spoken);
    }
  });

  it('the full phoneme map itself contains no letter names for single letters', () => {
    for (const [unit, spoken] of Object.entries(PHONEME_TTS)) {
      if (unit.length !== 1) continue;
      expect(LETTER_NAMES[unit] ?? [], `map entry "${unit}" → "${spoken}" is a letter name`)
        .not.toContain(spoken.toLowerCase());
    }
  });
});
