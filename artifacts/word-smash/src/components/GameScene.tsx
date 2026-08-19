import { useEffect, useReducer, useRef, useState, useCallback } from 'react';
import type {
  LangPack, Level, Word, PieceState, SlotState, GamePhase,
  WordCompletion, PlaqueState, TutorialFlags, HintState,
} from '../game/types';
import {
  getProgress, saveProgress, getWordQueueForLevel, saveWordQueue, clearWordQueue, type Progress,
} from '../game/storage';
import {
  playWordSlow, playWordNatural, playUnit, playFoley, playCrash, preloadLevel,
} from '../game/audio';
import { emitWordCompleted, emitLevelCompleted, emitSummary } from '../game/events';
import {
  STAGE_W, STAGE_H, WALL_H, BENCH_TOP, SAFE_LEFT, SAFE_RIGHT, TRAY_CENTER,
  PIECE_H, PIECE_GAP, unitWidth, hammerStageForLevel, finishForLevelCount,
} from '../game/design';
import { dist } from '../game/coords';
import { Background } from './Background';
import { WholePlaque } from './WholePlaque';
import { Tray } from './Tray';
import { Piece } from './Piece';
import { Hammer } from './Hammer';
import { Wall } from './Wall';
import { ImpactFX, Sparkles, SoundRings } from './Effects';
import { TutorialHand, type HandMode } from './TutorialHand';
import { LevelTransition } from './LevelTransition';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
interface ReplayCtx { wordId: string; plaqueId: string; level: number; }
interface PreReplay { levelNum: number; queue: string[]; }

interface GameState {
  phase: GamePhase;
  currentLevel: number;
  currentWord: Word | null;
  currentLevelData: Level | null;
  wordQueue: string[];
  pieces: PieceState[];
  slots: SlotState[];
  plaqueW: number;
  completions: Record<string, WordCompletion>;
  plaques: PlaqueState[];
  hammerStage: number;
  hint: HintState | null;
  tutorial: TutorialFlags;
  wordStartTime: number;
  levelStartTime: number;
  wordErrors: number;
  wordHints: number;
  wordSmashes: number;
  transition: { from: number; to: number; earnedWordIds: string[] } | null;
  replay: ReplayCtx | null;
  preReplay: PreReplay | null;
  levelEarnedWordIds: string[];
}

type Action =
  | { type: 'LOAD'; p: Progress }
  | { type: 'START_WORD'; word: Word; levelData: Level; queue: string[]; pieces: PieceState[]; slots: SlotState[]; plaqueW: number; levelStart?: boolean; replay?: ReplayCtx | null; preReplay?: PreReplay | null }
  | { type: 'WINDUP' }
  | { type: 'WINDUP_CANCEL' }
  | { type: 'SCATTER'; pieces: PieceState[]; slots: SlotState[] }
  | { type: 'SIM'; pieces: PieceState[] }
  | { type: 'PLACE'; pieces: PieceState[]; slots: SlotState[] }
  | { type: 'MOVE'; pieceId: string; x: number; y: number }
  | { type: 'SETTLE'; pieceId: string; x: number; y: number }
  | { type: 'COMPLETE' }
  | { type: 'SET_PLAQUES'; plaques: PlaqueState[] }
  | { type: 'SET_COMPLETION'; key: string; completion: WordCompletion }
  | { type: 'MARK_EARNED'; wordId: string }
  | { type: 'LEVEL_TRANSITION'; from: number; to: number; hammerStage: number; earnedWordIds: string[] }
  | { type: 'END_TRANSITION' }
  | { type: 'SET_HINT'; hint: HintState | null }
  | { type: 'MARK_HAMMER_DONE' }
  | { type: 'INC_ERR' }
  | { type: 'INC_HINT' }
  | { type: 'INC_SMASH' };

