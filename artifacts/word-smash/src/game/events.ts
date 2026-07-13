// Curious Reader data-reporting bridge (cr_event contract, spec §6).
//
// Every message is posted over the WebView JS bridge as a single JSON string:
//   { "type": "cr_event", "payload": { …envelope… } }
// The envelope carries the exact top-level fields the container validator
// requires (§6.2): payload_id, cr_user_id, sub_app_id, payload_version,
// collection, timestamp, data, and — for summary_data only — options.
//
// Reporting is fire-and-forget, exception-safe, performs no network I/O, and is
// a silent no-op outside the container (plain browser / dev).

const SUB_APP_ID = 'wordsmash';
const PAYLOAD_VERSION = 1;

let userId = '';
let langCode = 'english';

function uuidv4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Spec §6.4 fallback: prefer CSPRNG bytes over Math.random.
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
    return `${h.slice(0, 4).join('')}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h.slice(10).join('')}`;
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

type Collection = 'user_sessions_data' | 'summary_data';

function post(
  collection: Collection,
  data: Record<string, unknown>,
  options?: Record<string, 'add' | 'replace'>,
): void {
  try {
    if (
      typeof window === 'undefined' ||
      typeof window.ReactNativeWebView?.postMessage !== 'function'
    ) {
      return;
    }
    const payload: Record<string, unknown> = {
      payload_id: uuidv4(),
      cr_user_id: userId,
      sub_app_id: SUB_APP_ID,
      payload_version: PAYLOAD_VERSION,
      collection,
      timestamp: new Date().toISOString(),
      data,
    };
    // `options` is meaningful only for summary_data (§6.2/§6.3); it is ignored
    // for user_sessions_data, so omit it there entirely.
    if (collection === 'summary_data') {
      payload.options = options ?? {};
    }
    window.ReactNativeWebView.postMessage(
      JSON.stringify({ type: 'cr_event', payload }),
    );
  } catch {
    // never let reporting break gameplay
  }
}

// user_sessions_data helper: always stamps `type` (snake_case) and `lang`.
function emit(dataType: string, data: Record<string, unknown>): void {
  post('user_sessions_data', {
    type: dataType,
    lang: langCode,
    ...data,
  });
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
  post(
    'summary_data',
    {
      levels_played: params.levelsPlayed,
      words_completed: params.wordsCompleted,
      total_time_played: params.totalTimePlayed,
      last_level_number: params.lastLevelNumber,
    },
    {
      levels_played: 'add',
      words_completed: 'add',
      total_time_played: 'add',
      last_level_number: 'replace',
    },
  );
}

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
  }
}
