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
  HAMMER_DOCK, PIECE_H, PIECE_GAP, unitWidth, hammerStageForLevel,
} from '../game/design';
import { dist } from '../game/coords';
import { Background } from './Background';
import { WholePlaque } from './WholePlaque';
import { Tray } from './Tray';
import { Piece } from './Piece';
import { Hammer } from './Hammer';
import { Wall } from './Wall';
import { ImpactFX, Sparkles } from './Effects';
import { TutorialHand } from './TutorialHand';
import { LevelTransition } from './LevelTransition';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
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
  transition: { from: number; to: number } | null;
}

type Action =
  | { type: 'LOAD'; p: Progress }
  | { type: 'START_WORD'; word: Word; levelData: Level; queue: string[]; pieces: PieceState[]; slots: SlotState[]; plaqueW: number; levelStart?: boolean }
  | { type: 'WINDUP' }
  | { type: 'WINDUP_CANCEL' }
  | { type: 'SCATTER'; pieces: PieceState[] }
  | { type: 'PLACE'; pieces: PieceState[]; slots: SlotState[] }
  | { type: 'MOVE'; pieceId: string; x: number; y: number }
  | { type: 'SETTLE'; pieceId: string; x: number; y: number }
  | { type: 'COMPLETE' }
  | { type: 'ADD_PLAQUE'; plaque: PlaqueState; completion: WordCompletion }
  | { type: 'SET_PLAQUES'; plaques: PlaqueState[] }
  | { type: 'LEVEL_TRANSITION'; from: number; to: number; hammerStage: number }
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
      };
    case 'WINDUP':
      return { ...state, phase: 'windup' };
    case 'WINDUP_CANCEL':
      return { ...state, phase: 'present' };
    case 'SCATTER':
      return { ...state, phase: 'rebuild', pieces: a.pieces, wordSmashes: state.wordSmashes + 1, hint: null };
    case 'PLACE':
      return { ...state, pieces: a.pieces, slots: a.slots };
    case 'MOVE':
      return { ...state, pieces: state.pieces.map((p) => (p.id === a.pieceId ? { ...p, x: a.x, y: a.y } : p)) };
    case 'SETTLE':
      return { ...state, pieces: state.pieces.map((p) => (p.id === a.pieceId ? { ...p, x: a.x, y: a.y } : p)) };
    case 'COMPLETE':
      return { ...state, phase: 'complete', hint: null };
    case 'ADD_PLAQUE':
      return {
        ...state,
        plaques: [...state.plaques, a.plaque],
        completions: { ...state.completions, [a.completion.wordId + '_L' + state.currentLevel]: a.completion },
      };
    case 'SET_PLAQUES':
      return { ...state, plaques: a.plaques };
    case 'LEVEL_TRANSITION':
      return { ...state, phase: 'levelComplete', transition: { from: a.from, to: a.to }, hammerStage: a.hammerStage };
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
};

// ---------------------------------------------------------------------------
// Layout + physics helpers (reference-canvas space)
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

