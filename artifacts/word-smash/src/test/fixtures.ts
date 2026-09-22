import type { LangPack, Word } from '../game/types';

function word(id: string, units: string[]): Word {
  return {
    id,
    display: units.join(''),
    units,
    audio: {
      slow: `audios/${id}_slow.mp3`,
      natural: `audios/${id}_natural.mp3`,
      units: units.map((u) => `audios/${u}.mp3`), // shared unit clips, mirrors build-content.mjs
    },
  };
}

/**
 * F-PACK-MINI (TESTSPEC §2) — a 2-level mini pack for fast deterministic
 * engine/UI tests: L1 ghost with a digraph word + a CVC word, L2 no-ghost.
 */
export const MINI_PACK: LangPack = {
  langCode: 'test',
  levels: [
    { level: 1, ghost: true, words: [word('up', ['u', 'p']), word('bee', ['b', 'ee'])] },
    { level: 2, ghost: false, words: [word('up', ['u', 'p']), word('cat', ['c', 'a', 't'])] },
  ],
};
