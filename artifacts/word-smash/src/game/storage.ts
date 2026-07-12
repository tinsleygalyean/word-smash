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
 * Derive the authoritative per-word `highestLevel` and cumulative `playCount`
 * from the completions record. Completions are the source of truth: each
 * `WordCompletion` carries the running `highestLevel`/`playCount`, and its key
 * (`${wordId}_L${level}`) encodes the level even on legacy saves whose stored
 * `highestLevel` field predates that field.
 */
function deriveFromCompletions(
  completions: Record<string, WordCompletion>,
): { level: Map<string, number>; play: Map<string, number> } {
  const level = new Map<string, number>();
  const play = new Map<string, number>();
  for (const [k, c] of Object.entries(completions ?? {})) {
    if (!c || !c.wordId) continue;
    const wid = c.wordId;
    const m = k.match(/_L(\d+)$/);
    const parsedLvl = m ? Number(m[1]) : 0;
    const lvl = Math.max(c.highestLevel ?? 0, parsedLvl || 0);
    level.set(wid, Math.max(level.get(wid) ?? 0, lvl));
    play.set(wid, Math.max(play.get(wid) ?? 0, c.playCount ?? 0));
  }
  return { level, play };
}

/**
 * §6: ONE plaque per wordId. Old saves may hold several plaques for the same
 * word (ghost + no-ghost + replays each appended one). Collapse them: keep the
 * most-recently-touched position/z-order, and set play count + highest level
 * from the authoritative completions record (falling back to any explicit value
 * on the plaque itself). Legacy plaques predate the `highestLevel`/`playCount`
 * fields, so defaulting them to 1 would run replays at the wrong level — always
 * cross-reference completions.
 */
function dedupePlaques(
  raw: unknown[],
  completions: Record<string, WordCompletion>,
): PlaqueState[] {
  const { level: derivedLevel, play: derivedPlay } = deriveFromCompletions(completions);
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
      playCount: p.playCount ?? 0,
      highestLevel: p.highestLevel ?? 0,
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
        // explicit per-plaque counts only ever appear on the new one-per-word
        // schema, so max (not sum) is correct and avoids double counting.
        playCount: Math.max(existing.playCount, normalized.playCount),
        highestLevel: Math.max(existing.highestLevel, normalized.highestLevel),
      });
    }
  });
  // reconcile each word against the authoritative completions record
  for (const [wid, plaque] of byWord) {
    byWord.set(wid, {
      ...plaque,
      playCount: Math.max(plaque.playCount, derivedPlay.get(wid) ?? 0, 1),
      highestLevel: Math.max(plaque.highestLevel, derivedLevel.get(wid) ?? 0, 1),
    });
  }
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
        plaques: dedupePlaques(parsed.plaques ?? [], parsed.completions ?? {}),
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

/** Wipe ALL saved state for a language (progress, plaques, queues) → back to level 1. */
export function resetProgress(lang: string): void {
  try {
    const prefix = `ws_${lang}_`;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
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
