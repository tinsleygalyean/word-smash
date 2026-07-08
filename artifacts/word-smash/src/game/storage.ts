import type { WordCompletion, PlaqueState, TutorialFlags } from './types';

function key(lang: string, suffix: string): string {
  return `ws_${lang}_${suffix}`;
}

export function getProgress(lang: string): {
  currentLevel: number;
  completions: Record<string, WordCompletion>;
  hammerStage: number;
  plaques: PlaqueState[];
  tutorial: TutorialFlags;
} {
  try {
    const raw = localStorage.getItem(key(lang, 'progress'));
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    currentLevel: 1,
    completions: {},
    hammerStage: 0,
    plaques: [],
    tutorial: { hammerSeen: false, dragSeen: false },
  };
}

export function saveProgress(lang: string, data: {
  currentLevel: number;
  completions: Record<string, WordCompletion>;
  hammerStage: number;
  plaques: PlaqueState[];
  tutorial: TutorialFlags;
}): void {
  try {
    localStorage.setItem(key(lang, 'progress'), JSON.stringify(data));
  } catch {}
}

export function getWordQueueForLevel(lang: string, level: number): string[] | null {
  try {
    const raw = localStorage.getItem(key(lang, `queue_${level}`));
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

export function saveWordQueue(lang: string, level: number, queue: string[]): void {
  try {
    localStorage.setItem(key(lang, `queue_${level}`), JSON.stringify(queue));
  } catch {}
}

export function clearWordQueue(lang: string, level: number): void {
  try {
    localStorage.removeItem(key(lang, `queue_${level}`));
  } catch {}
}