function reducer(state: GameState, a: Action): GameState {
  switch (a.type) {
    case 'LOAD':
      return {
        ...state,
        currentLevel: a.p.currentLevel,
        completions: a.p.completions,
        plaques: a.p.plaques,
        hammerStage: a.p.hammerStage,
        tutorial: a.p.tutorial,
      };
    case 'START_WORD':
      return {
        ...state,
        phase: 'present',
        currentLevel: a.levelData.level,
        currentWord: a.word,
        currentLevelData: a.levelData,
        wordQueue: a.queue,
        pieces: a.pieces,
        slots: a.slots,
        plaqueW: a.plaqueW,
        hammerStage: hammerStageForLevel(a.levelData.level),
        hint: null,
        wordStartTime: Date.now(),
        levelStartTime: a.levelStart ? Date.now() : state.levelStartTime,
        wordErrors: 0,
        wordHints: 0,
        wordSmashes: 0,
        replay: a.replay ?? null,
        preReplay: a.preReplay ?? null,
        levelEarnedWordIds: a.levelStart ? [] : state.levelEarnedWordIds,
      };
    case 'WINDUP':
      return { ...state, phase: 'windup' };
    case 'WINDUP_CANCEL':
      return { ...state, phase: 'present' };
    case 'SCATTER':
      return { ...state, phase: 'rebuild', pieces: a.pieces, slots: a.slots, wordSmashes: state.wordSmashes + 1, hint: null };
    case 'SIM':
      return { ...state, pieces: a.pieces };
    case 'PLACE':
      return { ...state, pieces: a.pieces, slots: a.slots };
    case 'MOVE':
      return { ...state, pieces: state.pieces.map((p) => (p.id === a.pieceId ? { ...p, x: a.x, y: a.y } : p)) };
    case 'SETTLE':
      return { ...state, pieces: state.pieces.map((p) => (p.id === a.pieceId ? { ...p, x: a.x, y: a.y } : p)) };
    case 'COMPLETE':
      return { ...state, phase: 'complete', hint: null };
    case 'SET_PLAQUES':
      return { ...state, plaques: a.plaques };
    case 'SET_COMPLETION':
      return { ...state, completions: { ...state.completions, [a.key]: a.completion } };
    case 'MARK_EARNED':
      return state.levelEarnedWordIds.includes(a.wordId)
        ? state
        : { ...state, levelEarnedWordIds: [...state.levelEarnedWordIds, a.wordId] };
    case 'LEVEL_TRANSITION':
      return { ...state, phase: 'levelComplete', transition: { from: a.from, to: a.to, earnedWordIds: a.earnedWordIds }, hammerStage: a.hammerStage };
    case 'END_TRANSITION':
      return { ...state, transition: null };
    case 'SET_HINT':
      return { ...state, hint: a.hint };
    case 'MARK_HAMMER_DONE':
      return { ...state, tutorial: { ...state.tutorial, hammerDone: true } };
    case 'INC_ERR':
      return { ...state, wordErrors: state.wordErrors + 1 };
    case 'INC_HINT':
      return { ...state, wordHints: state.wordHints + 1 };
    case 'INC_SMASH':
      return { ...state, wordSmashes: state.wordSmashes + 1 };
    default:
      return state;
  }
}

const initialState: GameState = {
  phase: 'loading',
  currentLevel: 1,
  currentWord: null,
  currentLevelData: null,
  wordQueue: [],
  pieces: [],
  slots: [],
  plaqueW: 0,
  completions: {},
  plaques: [],
  hammerStage: 0,
  hint: null,
  tutorial: { hammerDone: false },
  wordStartTime: 0,
  levelStartTime: Date.now(),
  wordErrors: 0,
  wordHints: 0,
  wordSmashes: 0,
  transition: null,
  replay: null,
  preReplay: null,
  levelEarnedWordIds: [],
};

// ---------------------------------------------------------------------------
// Layout helpers (reference-canvas space)
// ---------------------------------------------------------------------------
function buildLayout(word: Word): { slots: SlotState[]; pieces: PieceState[]; plaqueW: number } {
  const widths = word.units.map((u) => unitWidth(u));
  const n = word.units.length;
  const total = widths.reduce((s, w) => s + w, 0) + PIECE_GAP * (n - 1);
  const startX = TRAY_CENTER.x - total / 2;
  let cx = startX;
  const slots: SlotState[] = word.units.map((u, i) => {
    const w = widths[i];
    const x = cx + w / 2;
    cx += w + PIECE_GAP;
    return { index: i, unit: u, filled: false, pieceId: null, audioPath: word.audio.units[i] || '', x, y: TRAY_CENTER.y, w };
  });
  const pieces: PieceState[] = slots.map((s, i) => ({
    id: `piece-${i}`, unitIndex: i, unit: s.unit, x: s.x, y: s.y,
    rotation: 0, placed: false, slotIndex: null, zIndex: 12 + i, audioPath: s.audioPath,
  }));
  return { slots, pieces, plaqueW: total };
}

function clampRot(r: number): number {
  let v = ((r % 40) + 40) % 40; // 0..40
  if (v > 20) v -= 40;           // -20..20  (§3 ±20° tumble)
  return v;
}

// ---------------------------------------------------------------------------
interface Props { langPack: LangPack; lang: string; }

