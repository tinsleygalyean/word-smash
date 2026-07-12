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

/**
 * §6: ONE plaque per wordId. Old saves may hold several plaques for the same
 * word (ghost + no-ghost + replays each appended one). Collapse them: keep the
 * most-recently-touched position/z-order, SUM their play counts, and take the
 * highest level reached.
 */
function dedupePlaques(raw: unknown[]): PlaqueState[] {
  const byWord = new Map<string, PlaqueState>();
  (raw as PlaqueState[]).forEach((p, i) => {
    if (!p || !p.wordId) return;
    const existing = byWord.get(p.wordId);
    const normalized: PlaqueState = {
      plaqueId: p.plaqueId ?? `plq-${p.wordId}`,
      wordId: p.wordId,
      display: p.display,
      units: p.units ?? [],
      x: p.x,
      y: p.y,
      zOrder: p.zOrder ?? i,
      playCount: p.playCount ?? 1,
      highestLevel: p.highestLevel ?? 1,
    };
    if (!existing) {
      byWord.set(p.wordId, normalized);
    } else {
      byWord.set(p.wordId, {
        ...normalized,
        plaqueId: existing.plaqueId,
        // most-recent wins for position/z (later entries were touched last)
        x: normalized.x,
        y: normalized.y,
        zOrder: Math.max(existing.zOrder, normalized.zOrder),
        playCount: existing.playCount + normalized.playCount,
        highestLevel: Math.max(existing.highestLevel, normalized.highestLevel),
      });
    }
  });
  return Array.from(byWord.values());
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
        plaques: dedupePlaques(parsed.plaques ?? []),
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
