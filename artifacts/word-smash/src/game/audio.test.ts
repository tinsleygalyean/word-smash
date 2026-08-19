/**
 * TC-AUD-01/02/04/05/06 — Audio system tests
 * TESTSPEC §4.2
 *
 * Each describe block calls vi.resetModules() + dynamic import so every test
 * starts with a clean module state (empty bufferCache, null audioCtx,
 * lastCrashIndex = -1, currentSource = null).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock-buffer factory ─────────────────────────────────────────────────────

function makeMockAudioBuffer(length = 44100): AudioBuffer {
  return {
    length,
    sampleRate: 44100,
    numberOfChannels: 1,
    duration: length / 44100,
    getChannelData: () => new Float32Array(length),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

// ─── Audio-context mock factory ──────────────────────────────────────────────

interface MockSource {
  buffer: AudioBuffer | null;
  connect: ReturnType<typeof vi.fn>;
  start:   ReturnType<typeof vi.fn>;
  stop:    ReturnType<typeof vi.fn>;
  onended: null | (() => void);
}

interface AudioCtxMocks {
  ctx:            ReturnType<typeof buildCtx>;
  decodeAudioData: ReturnType<typeof vi.fn>;
  createdSources: MockSource[];
  createdFilters: Array<{ type: string; frequency: { value: number } }>;
}

function buildCtx(decodeMode: 'success' | 'fail', createdSources: MockSource[], createdFilters: Array<{ type: string; frequency: { value: number } }>) {
  const decodeAudioData = vi.fn().mockImplementation(() =>
    decodeMode === 'success'
      ? Promise.resolve(makeMockAudioBuffer(44100))
      : Promise.reject(new Error('decode failed')),
  );

  return {
    currentTime: 0,
    sampleRate:  44100,
    state:       'running' as AudioContextState,
    destination: {} as unknown as AudioDestinationNode,
    resume:      vi.fn().mockResolvedValue(undefined),
    decodeAudioData,
    createBuffer: vi.fn((_ch: number, len: number) => makeMockAudioBuffer(len)),
    createBufferSource: vi.fn(() => {
      const src: MockSource = { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
      createdSources.push(src);
      return src;
    }),
    createGain: vi.fn(() => ({
      gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    })),
    createBiquadFilter: vi.fn(() => {
      const f = {
        type: 'lowpass' as BiquadFilterType,
        frequency: { value: 350, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        Q: { value: 1 },
        connect: vi.fn(),
      };
      createdFilters.push(f);
      return f;
    }),
    createOscillator: vi.fn(() => ({
      type: 'sine' as OscillatorType,
      frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start:   vi.fn(),
      stop:    vi.fn(),
    })),
  };
}

function buildAudioCtxMock(decodeMode: 'success' | 'fail'): AudioCtxMocks {
  const createdSources: MockSource[] = [];
  const createdFilters: Array<{ type: string; frequency: { value: number } }> = [];
  const ctx = buildCtx(decodeMode, createdSources, createdFilters);
  // Must be a real constructable function — arrow functions can't be `new`-ed.
  vi.stubGlobal('AudioContext', function MockAudioContext(this: unknown) { return ctx; });
  return { ctx, decodeAudioData: ctx.decodeAudioData, createdSources, createdFilters };
}

// ─── XHR stub ────────────────────────────────────────────────────────────────

function stubXHR(status: 200 | 0 | 404) {
  vi.stubGlobal('XMLHttpRequest', vi.fn().mockImplementation(function (this: any) {
    this.responseType = '';
    this.response     = (status === 200 || status === 0) ? new ArrayBuffer(8) : null;
    this.status       = status;
    this.onload       = null as null | (() => void);
    this.onerror      = null as null | (() => void);
    this.open         = vi.fn();
    this.send         = vi.fn().mockImplementation(() => {
      if (status === 200 || status === 0) {
        Promise.resolve().then(() => this.onload?.());
      } else {
        Promise.resolve().then(() => this.onerror?.());
      }
    });
  }));
}

// ─── speechSynthesis stub ────────────────────────────────────────────────────

function stubSpeechSynthesis() {
  const speak  = vi.fn();
  const cancel = vi.fn();
  vi.stubGlobal('speechSynthesis', { speak, cancel });
  // Must be a real constructable function — arrow functions can't be `new`-ed.
  vi.stubGlobal('SpeechSynthesisUtterance', function MockSpeechSynthesisUtterance(this: any, text: string) {
    this.text   = text;
    this.rate   = 1;
    this.pitch  = 1;
    this.volume = 1;
  });
  return { speak, cancel };
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-AUD-01: recorded-buffer path taken when decodeAudioData succeeds
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-AUD-01: recorded buffer path (decode succeeds)', () => {
  let audio: typeof import('./audio');
  let mocks: AudioCtxMocks;
  let tts: ReturnType<typeof stubSpeechSynthesis>;

  beforeEach(async () => {
    vi.resetModules();
    mocks = buildAudioCtxMock('success');
    stubXHR(200);
    tts   = stubSpeechSynthesis();
    audio = await import('./audio');
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('playWordSlow: decodeAudioData called, buffer source started, TTS not used', async () => {
    await audio.playWordSlow('/word-slow.mp3', 'cat');
    expect(mocks.decodeAudioData).toHaveBeenCalledOnce();
    expect(mocks.createdSources).toHaveLength(1);
    expect(mocks.createdSources[0].start).toHaveBeenCalled();
    expect(tts.speak).not.toHaveBeenCalled();
  });

  it('playWordNatural: decodeAudioData called, buffer source started, TTS not used', async () => {
    await audio.playWordNatural('/word-natural.mp3', 'cat');
    expect(mocks.decodeAudioData).toHaveBeenCalledOnce();
    expect(mocks.createdSources).toHaveLength(1);
    expect(mocks.createdSources[0].start).toHaveBeenCalled();
    expect(tts.speak).not.toHaveBeenCalled();
  });

  it('playUnit: decodeAudioData called, buffer source started with interrupt=false, TTS not used', async () => {
    await audio.playUnit('/unit-b.mp3', 'b');
    expect(mocks.decodeAudioData).toHaveBeenCalledOnce();
    expect(mocks.createdSources).toHaveLength(1);
    expect(mocks.createdSources[0].start).toHaveBeenCalled();
    expect(tts.speak).not.toHaveBeenCalled();
  });

  it('bufferCache: second call for same path skips decodeAudioData', async () => {
    await audio.playWordSlow('/shared.mp3', 'dog');
    await audio.playWordSlow('/shared.mp3', 'dog');
    // XHR + decode only once; second call served from cache
    expect(mocks.decodeAudioData).toHaveBeenCalledOnce();
    expect(mocks.createdSources).toHaveLength(2); // two plays, one decode
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-AUD-02: graceful TTS fallback (F-NO-AUDIO) — no exception thrown
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-AUD-02: TTS fallback when MP3 unavailable (F-NO-AUDIO)', () => {
  let audio: typeof import('./audio');
  let tts: ReturnType<typeof stubSpeechSynthesis>;

  beforeEach(async () => {
    vi.resetModules();
    buildAudioCtxMock('fail'); // decodeAudioData rejects
    stubXHR(404);              // XHR also fails
    tts   = stubSpeechSynthesis();
    audio = await import('./audio');
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('playWordSlow falls back to speechSynthesis without throwing', async () => {
    await expect(audio.playWordSlow('/missing-slow.mp3', 'cat')).resolves.toBeUndefined();
    expect(tts.speak).toHaveBeenCalled();
  });

  it('playWordNatural falls back to speechSynthesis without throwing', async () => {
    await expect(audio.playWordNatural('/missing-natural.mp3', 'cat')).resolves.toBeUndefined();
    expect(tts.speak).toHaveBeenCalled();
  });

  it('playUnit falls back to phoneme-mapped TTS without throwing', async () => {
    await expect(audio.playUnit('/missing-unit.mp3', 'b')).resolves.toBeUndefined();
    expect(tts.speak).toHaveBeenCalled();
    // The utterance text must be the phoneme approximation, not the letter name
    const utteranceArg = (tts.speak.mock.calls[0][0] as { text: string }).text;
    expect(utteranceArg).toBe(audio.phonemeApprox('b')); // 'buh', not 'b' or 'bee'
  });

  it('playUnit routes multi-char unit through phoneme map', async () => {
    await audio.playUnit('/missing-oo.mp3', 'oo');
    const utteranceArg = (tts.speak.mock.calls[0][0] as { text: string }).text;
    expect(utteranceArg).toBe(audio.phonemeApprox('oo')); // 'ooo'
  });

  it('playUnit: phoneme map covers every key in PHONEME_TTS', async () => {
    for (const unit of Object.keys(audio.PHONEME_TTS)) {
      expect(audio.phonemeApprox(unit)).toBe(audio.PHONEME_TTS[unit]);
    }
    // Single-character units must map to a sound spelling, never the bare letter name.
    // (Multi-char units like "ee" may map to identical strings and that is intentional.)
    const singleCharUnits = Object.keys(audio.PHONEME_TTS).filter(u => u.length === 1);
    for (const unit of singleCharUnits) {
      expect(audio.phonemeApprox(unit)).not.toBe(unit);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-AUD-04: playCrash never repeats the same variant consecutively
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-AUD-04: playCrash never repeats the same variant consecutively', () => {
  let audio: typeof import('./audio');
  let mocks: AudioCtxMocks;

  beforeEach(async () => {
    vi.resetModules();
    mocks = buildAudioCtxMock('success');
    stubXHR(200);
    stubSpeechSynthesis();
    audio = await import('./audio');
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  /**
   * Each crashVariant call creates exactly one BiquadFilter whose frequency.value
   * is set to cutoffs[variant % 5] = [900,1400,2200,700,1800].
   * Consecutive filter frequencies must differ ⟺ consecutive variants differ.
   */
  it('variant never repeats over 30 consecutive playCrash calls (seeded Math.random)', () => {
    // Mock Math.random to always return 0.4 → raw idx = floor(0.4*5) = 2
    // First call: lastCrashIndex=-1, idx=2, 2≠-1 → variant 2 (2200 Hz)
    // Second call: lastCrashIndex=2, idx=2, 2===2 → idx=(2+1)%5=3, variant 3 (700 Hz)
    // Third call: lastCrashIndex=3, idx=2, 2≠3 → variant 2 (2200 Hz)  …alternating
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.4);

    for (let i = 0; i < 30; i++) {
      audio.playCrash();
    }

    random.mockRestore();

    // Each playCrash creates one BiquadFilter; collect their cutoff frequencies
    const cutoffs = [900, 1400, 2200, 700, 1800];
    const freqs = mocks.createdFilters.map(f => f.frequency.value);
    expect(freqs).toHaveLength(30);

    for (let i = 1; i < freqs.length; i++) {
      expect(freqs[i]).not.toBe(freqs[i - 1]);
      // All observed frequencies must come from the known cutoff table
      expect(cutoffs).toContain(freqs[i]);
    }
  });

  it('variant never repeats with randomised Math.random values', () => {
    // No seed — just confirm no consecutive repeat across 50 calls
    for (let i = 0; i < 50; i++) {
      audio.playCrash();
    }
    const freqs = mocks.createdFilters.map(f => f.frequency.value);
    expect(freqs).toHaveLength(50);
    for (let i = 1; i < freqs.length; i++) {
      expect(freqs[i]).not.toBe(freqs[i - 1]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-AUD-05: playUnit(interrupt=false) does not stop in-progress word source;
//            word playback (interrupt=true) does interrupt.
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-AUD-05: playUnit never interrupts word playback', () => {
  let audio: typeof import('./audio');
  let mocks: AudioCtxMocks;

  beforeEach(async () => {
    vi.resetModules();
    mocks = buildAudioCtxMock('success');
    stubXHR(200);
    stubSpeechSynthesis();
    audio = await import('./audio');
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('playUnit does not call stop() on the current word source', async () => {
    // 1. Start a word (interrupt=true → becomes currentSource)
    await audio.playWordSlow('/word.mp3', 'cat');
    const wordSource = mocks.createdSources[0];
    expect(wordSource.start).toHaveBeenCalled();

    // 2. Play a unit (interrupt=false → must NOT stop wordSource)
    await audio.playUnit('/unit.mp3', 'c');
    expect(wordSource.stop).not.toHaveBeenCalled();
    expect(mocks.createdSources).toHaveLength(2);
    // Unit source still started
    expect(mocks.createdSources[1].start).toHaveBeenCalled();
  });

  it('playWordNatural (interrupt=true) does stop the current word source', async () => {
    await audio.playWordSlow('/word-a.mp3', 'cat');
    const firstSource = mocks.createdSources[0];

    // Second word playback must stop the first
    await audio.playWordNatural('/word-b.mp3', 'dog');
    expect(firstSource.stop).toHaveBeenCalled();
    expect(mocks.createdSources).toHaveLength(2);
    expect(mocks.createdSources[1].start).toHaveBeenCalled();
  });

  it('multiple playUnit calls do not stack-stop each other (each runs freely)', async () => {
    await audio.playUnit('/unit-a.mp3', 'b');
    await audio.playUnit('/unit-b.mp3', 'a');
    await audio.playUnit('/unit-c.mp3', 't');
    // No source should ever have had stop() called
    for (const src of mocks.createdSources) {
      expect(src.stop).not.toHaveBeenCalled();
    }
    expect(mocks.createdSources).toHaveLength(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-AUD-06: all foley types run without throwing
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-AUD-06: foley types all run without throwing', () => {
  let audio: typeof import('./audio');

  beforeEach(async () => {
    vi.resetModules();
    buildAudioCtxMock('success');
    stubXHR(200);
    stubSpeechSynthesis();
    audio = await import('./audio');
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  const FOLEY_TYPES = [
    'smash', 'snap', 'kick', 'celebrate', 'hammerEvolve', 'whoosh',
    'thunk', 'chime', 'confetti', 'fanfare', 'cymbal', 'woodTap',
  ] as const;

  for (const type of FOLEY_TYPES) {
    it(`playFoley('${type}') does not throw`, () => {
      // Use a fresh audio reference captured per test to avoid module re-use issues.
      // audio is already captured in beforeEach; the forEach closure closes over
      // the loop variable by value via const in the for..of.
      expect(() => audio.playFoley(type)).not.toThrow();
    });
  }
});
