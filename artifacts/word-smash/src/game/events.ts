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

// The game slug — the same identifier as the packaging/upload engineSlug.
// Stable across releases (spec §6.2); changing it orphans the warehouse data.
const SUB_APP_ID = 'wordsmash';
const PAYLOAD_VERSION = 1;
// Hard cap on one bridge message (spec §6.1).
const MAX_MESSAGE_BYTES = 64 * 1024;

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
    const json = JSON.stringify({ type: 'cr_event', payload });
    // §6.1 caps a message at 64 KB and rejects an oversize one WHOLE — and
    // because reporting is fire-and-forget the game gets no signal, so the
    // event would vanish silently. Drop it here instead, where a developer can
    // see why. `data` is open-ended (§6.2), so this is not hypothetical.
    if (new TextEncoder().encode(json).length > MAX_MESSAGE_BYTES) {
      console.warn(
        `cr_event dropped: ${data.type ?? collection} exceeds the ${MAX_MESSAGE_BYTES}-byte cap`,
      );
      return;
    }
    window.ReactNativeWebView.postMessage(json);
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

// summary_data: ONE call per level completion, merged into the player's lifetime
// document by the container per the `options` ops below.
//
// `add` fields must carry the DELTA for this level, never a running total or a
// level number — the container increments by whatever is sent. `levels_played`
// is therefore hardcoded to 1 and deliberately not a parameter: passing
// `level` there (which this once did) makes the lifetime count grow as
// 1+2+3+… instead of 1 per level.
//
// `lang` is stamped on every payload so a device with two language packs
// installed reports distinguishable data (spec §6.3 conventions).
export function emitSummary(params: {
  /** Words completed in the level just finished — a delta, not a lifetime total. */
  wordsCompleted: number;
  /** Seconds spent in the level just finished — a delta. */
  totalTimePlayed: number;
  lastLevelNumber: number;
}): void {
  post(
    'summary_data',
    {
      lang: langCode,
      levels_played: 1,
      words_completed: params.wordsCompleted,
      total_time_played: params.totalTimePlayed,
      last_level_number: params.lastLevelNumber,
    },
    {
      lang: 'replace',
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
