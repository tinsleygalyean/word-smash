let userId = '';
let langCode = 'english';

function uuidv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function emit(dataType: string, data: Record<string, unknown>): void {
  try {
    const envelope = {
      payload_id: uuidv4(),
      sub_app_id: 'wordsmash',
      cr_user_id: userId,
      data: {
        type: dataType,
        lang: langCode,
        ...data,
      },
    };
    if (window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(envelope));
    }
  } catch {}
}

export function initEvents(uid: string, lang: string): void {
  userId = uid;
  langCode = lang;
}

export function emitSessionStart(currentLevel: number): void {
  emit('session_start', { current_level: currentLevel });
}

export function emitWordCompleted(params: {
  level: number;
  wordId: string;
  ghost: boolean;
  replay: boolean;
  score: number;
  maxScore: number;
  durationSeconds: number;
  errors: number;
  hintsUsed: number;
  smashCount: number;
}): void {
  emit('word_completed', {
    level: params.level,
    word_id: params.wordId,
    ghost: params.ghost,
    replay: params.replay,
    score: params.score,
    max_score: params.maxScore,
    duration_seconds: params.durationSeconds,
    errors: params.errors,
    hints_used: params.hintsUsed,
    smash_count: params.smashCount,
  });
}

export function emitLevelCompleted(params: {
  level: number;
  ghost: boolean;
  durationSeconds: number;
}): void {
  emit('level_completed', {
    level: params.level,
    ghost: params.ghost,
    duration_seconds: params.durationSeconds,
  });
}

export function emitSummary(params: {
  levelsPlayed: number;
  wordsCompleted: number;
  totalTimePlayed: number;
  lastLevelNumber: number;
}): void {
  try {
    const envelope = {
      payload_id: uuidv4(),
      sub_app_id: 'wordsmash',
      cr_user_id: userId,
      summary_data: {
        data: {
          levels_played: params.levelsPlayed,
          words_completed: params.wordsCompleted,
          total_time_played: params.totalTimePlayed,
          last_level_number: params.lastLevelNumber,
        },
        options: {
          levels_played: 'add',
          words_completed: 'add',
          total_time_played: 'add',
          last_level_number: 'replace',
        },
      },
    };
    if (window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify(envelope));
    }
  } catch {}
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  }
}
