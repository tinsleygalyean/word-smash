import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  initEvents, emitSessionStart, emitWordCompleted, emitLevelCompleted, emitSummary,
} from './events';

type Envelope = {
  payload_id: string;
  cr_user_id: string;
  sub_app_id: string;
  payload_version: number;
  collection: string;
  timestamp: string;
  data: Record<string, unknown>;
  options?: Record<string, string>;
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function installBridge() {
  const posted: string[] = [];
  window.ReactNativeWebView = { postMessage: (m: string) => { posted.push(m); } };
  return posted;
}
function envelopes(posted: string[]): Envelope[] {
  return posted.map((m) => {
    const msg = JSON.parse(m);
    expect(msg.type).toBe('cr_event');
    return msg.payload as Envelope;
  });
}

beforeEach(() => {
  initEvents('', 'english'); // reset module state (cr_user_id defaults to "")
});

describe('outside the container (TC-EVT-01)', () => {
  it('posts nothing and never throws when no bridge exists', () => {
    delete window.ReactNativeWebView;
    expect(() => {
      emitSessionStart(1);
      emitWordCompleted({ level: 1, wordId: 'up', ghost: true, replay: false, score: 2, maxScore: 2, durationSeconds: 3, errors: 0, hintsUsed: 0, smashCount: 1 });
      emitSummary({ levelsPlayed: 1, wordsCompleted: 1, totalTimePlayed: 3, lastLevelNumber: 1 });
    }).not.toThrow();
  });

  it('a throwing bridge never breaks gameplay', () => {
    window.ReactNativeWebView = { postMessage: () => { throw new Error('boom'); } };
    expect(() => emitSessionStart(1)).not.toThrow();
  });
});

describe('envelope construction (TC-EVT-02)', () => {
  it('posts {type:"cr_event",payload} with exactly the §I.1.3 fields', () => {
    const posted = installBridge();
    emitSessionStart(3);
    const [env] = envelopes(posted);
    expect(Object.keys(env).sort()).toEqual(
      ['collection', 'cr_user_id', 'data', 'payload_id', 'payload_version', 'sub_app_id', 'timestamp'].sort(),
    );
    expect(env.sub_app_id).toBe('wordsmash');
    expect(env.payload_version).toBe(1);
    expect(env.collection).toBe('user_sessions_data');
    expect(env.payload_id).toMatch(UUID_V4);
    expect(new Date(env.timestamp).toString()).not.toBe('Invalid Date');
    expect(env.data).toMatchObject({ type: 'session_start', lang: 'english', current_level: 3 });
  });

  it('payload_id is a unique UUID v4 per payload', () => {
    const posted = installBridge();
    for (let i = 0; i < 25; i++) emitSessionStart(i);
    const ids = envelopes(posted).map((e) => e.payload_id);
    ids.forEach((id) => expect(id).toMatch(UUID_V4));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('options is present ONLY for summary_data', () => {
    const posted = installBridge();
    emitWordCompleted({ level: 2, wordId: 'cat', ghost: false, replay: true, score: 3, maxScore: 3, durationSeconds: 8, errors: 1, hintsUsed: 2, smashCount: 2 });
    emitLevelCompleted({ level: 2, ghost: false, durationSeconds: 60 });
    emitSummary({ levelsPlayed: 2, wordsCompleted: 12, totalTimePlayed: 60, lastLevelNumber: 2 });
    const [word, level, summary] = envelopes(posted);
    expect('options' in word).toBe(false);
    expect('options' in level).toBe(false);
    expect(summary.collection).toBe('summary_data');
    expect(summary.options).toEqual({
      levels_played: 'add',
      words_completed: 'add',
      total_time_played: 'add',
      last_level_number: 'replace',
    });
  });

  it('word_completed carries the full field set (TC-EVT-03 shape)', () => {
    const posted = installBridge();
    emitWordCompleted({ level: 5, wordId: 'frog', ghost: true, replay: false, score: 4, maxScore: 4, durationSeconds: 12.5, errors: 1, hintsUsed: 0, smashCount: 3 });
    const [env] = envelopes(posted);
    expect(env.data).toEqual({
      type: 'word_completed', lang: 'english',
      level: 5, word_id: 'frog', ghost: true, replay: false,
      score: 4, max_score: 4, duration_seconds: 12.5,
      errors: 1, hints_used: 0, smash_count: 3,
    });
  });
});

describe('cr_user_id (TC-EVT-04)', () => {
  it('is "" when never provided, and the launch value after initEvents', () => {
    const posted = installBridge();
    emitSessionStart(1);
    initEvents('kid-123', 'english');
    emitSessionStart(1);
    const [anon, known] = envelopes(posted);
    expect(anon.cr_user_id).toBe('');
    expect(known.cr_user_id).toBe('kid-123');
  });
});
