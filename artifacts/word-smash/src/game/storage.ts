import type { WordCompletion, PlaqueState, TutorialFlags } from './types';

function key(lang: string, suffix: string): string {
  return `ws_${lang}_${suffix}`;
}

export interface Progress {
  currentLevel: number;
  completions: Record<string, WordCompletion>;
  hammerStage: number;
  plaques: PlaqueState[];
  tutorial: TutorialFlags;
}

export function getProgress(lang: string): Progress {
  try {
    const raw = localStorage.getItem(key(lang, 'progress'));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        currentLevel: parsed.currentLevel ?? 1,
        completions: parsed.completions ?? {},
        hammerStage: parsed.hammerStage ?? 0,
        plaques: (parsed.plaques ?? []).map((p: PlaqueState, i: number) => ({
          ...p,
          plaqueId: p.plaqueId ?? `plq-${p.wordId}-${i}-${p.playCount ?? 1}`,
        })),
        tutorial: { hammerDone: parsed.tutorial?.hammerDone ?? false },
      };
    }
  } catch {
    /* ignore */
  }
  return {
    currentLevel: 1,
    completions: {},
    hammerStage: 0,
    plaques: [],
    tutorial: { hammerDone: false },
  };
}

export function saveProgress(lang: string, data: Progress): void {
  try {
    localStorage.setItem(key(lang, 'progress'), JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function getWordQueueForLevel(lang: string, level: number): string[] | null {
  try {
    const raw = localStorage.getItem(key(lang, `queue_${level}`));
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

export function saveWordQueue(lang: string, level: number, queue: string[]): void {
  try {
    localStorage.setItem(key(lang, `queue_${level}`), JSON.stringify(queue));
  } catch {
    /* ignore */
  }
}

export function clearWordQueue(lang: string, level: number): void {
  try {
    localStorage.removeItem(key(lang, `queue_${level}`));
  } catch {
    /* ignore */
  }
}
