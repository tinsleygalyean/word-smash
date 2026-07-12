let audioCtx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer | null>();
let currentSource: AudioBufferSourceNode | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function makeSilentBuffer(ctx: AudioContext): AudioBuffer {
  return ctx.createBuffer(1, 1, ctx.sampleRate);
}

function loadBinary(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) {
        resolve(xhr.response as ArrayBuffer);
      } else {
        reject(new Error(`loadBinary ${url} → ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error(`loadBinary XHR error: ${url}`));
    xhr.send();
  });
}

async function loadAudioBuffer(path: string): Promise<AudioBuffer | null> {
  if (bufferCache.has(path)) return bufferCache.get(path)!;
  const ctx = getAudioContext();
  try {
    const arrayBuffer = await loadBinary(path);
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    bufferCache.set(path, audioBuffer);
    return audioBuffer;
  } catch {
    const silent = makeSilentBuffer(ctx);
    bufferCache.set(path, silent);
    return silent;
  }
}

function playBuffer(buffer: AudioBuffer, interrupt = true): void {
  const ctx = getAudioContext();
  if (interrupt && currentSource) {
    try { currentSource.stop(); } catch {}
    currentSource = null;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start(0);
  if (interrupt) currentSource = source;
  source.onended = () => {
    if (currentSource === source) currentSource = null;
  };
}

// Phoneme-sound approximations for the Web Speech fallback.
// CRITICAL: units must be spoken as the SOUND the letter makes in the word
// (/b/ = "buh"), never the letter NAME ("bee"). Real recorded MP3s (M3+)
// must follow the same rule.
const PHONEME_TTS: Record<string, string> = {
  a: 'ah', e: 'eh', i: 'ih', o: 'aw', u: 'uh',
  b: 'buh', c: 'kuh', d: 'duh', f: 'fff', g: 'guh',
  h: 'hhh', j: 'juh', k: 'kuh', l: 'lll', m: 'mmm',
  n: 'nnn', p: 'puh', q: 'kwuh', r: 'rrr', s: 'sss',
  t: 'tuh', v: 'vvv', w: 'wuh', x: 'ks', y: 'yuh', z: 'zzz',
  gg: 'guh', ee: 'ee', ea: 'ee', oo: 'ooo', ey: 'ee', er: 'ur',
  // Syllable units (L7/L8 two-syllable words) — spelled so TTS says the
  // in-word syllable sound, not a misreading of the raw letters.
  cac: 'kack', tus: 'tuss',       // cactus
  ba: 'bay', by: 'bee',           // baby
  pen: 'pen', cil: 'sill',        // pencil
  mon: 'mun', key: 'kee',         // monkey
  ti: 'tie', ger: 'gur',          // tiger
  ze: 'zee', bra: 'bruh',         // zebra
};

function phonemeApprox(unit: string): string {
  return PHONEME_TTS[unit.toLowerCase()] ?? unit;
}

function speakTTS(text: string, slow = false): void {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = slow ? 0.65 : 1.0;
  utt.pitch = 1.15;
  utt.volume = 1.0;
  speechSynthesis.speak(utt);
}

export async function playWordSlow(audioPath: string, display: string): Promise<void> {
  const buf = await loadAudioBuffer(audioPath);
  if (buf && buf.length > 1) {
    playBuffer(buf);
  } else {
    speakTTS(display, true);
  }
}

export async function playWordNatural(audioPath: string, display: string): Promise<void> {
  const buf = await loadAudioBuffer(audioPath);
  if (buf && buf.length > 1) {
    playBuffer(buf);
  } else {
    speakTTS(display, false);
  }
}

export async function playUnit(audioPath: string, unit: string): Promise<void> {
  const buf = await loadAudioBuffer(audioPath);
  if (buf && buf.length > 1) {
    playBuffer(buf, false);
  } else {
    speakTTS(phonemeApprox(unit), false);
  }
}

// ---------------------------------------------------------------------------
// Surprise crash pool — §5. A short synthesised "smash" with several distinct
// flavours; never plays the same one twice in a row so each smash surprises.
// (Synth fallback until real MP3 crash sfx land in M3.)
// ---------------------------------------------------------------------------
let lastCrashIndex = -1;

function crashVariant(ctx: AudioContext, variant: number): void {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  // Body: filtered noise burst (the "crunch")
  const dur = 0.22 + Math.random() * 0.1;
  const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = Math.pow(1 - i / data.length, 1.8);
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = variant % 2 === 0 ? 'lowpass' : 'bandpass';
  const cutoffs = [900, 1400, 2200, 700, 1800];
  filter.frequency.value = cutoffs[variant % cutoffs.length];
  filter.Q.value = 0.8;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.7, now);
  ng.gain.exponentialRampToValueAtTime(0.001, now + dur);
  src.connect(filter);
  filter.connect(ng);
  ng.connect(master);
  src.start(now);

  // Thump: low sine drop (the "impact")
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  const baseFreq = [150, 120, 180, 100, 160][variant % 5];
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);
  og.gain.setValueAtTime(0.6, now);
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(og);
  og.connect(master);
  osc.start(now);
  osc.stop(now + 0.18);

  // Crackle: a couple of tiny wood-chip clicks
  const clicks = 2 + (variant % 2);
  for (let i = 0; i < clicks; i++) {
    const t = now + 0.02 + Math.random() * 0.12;
    const c = ctx.createOscillator();
    const cg = ctx.createGain();
    c.type = 'triangle';
    c.frequency.value = 1200 + Math.random() * 1600;
    cg.gain.setValueAtTime(0.18, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    c.connect(cg);
    cg.connect(master);
    c.start(t);
    c.stop(t + 0.05);
  }
}

export function playCrash(): void {
  const ctx = getAudioContext();
  const count = 5;
  let idx = Math.floor(Math.random() * count);
  if (idx === lastCrashIndex) idx = (idx + 1) % count;
  lastCrashIndex = idx;
  crashVariant(ctx, idx);
}

export function playFoley(
  type:
    | 'smash' | 'snap' | 'kick' | 'celebrate' | 'hammerEvolve' | 'whoosh'
    | 'thunk' | 'chime' | 'confetti' | 'fanfare' | 'cymbal' | 'woodTap',
): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  switch (type) {
    case 'fanfare': {
      // rising brass-like recap fanfare for level-end beat 1
      const notes = [392, 523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        const t = now + i * 0.14;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = f;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2200;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.22, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
        osc.connect(lp);
        lp.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.36);
      });
      break;
    }
    case 'cymbal': {
      // shimmering cymbal for the hammer transform (beat 2)
      const dur = 0.9;
      const noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.2);
      }
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6000;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.32, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      src.connect(hp);
      hp.connect(gain);
      gain.connect(ctx.destination);
      src.start(now);
      break;
    }
    case 'woodTap': {
      // dry woody knock when a plaque lands on the wall
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.06);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
      break;
    }
    case 'smash': {
      const noise = ctx.createBuffer(1, ctx.sampleRate * 0.15, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(now);
      break;
    }
    case 'whoosh': {
      // rising airy sweep during the hammer wind-up
      const noise = ctx.createBuffer(1, ctx.sampleRate * 0.7, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource();
      src.buffer = noise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(300, now);
      bp.frequency.exponentialRampToValueAtTime(2600, now + 0.65);
      bp.Q.value = 1.2;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.35, now + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
      src.connect(bp);
      bp.connect(gain);
      gain.connect(ctx.destination);
      src.start(now);
      break;
    }
    case 'thunk': {
      // soft seat "thunk" when a piece settles into its recess
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.08);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
      break;
    }
    case 'chime': {
      // warm word-complete chime (major triad shimmer)
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const t = now + i * 0.06;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.6);
      });
      break;
    }
    case 'confetti': {
      [660, 880, 990, 1320].forEach((f, i) => {
        const t = now + i * 0.05;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.3);
      });
      break;
    }
    case 'snap': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.05);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    }
    case 'kick': {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
      break;
    }
    case 'celebrate': {
      [0, 0.12, 0.24].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = [523, 659, 784][i];
        gain.gain.setValueAtTime(0.3, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.25);
      });
      break;
    }
    case 'hammerEvolve': {
      [0, 0.1, 0.2, 0.3, 0.4].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = [392, 440, 494, 523, 659][i];
        gain.gain.setValueAtTime(0.25, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 0.2);
      });
      break;
    }
  }
}

export function preloadLevel(words: { audio: { slow: string; natural: string; units: string[] } }[]): void {
  const paths: string[] = [];
  for (const w of words) {
    paths.push(w.audio.slow, w.audio.natural, ...w.audio.units);
  }
  Promise.allSettled(paths.map(p => loadAudioBuffer(p))).catch(() => {});
}
