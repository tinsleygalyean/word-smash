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
    speakTTS(unit, false);
  }
}

export function playFoley(type: 'smash' | 'snap' | 'kick' | 'celebrate' | 'hammerEvolve'): void {
  const ctx = getAudioContext();
  const now = ctx.currentTime;

  switch (type) {
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