function scatter(pieces: PieceState[], seed: number): PieceState[] {
  let s = seed || 1;
  const rand = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  const left = SAFE_LEFT - 10;
  const right = SAFE_RIGHT + 10;
  const topY = BENCH_TOP + 46;
  const botY = STAGE_H - 74;
  return pieces.map((p) => {
    const x = left + rand() * (right - left);
    const y = topY + rand() * (botY - topY);
    return { ...p, x, y, rotation: (rand() - 0.5) * 40, placed: false, slotIndex: null };
  });
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

  // transient visual effects
  const [impact, setImpact] = useState<{ x: number; y: number; seed: number } | null>(null);
  const [sparkle, setSparkle] = useState<{ x: number; y: number; seed: number } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [flying, setFlying] = useState<{ text: string; x: number; y: number; w: number; tx: number; ty: number; hop: boolean } | null>(null);

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
    advanceTimer.current.push(setTimeout(() => playWordSlow(word.audio.slow, word.display), 650));
    resetHintTimer();
  }, [getLevelData, lang]);

  useEffect(() => {
    const saved = getProgress(lang);
    dispatch({ type: 'LOAD', p: saved });
    startLevel(saved.currentLevel, saved.completions);
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
      advanceTimer.current.forEach(clearTimeout);
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
    const scattered = scatter(st.pieces, Date.now() & 0xffff);
    dispatch({ type: 'SCATTER', pieces: scattered });
    if (!st.tutorial.hammerDone) {
      dispatch({ type: 'MARK_HAMMER_DONE' });
      persist({ tutorial: { hammerDone: true } });
    }
    resetHintTimer();
  }

  function doResmash() {
    const st = stateRef.current;
    playCrash();
    try { navigator.vibrate?.(50); } catch { /* ignore */ }
    setShakeKey((k) => k + 1);
    setImpact({ x: TRAY_CENTER.x, y: TRAY_CENTER.y, seed: Date.now() & 0xffff });
    setTimeout(() => setImpact(null), 700);
    const loose = st.pieces.filter((p) => !p.placed);
    const rescattered = scatter(loose, Date.now() & 0xffff);
    const map = new Map(rescattered.map((p) => [p.id, p]));
    const merged = st.pieces.map((p) => map.get(p.id) ?? p);
    // clear slots that held loose (none, they're placed) — keep placed intact
    dispatch({ type: 'SCATTER', pieces: merged });
    resetHintTimer();
  }

  // ---- piece drag ----
  function onPickup(id: string) {
    clearHint();
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
        if (slots.every((s) => s.filled)) { clearHint(); onWordComplete(); }
        else resetHintTimer();
      } else {
        // wrong recess → bounce out in an arc back onto the bench
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
    dispatch({ type: 'COMPLETE' });
    setSparkle({ x: TRAY_CENTER.x, y: TRAY_CENTER.y, seed: Date.now() & 0xffff });
    playFoley('chime');
    setTimeout(() => { if (stateRef.current.currentWord) playWordNatural(stateRef.current.currentWord.audio.natural, stateRef.current.currentWord.display); }, 350);

    const duration = (Date.now() - st.wordStartTime) / 1000;
    const compKey = `${st.currentWord.id}_L${st.currentLevelData.level}`;
    const existing = st.completions[compKey];
    const isGhost = st.currentLevelData.ghost;
    const playCount = (existing?.playCount ?? 0) + 1;
    const completion: WordCompletion = {
      wordId: st.currentWord.id,
      display: st.currentWord.display,
      units: st.currentWord.units,
      ghostDone: existing?.ghostDone || isGhost,
      noGhostDone: existing?.noGhostDone || !isGhost,
      highestLevel: Math.max(existing?.highestLevel || 0, st.currentLevelData.level),
      playCount,
    };
    emitWordCompleted({
      level: st.currentLevelData.level, wordId: st.currentWord.id, ghost: isGhost, replay: false,
      score: Math.max(0, st.slots.length - st.wordErrors), maxScore: st.slots.length,
      durationSeconds: duration, errors: st.wordErrors, hintsUsed: st.wordHints, smashCount: st.wordSmashes,
    });

    const wallPos = wallPositionFor(st.plaques.length);
    const word = st.currentWord;
    const plaqueW = st.plaqueW;

    // fly the completed plaque up to the wall
    advanceTimer.current.push(setTimeout(() => {
      setFlying({ text: word.display, x: TRAY_CENTER.x, y: TRAY_CENTER.y, w: plaqueW, tx: TRAY_CENTER.x, ty: TRAY_CENTER.y, hop: true });
      setSparkle(null);
    }, 250));
    advanceTimer.current.push(setTimeout(() => {
      setFlying((f) => (f ? { ...f, tx: wallPos.x, ty: wallPos.y, hop: false } : f));
    }, 1050));
    advanceTimer.current.push(setTimeout(() => {
      const plaque: PlaqueState = {
        plaqueId: `plq-${word.id}-L${st.currentLevel}-${Date.now()}`,
        wordId: word.id, display: word.display, units: word.units,
        x: wallPos.x, y: wallPos.y, zOrder: st.plaques.length, playCount,
      };
      dispatch({ type: 'ADD_PLAQUE', plaque, completion });
      const newCompletions = { ...st.completions, [compKey]: completion };
      persist({ completions: newCompletions, plaques: [...st.plaques, plaque] });
      setFlying(null);
      advanceAfterWord(newCompletions);
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

  function advanceAfterWord(completions: Record<string, WordCompletion>) {
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
      dispatch({ type: 'LEVEL_TRANSITION', from: fromStage, to: toStage, hammerStage: nextData ? toStage : fromStage });
      persist({ currentLevel: nextData ? nextLevel : levelData.level, completions, hammerStage: nextData ? toStage : fromStage });
      // LevelTransition component calls onDone → we start next level
    } else {
      saveWordQueue(lang, levelData.level, queue);
      const nextWord = levelData.words.find((w) => w.id === queue[0]);
      if (!nextWord) return;
      const { pieces, slots, plaqueW } = buildLayout(nextWord);
      dispatch({ type: 'START_WORD', word: nextWord, levelData, queue, pieces, slots, plaqueW });
      advanceTimer.current.push(setTimeout(() => playWordSlow(nextWord.audio.slow, nextWord.display), 550));
      resetHintTimer();
    }
  }

  function onTransitionDone() {
    const st = stateRef.current;
    dispatch({ type: 'END_TRANSITION' });
    const nextLevel = st.currentLevel; // already advanced in persist? no — currentLevel unchanged in state; recompute
    const saved = getProgress(lang);
    const next = getLevelData(saved.currentLevel);
    if (next) startLevel(saved.currentLevel, saved.completions);
    else if (getLevelData(nextLevel)) startLevel(nextLevel, st.completions);
  }

  function persist(patch: Partial<Progress>) {
    const cur = getProgress(lang);
    saveProgress(lang, { ...cur, ...patch });
  }

  // ---- hammer callbacks ----
  const onWindupStart = useCallback(() => dispatch({ type: 'WINDUP' }), []);
  const onWindupCancel = useCallback(() => dispatch({ type: 'WINDUP_CANCEL' }), []);

  // ---- render ----
  const { phase } = state;
  const showWhole = phase === 'present' || phase === 'windup';
  const showPieces = phase === 'rebuild' || phase === 'complete';
  const ghostLevel = state.currentLevelData?.ghost ?? false;
  const hammerInteractive = phase === 'present' || phase === 'rebuild';
  const showTutorial = !state.tutorial.hammerDone && phase === 'present';

  const hintSlot = state.hint?.type === 'slot' ? state.hint.slotIndex ?? null : null;
  const hintPieceId = (() => {
    if (state.hint?.type !== 'piece') return null;
    const empty = state.slots.find((s) => !s.filled);
    if (!empty) return null;
    const match = state.pieces.find((p) => !p.placed && p.unit === empty.unit);
    return match?.id ?? null;
  })();

  return (
    <div className="ws-root">
      <div className="ws-stage" ref={stageRef}>
        <div key={shakeKey} className={`ws-shakeable ${impact ? 'ws-shake' : ''}`}>
          <Background />

          <Wall
            plaques={state.plaques}
            stageRef={stageRef}
            onReplay={(plaqueId, wordId) => {
              const w = findWord(langPack, wordId);
              if (w) {
                playWordNatural(w.audio.natural, w.display);
                bumpPlayCount(plaqueId);
              }
            }}
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

          {/* recesses + slots */}
          {showPieces && (
            <Tray
              slots={state.slots}
              ghost={ghostLevel}
              hintSlotIndex={hintSlot}
              onSlotPlay={(idx) => { const s = state.slots[idx]; if (s) playUnit(s.audioPath, s.unit); }}
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
              onPlay={() => { if (state.currentWord) playWordSlow(state.currentWord.audio.slow, state.currentWord.display); }}
            />
          )}

          {/* scattered / placed pieces */}
          {showPieces && state.pieces.map((p) => (
            <Piece
              key={p.id}
              piece={p}
              w={state.slots[p.unitIndex]?.w ?? unitWidth(p.unit)}
              hint={hintPieceId === p.id}
              stageRef={stageRef}
              onPickup={onPickup}
              onMove={onMove}
              onDrop={onDrop}
              seatKey={0}
            />
          ))}

          {/* flying completed plaque */}
          {flying && (
            <div
              className={flying.hop ? 'ws-hop' : undefined}
              style={{
                position: 'absolute', left: 0, top: 0, zIndex: 300,
                transform: `translate(${flying.tx - flying.w / 2}px, ${flying.ty - PIECE_H / 2}px)`,
                transition: flying.hop ? 'none' : 'transform 0.85s cubic-bezier(.34,.9,.4,1)',
              }}
            >
              <FlyingFace text={flying.text} w={flying.w} shrink={!flying.hop} />
            </div>
          )}

          {/* hammer */}
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

          {/* effects */}
          {impact && <ImpactFX x={impact.x} y={impact.y} seed={impact.seed} />}
          {sparkle && <Sparkles x={sparkle.x} y={sparkle.y} seed={sparkle.seed} />}

          {/* tutorial */}
          {showTutorial && <TutorialHand target={{ x: TRAY_CENTER.x, y: TRAY_CENTER.y }} />}

          {/* level transition */}
          {state.transition && (
            <LevelTransition fromStage={state.transition.from} toStage={state.transition.to} onDone={onTransitionDone} />
          )}
        </div>
      </div>
    </div>
  );

  function bumpPlayCount(plaqueId: string) {
    const plaques = stateRef.current.plaques.map((p) => (p.plaqueId === plaqueId ? { ...p, playCount: p.playCount + 1 } : p));
    dispatch({ type: 'SET_PLAQUES', plaques });
    persist({ plaques });
  }
}

function findWord(pack: LangPack, wordId: string): Word | null {
  for (const l of pack.levels) { const w = l.words.find((x) => x.id === wordId); if (w) return w; }
  return null;
}

function FlyingFace({ text, w, shrink }: { text: string; w: number; shrink: boolean }) {
  const scale = shrink ? 0.62 : 1;
  return (
    <div style={{ transform: `scale(${scale})`, transformOrigin: 'center', transition: 'transform 0.85s cubic-bezier(.34,.9,.4,1)' }}>
      <div
        style={{
          width: w, height: PIECE_H, borderRadius: 16,
          background: 'linear-gradient(170deg, #faeed2 0%, #f2e0b8 100%)',
          boxShadow: '0 8px 14px rgba(90,55,20,.32), inset 0 2px 2px rgba(255,255,255,.7), inset 0 -11px 0 #c9553e',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontFamily: "'Fredoka', system-ui, sans-serif", fontWeight: 700, fontSize: Math.round(PIECE_H * 0.52), color: '#c9553e', marginBottom: 6 }}>{text}</span>
      </div>
    </div>
  );
}