export function GameScene({ langPack, lang }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const stageRef = useRef<HTMLDivElement>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>[]>([]);
  const simRaf = useRef<number | null>(null);

  // transient visual effects
  const [impact, setImpact] = useState<{ x: number; y: number; seed: number } | null>(null);
  const [sparkle, setSparkle] = useState<{ x: number; y: number; seed: number } | null>(null);
  const [rings, setRings] = useState<{ x: number; y: number; seed: number } | null>(null);
  const [playingSlot, setPlayingSlot] = useState<number | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [flying, setFlying] = useState<{ text: string; x: number; y: number; w: number; tx: number; ty: number; hop: boolean } | null>(null);

  // tutorial demo (§9)
  const [demo, setDemo] = useState<{ mode: HandMode; from?: { x: number; y: number }; to?: { x: number; y: number } } | null>(null);
  const demoTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const earlyRelease = useRef<Record<string, number>>({});
  const hintFired = useRef<Record<string, Set<string>>>({});
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotPlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- reference stage scaling (cover) ----
  useEffect(() => {
    function apply() {
      const s = Math.max(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
      if (stageRef.current) stageRef.current.style.setProperty('--ws-scale', String(s));
    }
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  const getLevelData = useCallback((n: number): Level | null => langPack.levels.find((l) => l.level === n) || null, [langPack]);

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ---- sound rings + slot playback cues ----
  function showRings(x: number, y: number) {
    if (ringTimer.current) clearTimeout(ringTimer.current);
    setRings({ x, y, seed: Date.now() & 0xffff });
    ringTimer.current = setTimeout(() => setRings(null), 1100);
  }
  function playWordSlowCued() {
    const w = stateRef.current.currentWord;
    if (!w) return;
    playWordSlow(w.audio.slow, w.display);
    showRings(TRAY_CENTER.x, TRAY_CENTER.y);
  }

  const startLevel = useCallback((levelNum: number, completions: Record<string, WordCompletion>) => {
    const levelData = getLevelData(levelNum);
    if (!levelData) return;
    preloadLevel(levelData.words);
    let queue = getWordQueueForLevel(lang, levelNum);
    if (!queue || queue.length === 0) {
      const incomplete = levelData.words.filter((w) => !completions[`${w.id}_L${levelNum}`]).map((w) => w.id);
      queue = incomplete.length > 0 ? shuffle(incomplete) : shuffle(levelData.words.map((w) => w.id));
      saveWordQueue(lang, levelNum, queue);
    }
    const word = levelData.words.find((w) => w.id === queue![0]);
    if (!word) return;
    const { pieces, slots, plaqueW } = buildLayout(word);
    dispatch({ type: 'START_WORD', word, levelData, queue, pieces, slots, plaqueW, levelStart: true });
    advanceTimer.current.push(setTimeout(() => playWordSlowCued(), 650));
    resetHintTimer();
    schedulePresentDemo(word.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getLevelData, lang]);

  useEffect(() => {
    const saved = getProgress(lang);
    dispatch({ type: 'LOAD', p: saved });
    startLevel(saved.currentLevel, saved.completions);
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      if (ringTimer.current) clearTimeout(ringTimer.current);
      if (slotPlayTimer.current) clearTimeout(slotPlayTimer.current);
      advanceTimer.current.forEach(clearTimeout);
      demoTimers.current.forEach(clearTimeout);
      stopSim();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- hints ----
  function clearHint() { if (hintTimer.current) clearTimeout(hintTimer.current); hintTimer.current = null; }
  function resetHintTimer() {
    clearHint();
    hintTimer.current = setTimeout(() => {
      const st = stateRef.current;
      if (st.phase !== 'rebuild') return;
      const empty = st.slots.find((s) => !s.filled);
      dispatch({ type: 'INC_HINT' });
      dispatch({ type: 'SET_HINT', hint: { type: 'slot', slotIndex: empty?.index } });
      if (empty) playUnit(empty.audioPath, empty.unit);
      hintTimer.current = setTimeout(() => {
        dispatch({ type: 'SET_HINT', hint: { type: 'piece' } });
      }, 7000);
    }, 8000);
  }

  // ---- tutorial demos (§9) ----
  function firedOnce(wordId: string, mode: HandMode): boolean {
    const set = hintFired.current[wordId] ?? (hintFired.current[wordId] = new Set());
    if (set.has(mode)) return true;
    set.add(mode);
    return false;
  }
  function clearDemoTimers() { demoTimers.current.forEach(clearTimeout); demoTimers.current = []; }
  function dismissDemo() {
    clearDemoTimers();
    // first-run hammer demo persists until the first completed smash
    if (!(demo?.mode === 'hammer' && !stateRef.current.tutorial.hammerDone)) setDemo(null);
  }
  function showDemoAuto(d: { mode: HandMode; from?: { x: number; y: number }; to?: { x: number; y: number } }, autoMs: number) {
    setDemo(d);
    demoTimers.current.push(setTimeout(() => setDemo((cur) => (cur === d ? null : cur)), autoMs));
  }
  function schedulePresentDemo(wordId: string) {
    clearDemoTimers();
    const st = stateRef.current;
    if (!st.tutorial.hammerDone) {
      // first-run: persistent demonstrating hand over the hammer
      setDemo({ mode: 'hammer' });
      return;
    }
    setDemo(null);
    // (a) 10s no-touch on a fresh un-smashed plaque → one hammer demo loop
    demoTimers.current.push(setTimeout(() => {
      const s = stateRef.current;
      if (s.phase === 'present' && s.wordSmashes === 0 && !firedOnce(wordId, 'hammer')) {
        showDemoAuto({ mode: 'hammer' }, 4800);
      }
    }, 10000));
  }
  function scheduleRebuildDemo(wordId: string) {
    clearDemoTimers();
    // (c) 15s scattered & none dragged → demo dragging one piece to its slot, once
    demoTimers.current.push(setTimeout(() => {
      const s = stateRef.current;
      if (s.phase !== 'rebuild') return;
      const anyPlaced = s.slots.some((sl) => sl.filled);
      if (anyPlaced || firedOnce(wordId, 'dragPiece')) return;
      const emptySlot = s.slots.find((sl) => !sl.filled);
      if (!emptySlot) return;
      const piece = s.pieces.find((p) => !p.placed && p.unit === emptySlot.unit);
      if (!piece) return;
      showDemoAuto({ mode: 'dragPiece', from: { x: piece.x, y: piece.y }, to: { x: emptySlot.x, y: emptySlot.y } }, 5400);
    }, 15000));
  }

  // ---- physics scatter (§3): launch arcs, ±20° tumble, gravity, one floor bounce ----
  function stopSim() { if (simRaf.current != null) cancelAnimationFrame(simRaf.current); simRaf.current = null; }

  function runScatterPhysics(base: PieceState[], seed: number) {
    stopSim();
    let s = seed || 1;
    const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
    const n = base.length;
    const floor = STAGE_H - 74;
    const left = SAFE_LEFT - 2;
    const right = SAFE_RIGHT + 2;
    const g = 2600;
    const bodies = base.map((p, i) => {
      const rel = n > 1 ? (i - (n - 1) / 2) / Math.max(1, (n - 1) / 2) : (rand() - 0.5);
      return {
        id: p.id,
        x: p.x,
        y: p.y,
        vx: rel * (170 + rand() * 150) + (rand() - 0.5) * 120,
        vy: -(500 + rand() * 340),
        rot: p.rotation,
        vrot: (rand() - 0.5) * 520, // deg/s tumble
        bounced: false,
        settled: false,
      };
    });
    const byId = new Map(bodies.map((b) => [b.id, b]));
    const apply = (): PieceState[] => base.map((p) => {
      const b = byId.get(p.id)!;
      return { ...p, x: b.x, y: b.y, rotation: b.rot };
    });

    let last = performance.now();
    const startT = last;
    const frame = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      let allSettled = true;
      for (const b of bodies) {
        if (b.settled) continue;
        b.vy += g * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rot += b.vrot * dt;
        if (b.x < left) { b.x = left; b.vx = -b.vx * 0.4; }
        if (b.x > right) { b.x = right; b.vx = -b.vx * 0.4; }
        if (b.y >= floor) {
          if (!b.bounced && b.vy > 0) {
            b.y = floor; b.vy = -b.vy * 0.3; b.vx *= 0.7; b.vrot *= 0.4; b.bounced = true;
          } else {
            b.y = floor; b.vy = 0; b.vx *= 0.6;
            if (Math.abs(b.vx) < 14) { b.vx = 0; b.settled = true; b.rot = clampRot(b.rot); }
          }
        }
        if (!b.settled) allSettled = false;
      }
      dispatch({ type: 'SIM', pieces: apply() });
      if (allSettled || now - startT > 1800) {
        bodies.forEach((b) => {
          b.settled = true;
          b.y = Math.min(b.y, floor);
          if (b.x > 940 && b.y > 410) b.x = 940; // never rest under the hammer dock (§1)
          b.rot = clampRot(b.rot);
        });
        dispatch({ type: 'SIM', pieces: apply() });
        simRaf.current = null;
        return;
      }
      simRaf.current = requestAnimationFrame(frame);
    };
    simRaf.current = requestAnimationFrame(frame);
  }

  // ---- smash ----
  function doStrike() {
    const st = stateRef.current;
    const cx = TRAY_CENTER.x;
    const cy = TRAY_CENTER.y;
    playCrash();
    try { navigator.vibrate?.(80); } catch { /* ignore */ }
    setShakeKey((k) => k + 1);
    setImpact({ x: cx, y: cy, seed: Date.now() & 0xffff });
    setTimeout(() => setImpact(null), 800);
    dismissDemo();
    const loose = st.pieces.map((p) => ({ ...p, placed: false, slotIndex: null }));
    const clearedSlots = st.slots.map((s) => ({ ...s, filled: false, pieceId: null }));
    dispatch({ type: 'SCATTER', pieces: loose, slots: clearedSlots });
    runScatterPhysics(loose, Date.now() & 0xffff);
    if (!st.tutorial.hammerDone) {
      dispatch({ type: 'MARK_HAMMER_DONE' });
      persist({ tutorial: { hammerDone: true } });
    }
    const wordId = st.currentWord?.id;
    if (wordId) scheduleRebuildDemo(wordId);
    resetHintTimer();
  }

  function doResmash() {
    const st = stateRef.current;
    playCrash();
    try { navigator.vibrate?.(50); } catch { /* ignore */ }
    setShakeKey((k) => k + 1);
    setImpact({ x: TRAY_CENTER.x, y: TRAY_CENTER.y, seed: Date.now() & 0xffff });
    setTimeout(() => setImpact(null), 700);
    dismissDemo();
    // §5: re-smash re-scatters EVERYTHING, including seated pieces
    const all = st.pieces.map((p) => ({ ...p, placed: false, slotIndex: null }));
    const clearedSlots = st.slots.map((s) => ({ ...s, filled: false, pieceId: null }));
    dispatch({ type: 'SCATTER', pieces: all, slots: clearedSlots });
    runScatterPhysics(all, Date.now() & 0xffff);
    const wordId = st.currentWord?.id;
    if (wordId) scheduleRebuildDemo(wordId);
    resetHintTimer();
  }

  // ---- piece drag ----
  function onPickup(id: string) {
    stopSim();
    clearHint();
    clearDemoTimers();
    setDemo(null);
    dispatch({ type: 'SET_HINT', hint: null });
    const p = stateRef.current.pieces.find((pc) => pc.id === id);
    if (p) playUnit(p.audioPath, p.unit);
  }
  function onMove(id: string, x: number, y: number) { dispatch({ type: 'MOVE', pieceId: id, x, y }); }

  function onDrop(id: string, x: number, y: number) {
    const st = stateRef.current;
    const piece = st.pieces.find((p) => p.id === id);
    if (!piece) return;
    let nearest: SlotState | null = null;
    let nd = Infinity;
    for (const s of st.slots) {
      if (s.filled) continue;
      const d = dist(x, y, s.x, s.y);
      if (d < nd) { nd = d; nearest = s; }
    }
    const SNAP = 80;
    if (nearest && nd < SNAP) {
      if (nearest.unit === piece.unit) {
        const target = nearest;
        const pieces = st.pieces.map((p) => (p.id === id ? { ...p, x: target.x, y: target.y, rotation: 0, placed: true, slotIndex: target.index } : p));
        const slots = st.slots.map((s) => (s.index === target.index ? { ...s, filled: true, pieceId: id } : s));
        playFoley('thunk');
        playUnit(piece.audioPath, piece.unit);
        dispatch({ type: 'PLACE', pieces, slots });
        if (slots.every((s) => s.filled)) { clearHint(); clearDemoTimers(); setDemo(null); onWordComplete(); }
        else resetHintTimer();
      } else {
        const bx = nearest.x + (Math.random() > 0.5 ? 1 : -1) * (120 + Math.random() * 60);
        const by = STAGE_H - 90 - Math.random() * 40;
        const pieces = st.pieces.map((p) => (p.id === id ? { ...p, x: Math.max(SAFE_LEFT, Math.min(SAFE_RIGHT, bx)), y: by, rotation: (Math.random() - 0.5) * 30 } : p));
        playFoley('kick');
        dispatch({ type: 'INC_ERR' });
        dispatch({ type: 'PLACE', pieces, slots: st.slots });
        resetHintTimer();
      }
    } else {
      dispatch({ type: 'SETTLE', pieceId: id, x, y });
      resetHintTimer();
    }
  }

  // ---- word complete: fuse + hop + flight to wall ----
  function onWordComplete() {
    const st = stateRef.current;
    if (!st.currentWord || !st.currentLevelData) return;
    const isReplay = !!st.replay;
    dispatch({ type: 'COMPLETE' });
    setSparkle({ x: TRAY_CENTER.x, y: TRAY_CENTER.y, seed: Date.now() & 0xffff });
    playFoley('chime');
    setTimeout(() => {
      if (stateRef.current.currentWord) {
        playWordNatural(stateRef.current.currentWord.audio.natural, stateRef.current.currentWord.display);
        showRings(TRAY_CENTER.x, TRAY_CENTER.y);
      }
    }, 350);

    const word = st.currentWord;
    const level = st.currentLevelData.level;
    const duration = (Date.now() - st.wordStartTime) / 1000;
    const compKey = `${word.id}_L${level}`;
    const existingComp = st.completions[compKey];
    const isGhost = st.currentLevelData.ghost;

    // §6: ONE plaque per wordId — cumulative play count, highest level reached.
    const existingPlaque = st.plaques.find((p) => p.wordId === word.id);
    const playCount = (existingPlaque?.playCount ?? 0) + 1;
    const highestLevel = Math.max(existingPlaque?.highestLevel ?? 0, level);
    // Plaque finish advances only when the word is completed at a NEW level
    // (never on wall replays, which run at an already-completed level).
    const isNewLevel = !existingComp;
    const levelsPlayed = Math.max(1, (existingPlaque?.levelsPlayed ?? 0) + (isNewLevel ? 1 : 0));

    const completion: WordCompletion = {
      wordId: word.id,
      display: word.display,
      units: word.units,
      ghostDone: existingComp?.ghostDone || isGhost,
      noGhostDone: existingComp?.noGhostDone || !isGhost,
      highestLevel,
      playCount,
    };
    emitWordCompleted({
      level, wordId: word.id, ghost: isGhost, replay: isReplay,
      score: Math.max(0, st.slots.length - st.wordErrors), maxScore: st.slots.length,
      durationSeconds: duration, errors: st.wordErrors, hintsUsed: st.wordHints, smashCount: st.wordSmashes,
    });

    // wall destination: existing plaque keeps its spot, else next free slot
    const wallPos = existingPlaque
      ? { x: existingPlaque.x, y: existingPlaque.y }
      : wallPositionFor(st.plaques.length);
    const plaqueW = st.plaqueW;

    advanceTimer.current.push(setTimeout(() => {
      setFlying({ text: word.display, x: TRAY_CENTER.x, y: TRAY_CENTER.y, w: plaqueW, tx: TRAY_CENTER.x, ty: TRAY_CENTER.y, hop: true });
      setSparkle(null);
    }, 250));
    advanceTimer.current.push(setTimeout(() => {
      setFlying((f) => (f ? { ...f, tx: wallPos.x, ty: wallPos.y, hop: false } : f));
    }, 1050));
    advanceTimer.current.push(setTimeout(() => {
      const maxZ = Math.max(0, ...st.plaques.map((p) => p.zOrder));
      let plaques: PlaqueState[];
      if (existingPlaque) {
        plaques = st.plaques.map((p) => (p.wordId === word.id
          ? { ...p, playCount, highestLevel, levelsPlayed, display: word.display, units: word.units, zOrder: maxZ + 1 }
          : p));
      } else {
        const plaque: PlaqueState = {
          plaqueId: `plq-${word.id}`,
          wordId: word.id, display: word.display, units: word.units,
          x: wallPos.x, y: wallPos.y, zOrder: maxZ + 1, playCount, highestLevel, levelsPlayed,
        };
        plaques = [...st.plaques, plaque];
      }
      dispatch({ type: 'SET_PLAQUES', plaques });
      dispatch({ type: 'SET_COMPLETION', key: compKey, completion });
      playFoley('woodTap');
      const newCompletions = { ...st.completions, [compKey]: completion };
      persist({ completions: newCompletions, plaques });
      setFlying(null);

      if (isReplay) {
        restoreAfterReplay();
      } else {
        dispatch({ type: 'MARK_EARNED', wordId: word.id });
        advanceAfterWord(newCompletions, word.id);
      }
    }, 1900));
  }

  function wallPositionFor(index: number): { x: number; y: number } {
    const perRow = 5;
    const col = index % perRow;
    const row = Math.floor(index / perRow) % 3;
    const x = 190 + col * 205 + (row % 2) * 26;
    const y = 78 + row * 66;
    return { x: Math.min(1090, x), y: Math.min(WALL_H - 46, y) };
  }

  function advanceAfterWord(completions: Record<string, WordCompletion>, justCompletedId: string) {
    const st = stateRef.current;
    if (!st.currentLevelData) return;
    const queue = st.wordQueue.slice(1);
    const levelData = st.currentLevelData;
    if (queue.length === 0) {
      clearWordQueue(lang, levelData.level);
      const levelDuration = (Date.now() - st.levelStartTime) / 1000;
      emitLevelCompleted({ level: levelData.level, ghost: levelData.ghost, durationSeconds: levelDuration });
      emitSummary({ levelsPlayed: levelData.level, wordsCompleted: Object.keys(completions).length, totalTimePlayed: levelDuration, lastLevelNumber: levelData.level });
      const nextLevel = levelData.level + 1;
      const nextData = getLevelData(nextLevel);
      const fromStage = hammerStageForLevel(levelData.level);
      const toStage = hammerStageForLevel(nextLevel);
      const earnedWordIds = Array.from(new Set([...st.levelEarnedWordIds, justCompletedId]));
      dispatch({ type: 'LEVEL_TRANSITION', from: fromStage, to: toStage, hammerStage: fromStage, earnedWordIds });
      // persist + next-level start are driven by the transition beats (onPersist/onStartNext)
    } else {
      saveWordQueue(lang, levelData.level, queue);
      const nextWord = levelData.words.find((w) => w.id === queue[0]);
      if (!nextWord) return;
      const { pieces, slots, plaqueW } = buildLayout(nextWord);
      dispatch({ type: 'START_WORD', word: nextWord, levelData, queue, pieces, slots, plaqueW });
      advanceTimer.current.push(setTimeout(() => playWordSlowCued(), 550));
      resetHintTimer();
      schedulePresentDemo(nextWord.id);
    }
  }

  // ---- level transition beat callbacks (§8) ----
  function transitionPersist() {
    const st = stateRef.current;
    if (!st.transition) return;
    const nextLevel = st.currentLevel + 1;
    const nextData = getLevelData(nextLevel);
    const toStage = st.transition.to;
    const fromStage = st.transition.from;
    // beat 2: swap to the new hammer + persist stage & level index
    dispatch({ type: 'LEVEL_TRANSITION', from: fromStage, to: toStage, hammerStage: nextData ? toStage : fromStage, earnedWordIds: st.transition.earnedWordIds });
    persist({ currentLevel: nextData ? nextLevel : st.currentLevel, completions: st.completions, hammerStage: nextData ? toStage : fromStage });
  }
  function transitionStartNext() {
    // upgraded hammer has docked: load the next level's first word onto the bench
    const saved = getProgress(lang);
    startLevel(saved.currentLevel, saved.completions);
  }
  function transitionDone() {
    dispatch({ type: 'END_TRANSITION' });
  }

  // ---- wall replay (§6): a real replay session at the highest level reached ----
  function startReplay(plaqueId: string, wordId: string) {
    const st = stateRef.current;
    if (st.replay) return; // already replaying
    if (st.phase === 'levelComplete') return; // no wall input during the transition
    const plaque = st.plaques.find((p) => p.plaqueId === plaqueId);
    const level = plaque?.highestLevel ?? st.currentLevel;
    const levelData = getLevelData(level) ?? st.currentLevelData;
    const word = findWord(langPack, wordId);
    if (!word || !levelData) return;
    stopSim();
    clearHint();
    clearDemoTimers();
    setDemo(null);
    setFlying(null);
    advanceTimer.current.forEach(clearTimeout);
    advanceTimer.current = [];
    const preReplay: PreReplay = { levelNum: st.currentLevel, queue: st.wordQueue };
    const { pieces, slots, plaqueW } = buildLayout(word);
    dispatch({
      type: 'START_WORD', word, levelData, queue: [wordId], pieces, slots, plaqueW,
      replay: { wordId, plaqueId, level }, preReplay,
    });
    advanceTimer.current.push(setTimeout(() => playWordSlowCued(), 500));
    resetHintTimer();
  }

  function restoreAfterReplay() {
    const st = stateRef.current;
    const pre = st.preReplay;
    if (!pre) { dispatch({ type: 'END_TRANSITION' }); return; }
    const levelData = getLevelData(pre.levelNum);
    if (!levelData || pre.queue.length === 0) {
      // nothing to resume — fall back to the persisted level
      const saved = getProgress(lang);
      startLevel(saved.currentLevel, saved.completions);
      return;
    }
    const word = levelData.words.find((w) => w.id === pre.queue[0]) ?? findWord(langPack, pre.queue[0]);
    if (!word) {
      const saved = getProgress(lang);
      startLevel(saved.currentLevel, saved.completions);
      return;
    }
    const { pieces, slots, plaqueW } = buildLayout(word);
    dispatch({ type: 'START_WORD', word, levelData, queue: pre.queue, pieces, slots, plaqueW, replay: null, preReplay: null });
    advanceTimer.current.push(setTimeout(() => playWordSlowCued(), 500));
    resetHintTimer();
    schedulePresentDemo(word.id);
  }

  function persist(patch: Partial<Progress>) {
    const cur = getProgress(lang);
    saveProgress(lang, { ...cur, ...patch });
  }

  // ---- hammer callbacks ----
  const onWindupStart = useCallback(() => {
    dispatch({ type: 'WINDUP' });
    clearDemoTimers();
    setDemo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const onWindupCancel = useCallback(() => {
    dispatch({ type: 'WINDUP_CANCEL' });
    // §9(b): after 2 consecutive released-early half-swings, demo holding through
    const st = stateRef.current;
    const wordId = st.currentWord?.id;
    if (!wordId) return;
    earlyRelease.current[wordId] = (earlyRelease.current[wordId] ?? 0) + 1;
    if (earlyRelease.current[wordId] >= 2 && !firedOnce(wordId, 'holdThrough')) {
      showDemoAuto({ mode: 'holdThrough' }, 4000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- render ----
  const { phase } = state;
  const showWhole = phase === 'present' || phase === 'windup';
  const showPieces = phase === 'rebuild' || phase === 'complete';
  const ghostLevel = state.currentLevelData?.ghost ?? false;
  const hammerInteractive = (phase === 'present' || phase === 'rebuild') && !state.transition;

  // Compute the finish color this word will earn when the current play completes.
  // Uses the same levelsPlayed formula as onWordComplete so pieces / slots match
  // the wall plaque that will land after the word is assembled.
  const wordFinish = (() => {
    if (!state.currentWord) return finishForLevelCount(1);
    const existingPlaque = state.plaques.find((p) => p.wordId === state.currentWord!.id);
    const existingComp = state.completions[`${state.currentWord.id}_L${state.currentLevel}`];
    const isNewLevel = !existingComp;
    const levelsPlayed = Math.max(1, (existingPlaque?.levelsPlayed ?? 0) + (isNewLevel ? 1 : 0));
    return finishForLevelCount(levelsPlayed);
  })();

  const hintSlot = state.hint?.type === 'slot' ? state.hint.slotIndex ?? null : null;
  const hintPieceId = (() => {
    if (state.hint?.type !== 'piece') return null;
    const empty = state.slots.find((s) => !s.filled);
    if (!empty) return null;
    const match = state.pieces.find((p) => !p.placed && p.unit === empty.unit);
    return match?.id ?? null;
  })();

  const wallPlaques = state.replay
    ? state.plaques.filter((p) => p.wordId !== state.replay!.wordId)
    : state.plaques;

  const showDemo = !!demo && (
    (demo.mode === 'dragPiece' && phase === 'rebuild') ||
    ((demo.mode === 'hammer' || demo.mode === 'holdThrough') && (phase === 'present' || phase === 'windup'))
  );

  return (
    <div className="ws-root">
      <div className="ws-stage" ref={stageRef}>
        <div key={shakeKey} className={`ws-shakeable ${impact ? 'ws-shake' : ''}`}>
          <Background />

          <Wall
            plaques={wallPlaques}
            stageRef={stageRef}
            onPlay={(wordId) => {
              const w = findWord(langPack, wordId);
              if (w) playWordNatural(w.audio.natural, w.display);
            }}
            onReplay={(plaqueId, wordId) => startReplay(plaqueId, wordId)}
            onMove={(plaqueId, x, y) => {
              const plaques = stateRef.current.plaques.map((p) => (p.plaqueId === plaqueId ? { ...p, x, y } : p));
              dispatch({ type: 'SET_PLAQUES', plaques });
              persist({ plaques });
            }}
            onBringFront={(plaqueId) => {
              const maxZ = Math.max(0, ...stateRef.current.plaques.map((p) => p.zOrder));
              const plaques = stateRef.current.plaques.map((p) => (p.plaqueId === plaqueId ? { ...p, zOrder: maxZ + 1 } : p));
              dispatch({ type: 'SET_PLAQUES', plaques });
            }}
          />

          {/* recesses + slots (hidden together with the tiles the instant the word recombines into its plaque) */}
          {showPieces && !flying && (
            <Tray
              slots={state.slots}
              ghost={ghostLevel}
              hintSlotIndex={hintSlot}
              playingSlotIndex={playingSlot}
              accentColor={wordFinish.band}
              onSlotPlay={(idx) => {
                const s = state.slots[idx];
                if (!s) return;
                playUnit(s.audioPath, s.unit);
                if (slotPlayTimer.current) clearTimeout(slotPlayTimer.current);
                setPlayingSlot(idx);
                slotPlayTimer.current = setTimeout(() => setPlayingSlot(null), 700);
              }}
            />
          )}

          {/* whole plaque (present/windup) */}
          {showWhole && state.currentWord && (
            <WholePlaque
              text={state.currentWord.display}
              x={TRAY_CENTER.x}
              y={TRAY_CENTER.y}
              w={state.plaqueW}
              breathe={phase === 'present'}
              onPlay={() => playWordSlowCued()}
            />
          )}

          {/* scattered / placed pieces (hidden the instant the word recombines into its plaque) */}
          {showPieces && !flying && state.pieces.map((p) => (
            <Piece
              key={p.id}
              piece={p}
              w={state.slots[p.unitIndex]?.w ?? unitWidth(p.unit)}
              hint={hintPieceId === p.id}
              accentColor={wordFinish.band}
              accentInk={wordFinish.ink}
              stageRef={stageRef}
              onPickup={onPickup}
              onMove={onMove}
              onDrop={onDrop}
              seatKey={0}
            />
          ))}

          {/* flying completed plaque — outer div owns the position (bench → wall);
              inner div owns the hop bounce so the animation never clobbers position */}
          {flying && (
            <div
              style={{
                position: 'absolute', left: 0, top: 0, zIndex: 300,
                transform: `translate(${flying.tx - flying.w / 2}px, ${flying.ty - PIECE_H / 2}px)`,
                transition: 'transform 0.85s cubic-bezier(.34,.9,.4,1)',
              }}
            >
              <div className={flying.hop ? 'ws-hop' : undefined}>
                <FlyingFace text={flying.text} w={flying.w} shrink={!flying.hop} band={wordFinish.band} ink={wordFinish.ink} />
              </div>
            </div>
          )}

          {/* hammer — hidden during the upgrade transition, which draws its own */}
          {!state.transition && (
            <Hammer
              stageIndex={state.hammerStage}
              phase={phase}
              stageRef={stageRef}
              target={{ x: TRAY_CENTER.x, y: TRAY_CENTER.y }}
              interactive={hammerInteractive}
              dimmed={phase === 'rebuild'}
              onWindupStart={onWindupStart}
              onWindupCancel={onWindupCancel}
              onStrike={doStrike}
              onResmash={doResmash}
            />
          )}

          {/* wind-up world vignette (§2/§3) */}
          {phase === 'windup' && <div className="ws-vignette" />}

          {/* effects */}
          {impact && <ImpactFX x={impact.x} y={impact.y} seed={impact.seed} />}
          {sparkle && <Sparkles x={sparkle.x} y={sparkle.y} seed={sparkle.seed} />}
          {rings && <SoundRings x={rings.x} y={rings.y} seed={rings.seed} />}

          {/* tutorial */}
          {showDemo && demo && (
            <TutorialHand target={{ x: TRAY_CENTER.x, y: TRAY_CENTER.y }} mode={demo.mode} from={demo.from} to={demo.to} />
          )}

          {/* level transition */}
          {state.transition && (
            <LevelTransition
              fromStage={state.transition.from}
              toStage={state.transition.to}
              onPersist={transitionPersist}
              onStartNext={transitionStartNext}
              onDone={transitionDone}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function findWord(pack: LangPack, wordId: string): Word | null {
  for (const l of pack.levels) { const w = l.words.find((x) => x.id === wordId); if (w) return w; }
  return null;
}

function FlyingFace({ text, w, shrink, band, ink }: { text: string; w: number; shrink: boolean; band: string; ink: string }) {
  const scale = shrink ? 0.62 : 1;
  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'center', transition: 'transform 0.85s cubic-bezier(.34,.9,.4,1)' }}>
      <div
        style={{
          width: w, height: PIECE_H, borderRadius: 16,
          background: 'linear-gradient(170deg, #faeed2 0%, #f2e0b8 100%)',
          boxShadow: `0 8px 14px rgba(90,55,20,.32), inset 0 2px 2px rgba(255,255,255,.7), inset 0 -11px 0 ${band}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontFamily: "'Fredoka', system-ui, sans-serif", fontWeight: 600, fontSize: Math.round(PIECE_H * 0.52), color: ink, marginBottom: 6 }}>{text}</span>
      </div>
    </div>
  );
}
