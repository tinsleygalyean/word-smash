import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { LangPack, Level, Word, PieceState, SlotState, GamePhase, WordCompletion, PlaqueState, TutorialFlags, HintState } from '../game/types';
import { computeScatterPositions, isNearSlot } from '../game/physics';
import { getProgress, saveProgress, getWordQueueForLevel, saveWordQueue, clearWordQueue } from '../game/storage';
import { playWordSlow, playWordNatural, playUnit, playFoley, preloadLevel } from '../game/audio';
import { emitWordCompleted, emitLevelCompleted, emitSummary } from '../game/events';
import { WorkbenchArea } from './WorkbenchArea';
import { HammerTool } from './HammerTool';
import { WallPlaques } from './WallPlaques';
import { Tutorial } from './Tutorial';
import { Celebration } from './Celebration';
import { LevelBanner } from './LevelBanner';

interface GameState {
  phase: GamePhase;
  currentLevel: number;
  currentWord: Word | null;
  currentLevelData: Level | null;
  wordQueue: string[];
  pieces: PieceState[];
  slots: SlotState[];
  completions: Record<string, WordCompletion>;
  plaques: PlaqueState[];
  hammerStage: number;
  hammerHeld: boolean;
  hint: HintState | null;
  tutorial: TutorialFlags;
  wordStartTime: number;
  levelStartTime: number;
  wordErrors: number;
  wordHints: number;
  wordSmashes: number;
  showLevelBanner: boolean;
  levelBannerText: string;
}

type Action =
  | { type: 'LOAD'; level: number; completions: Record<string, WordCompletion>; plaques: PlaqueState[]; hammerStage: number; tutorial: TutorialFlags }
  | { type: 'START_WORD'; word: Word; levelData: Level; queue: string[]; pieces: PieceState[]; slots: SlotState[] }
  | { type: 'SMASH'; pieces: PieceState[] }
  | { type: 'SMASH_DONE' }
  | { type: 'PLACE_PIECE'; pieceId: string; slotIndex: number; pieces: PieceState[]; slots: SlotState[] }
  | { type: 'KICK_PIECE'; pieceId: string; pieces: PieceState[]; slots: SlotState[] }
  | { type: 'MOVE_PIECE'; pieceId: string; x: number; y: number }
  | { type: 'WORD_COMPLETE'; plaque: PlaqueState; completion: WordCompletion }
  | { type: 'NEXT_WORD'; word: Word; queue: string[]; pieces: PieceState[]; slots: SlotState[] }
  | { type: 'LEVEL_COMPLETE'; hammerStage: number; text: string }
  | { type: 'LEVEL_BANNER_DONE' }
  | { type: 'SET_HAMMER_HELD'; held: boolean }
  | { type: 'SET_HINT'; hint: HintState | null }
  | { type: 'MARK_TUTORIAL'; key: keyof TutorialFlags }
  | { type: 'INCREMENT_SMASH' }
  | { type: 'INCREMENT_ERRORS' }
  | { type: 'INCREMENT_HINTS' };

const PIECE_COLORS = [
  '#e63946', '#f4a261', '#e9c46a', '#2a9d8f',
  '#457b9d', '#9b5de5', '#f15bb5', '#00b4d8',
];

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'LOAD':
      return {
        ...state,
        phase: 'loading',
        currentLevel: action.level,
        completions: action.completions,
        plaques: action.plaques,
        hammerStage: action.hammerStage,
        tutorial: action.tutorial,
      };
    case 'START_WORD':
      return {
        ...state,
        phase: 'present',
        currentWord: action.word,
        currentLevelData: action.levelData,
        wordQueue: action.queue,
        pieces: action.pieces,
        slots: action.slots,
        hint: null,
        wordStartTime: Date.now(),
        wordErrors: 0,
        wordHints: 0,
        wordSmashes: 0,
      };
    case 'SMASH':
      return { ...state, phase: 'smashing', pieces: action.pieces, wordSmashes: state.wordSmashes + 1 };
    case 'SMASH_DONE':
      return { ...state, phase: 'rebuild' };
    case 'PLACE_PIECE':
      return { ...state, pieces: action.pieces, slots: action.slots };
    case 'KICK_PIECE':
      return { ...state, pieces: action.pieces, slots: action.slots, wordErrors: state.wordErrors + 1 };
    case 'MOVE_PIECE':
      return {
        ...state,
        pieces: state.pieces.map(p =>
          p.id === action.pieceId ? { ...p, x: action.x, y: action.y } : p
        ),
      };
    case 'WORD_COMPLETE':
      return {
        ...state,
        phase: 'complete',
        plaques: [...state.plaques, action.plaque],
        completions: { ...state.completions, [action.completion.wordId]: action.completion },
      };
    case 'NEXT_WORD':
      return {
        ...state,
        phase: 'present',
        currentWord: action.word,
        wordQueue: action.queue,
        pieces: action.pieces,
        slots: action.slots,
        hint: null,
        wordStartTime: Date.now(),
        wordErrors: 0,
        wordHints: 0,
        wordSmashes: 0,
      };
    case 'LEVEL_COMPLETE':
      return {
        ...state,
        phase: 'levelComplete',
        hammerStage: action.hammerStage,
        showLevelBanner: true,
        levelBannerText: action.text,
      };
    case 'LEVEL_BANNER_DONE':
      return { ...state, showLevelBanner: false };
    case 'SET_HAMMER_HELD':
      return { ...state, hammerHeld: action.held };
    case 'SET_HINT':
      return { ...state, hint: action.hint };
    case 'MARK_TUTORIAL':
      return { ...state, tutorial: { ...state.tutorial, [action.key]: true } };
    case 'INCREMENT_SMASH':
      return { ...state, wordSmashes: state.wordSmashes + 1 };
    case 'INCREMENT_ERRORS':
      return { ...state, wordErrors: state.wordErrors + 1 };
    case 'INCREMENT_HINTS':
      return { ...state, wordHints: state.wordHints + 1 };
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
  completions: {},
  plaques: [],
  hammerStage: 0,
  hammerHeld: false,
  hint: null,
  tutorial: { hammerSeen: false, dragSeen: false },
  wordStartTime: 0,
  levelStartTime: Date.now(),
  wordErrors: 0,
  wordHints: 0,
  wordSmashes: 0,
  showLevelBanner: false,
  levelBannerText: '',
};

interface Props {
  langPack: LangPack;
  lang: string;
}

export function GameScene({ langPack, lang }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const containerRef = useRef<HTMLDivElement>(null);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const smashingRef = useRef(false);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getContainerSize() {
    const el = containerRef.current;
    if (!el) return { w: window.innerWidth, h: window.innerHeight };
    return { w: el.clientWidth, h: el.clientHeight };
  }

  function buildPiecesAndSlots(word: Word, levelData: Level): { pieces: PieceState[]; slots: SlotState[] } {
    const { w, h } = getContainerSize();
    const workbenchCY = h * 0.52;
    const unitCount = word.units.length;
    const slotWidth = Math.min(120, (w * 0.55) / unitCount);
    const totalW = unitCount * slotWidth;
    const startX = w / 2 - totalW / 2 + slotWidth / 2;

    const slots: SlotState[] = word.units.map((unit, i) => ({
      index: i,
      unit,
      filled: false,
      pieceId: null,
      audioPath: word.audio.units[i] || '',
    }));

    const pieces: PieceState[] = word.units.map((unit, i) => ({
      id: `piece-${i}`,
      unitIndex: i,
      unit,
      x: startX + i * slotWidth,
      y: workbenchCY,
      rotation: 0,
      placed: false,
      slotIndex: null,
      zIndex: 10 + i,
      audioPath: word.audio.units[i] || '',
    }));

    return { pieces, slots };
  }

  function getSlotPosition(slotIndex: number, word: Word): { x: number; y: number } {
    const { w, h } = getContainerSize();
    const workbenchCY = h * 0.52;
    const unitCount = word.units.length;
    const slotWidth = Math.min(120, (w * 0.55) / unitCount);
    const totalW = unitCount * slotWidth;
    const startX = w / 2 - totalW / 2 + slotWidth / 2;
    return { x: startX + slotIndex * slotWidth, y: workbenchCY };
  }

  function shuffleArray<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getLevelData(levelNum: number): Level | null {
    return langPack.levels.find(l => l.level === levelNum) || null;
  }

  function startLevel(levelNum: number, completions: Record<string, WordCompletion>) {
    const levelData = getLevelData(levelNum);
    if (!levelData) {
      console.error('Level not found:', levelNum);
      return;
    }

    preloadLevel(levelData.words);

    let queue = getWordQueueForLevel(lang, levelNum);
    if (!queue || queue.length === 0) {
      const incomplete = levelData.words
        .filter(w => {
          const c = completions[`${w.id}_L${levelNum}`];
          return !c;
        })
        .map(w => w.id);
      queue = incomplete.length > 0 ? shuffleArray(incomplete) : shuffleArray(levelData.words.map(w => w.id));
      saveWordQueue(lang, levelNum, queue);
    }

    const wordId = queue[0];
    const word = levelData.words.find(w => w.id === wordId);
    if (!word) return;

    const { pieces, slots } = buildPiecesAndSlots(word, levelData);
    dispatch({ type: 'START_WORD', word, levelData, queue, pieces, slots });

    setTimeout(() => {
      playWordSlow(word.audio.slow, word.display);
    }, 600);
  }

  useEffect(() => {
    const saved = getProgress(lang);
    dispatch({
      type: 'LOAD',
      level: saved.currentLevel,
      completions: saved.completions,
      plaques: saved.plaques,
      hammerStage: saved.hammerStage,
      tutorial: saved.tutorial,
    });
    startLevel(saved.currentLevel, saved.completions);
  }, []);

  function clearHintTimer() {
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = null;
  }

  function resetHintTimer() {
    clearHintTimer();
    hintTimerRef.current = setTimeout(() => {
      dispatch({ type: 'INCREMENT_HINTS' });
      dispatch({ type: 'SET_HINT', hint: { type: 'slot', slotIndex: getFirstEmptySlot() } });
      playHintSlotAudio();

      hintTimerRef.current = setTimeout(() => {
        dispatch({ type: 'SET_HINT', hint: { type: 'piece' } });
        hintTimerRef.current = setTimeout(() => {
          if (state.currentLevelData?.ghost === false) {
            dispatch({ type: 'SET_HINT', hint: { type: 'ghost' } });
          }
        }, 14000);
      }, 8000);
    }, 8000);
  }

  function getFirstEmptySlot(): number {
    const s = state.slots.find(sl => !sl.filled);
    return s ? s.index : 0;
  }

  function playHintSlotAudio() {
    const empty = state.slots.find(sl => !sl.filled);
    if (empty) playUnit(empty.audioPath, empty.unit);
  }

  function doSmash() {
    if (smashingRef.current) return;
    if (state.phase !== 'present' && state.phase !== 'rebuild') return;
    smashingRef.current = true;
    clearHintTimer();

    const { w, h } = getContainerSize();
    const workbenchCY = h * 0.52;
    const seed = Math.floor(Math.random() * 9999);
    const targets = computeScatterPositions(state.pieces.length, w, h, workbenchCY, seed);

    const scattered = state.pieces.map((p, i) => ({
      ...p,
      x: targets[i]?.x ?? p.x,
      y: targets[i]?.y ?? p.y,
      rotation: targets[i]?.rotation ?? 0,
      placed: false,
      slotIndex: null,
    }));

    const clearedSlots = state.slots.map(s => ({ ...s, filled: false, pieceId: null }));

    playFoley('smash');
    dispatch({ type: 'SMASH', pieces: scattered });

    setTimeout(() => {
      dispatch({ type: 'SMASH_DONE' });
      smashingRef.current = false;
      resetHintTimer();
      if (!state.tutorial.dragSeen) {
        dispatch({ type: 'MARK_TUTORIAL', key: 'dragSeen' });
      }
    }, 600);
  }

  function handleHammerActivated() {
    if (!state.tutorial.hammerSeen) {
      dispatch({ type: 'MARK_TUTORIAL', key: 'hammerSeen' });
    }
    doSmash();
  }

  function handlePiecePickup(pieceId: string) {
    clearHintTimer();
    dispatch({ type: 'SET_HINT', hint: null });
    const piece = state.pieces.find(p => p.id === pieceId);
    if (piece) playUnit(piece.audioPath, piece.unit);
  }

  function handlePieceDrop(pieceId: string, x: number, y: number) {
    if (!state.currentWord) return;
    const piece = state.pieces.find(p => p.id === pieceId);
    if (!piece) return;

    let nearestSlot: SlotState | null = null;
    let nearestDist = Infinity;

    for (const slot of state.slots) {
      if (slot.filled) continue;
      const sp = getSlotPosition(slot.index, state.currentWord);
      const dx = x - sp.x;
      const dy = y - sp.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestSlot = slot;
      }
    }

    const snapRadius = 80;
    if (nearestSlot && nearestDist < snapRadius) {
      const slotUnit = nearestSlot.unit;
      const pieceUnit = piece.unit;

      if (slotUnit === pieceUnit) {
        const sp = getSlotPosition(nearestSlot.index, state.currentWord);
        const updatedPieces = state.pieces.map(p =>
          p.id === pieceId
            ? { ...p, x: sp.x, y: sp.y, rotation: 0, placed: true, slotIndex: nearestSlot!.index }
            : p
        );
        const updatedSlots = state.slots.map(s =>
          s.index === nearestSlot!.index ? { ...s, filled: true, pieceId } : s
        );
        playFoley('snap');
        playUnit(piece.audioPath, piece.unit);
        dispatch({ type: 'PLACE_PIECE', pieceId, slotIndex: nearestSlot.index, pieces: updatedPieces, slots: updatedSlots });

        const allFilled = updatedSlots.every(s => s.filled);
        if (allFilled) {
          clearHintTimer();
          handleWordComplete(updatedPieces, updatedSlots);
        } else {
          resetHintTimer();
        }
      } else {
        const sp = getSlotPosition(nearestSlot.index, state.currentWord);
        const kickedPieces = state.pieces.map(p =>
          p.id === pieceId ? { ...p, x: sp.x + (Math.random() - 0.5) * 60, y: sp.y + 30, rotation: (Math.random() - 0.5) * 20 } : p
        );
        playFoley('kick');
        dispatch({ type: 'INCREMENT_ERRORS' });
        dispatch({ type: 'KICK_PIECE', pieceId, pieces: kickedPieces, slots: state.slots });
        resetHintTimer();
      }
    } else {
      dispatch({ type: 'MOVE_PIECE', pieceId, x, y });
      resetHintTimer();
    }
  }

  function handleWordComplete(_pieces: PieceState[], _slots: SlotState[]) {
    if (!state.currentWord || !state.currentLevelData) return;

    playFoley('celebrate');
    setTimeout(() => {
      if (state.currentWord) playWordNatural(state.currentWord.audio.natural, state.currentWord.display);
    }, 300);

    const duration = (Date.now() - state.wordStartTime) / 1000;
    const correctFirstTry = _slots.length - state.wordErrors;
    const score = Math.max(0, correctFirstTry);
    const compKey = `${state.currentWord.id}_L${state.currentLevelData.level}`;

    const existing = state.completions[compKey];
    const isGhost = state.currentLevelData.ghost;
    const updated: WordCompletion = {
      wordId: state.currentWord.id,
      display: state.currentWord.display,
      units: state.currentWord.units,
      ghostDone: existing?.ghostDone || isGhost,
      noGhostDone: existing?.noGhostDone || !isGhost,
      highestLevel: Math.max(existing?.highestLevel || 0, state.currentLevelData.level),
    };

    emitWordCompleted({
      level: state.currentLevelData.level,
      wordId: state.currentWord.id,
      ghost: isGhost,
      replay: false,
      score,
      maxScore: _slots.length,
      durationSeconds: duration,
      errors: state.wordErrors,
      hintsUsed: state.wordHints,
      smashCount: state.wordSmashes,
    });

    const anchorIndex = state.plaques.length;
    const plaque: PlaqueState = {
      wordId: state.currentWord.id,
      display: state.currentWord.display,
      units: state.currentWord.units,
      ghost: isGhost,
      zOrder: anchorIndex,
      anchorIndex,
      offsetX: (Math.random() - 0.5) * 12,
      offsetY: (Math.random() - 0.5) * 8,
      rotation: (Math.random() - 0.5) * 6,
    };

    const newCompletions = { ...state.completions, [compKey]: updated };
    dispatch({ type: 'WORD_COMPLETE', plaque, completion: updated });

    const progress = getProgress(lang);
    saveProgress(lang, {
      ...progress,
      completions: newCompletions,
      plaques: [...state.plaques, plaque],
    });

    celebrationTimeoutRef.current = setTimeout(() => {
      advanceAfterWord(newCompletions);
    }, 2000);
  }

  function advanceAfterWord(completions: Record<string, WordCompletion>) {
    if (!state.currentLevelData) return;
    const currentQueue = state.wordQueue.slice(1);
    const levelData = state.currentLevelData;

    if (currentQueue.length === 0) {
      clearWordQueue(lang, levelData.level);
      const levelDuration = (Date.now() - state.levelStartTime) / 1000;

      emitLevelCompleted({
        level: levelData.level,
        ghost: levelData.ghost,
        durationSeconds: levelDuration,
      });

      const wordsCompleted = Object.keys(completions).length;
      emitSummary({
        levelsPlayed: levelData.level,
        wordsCompleted,
        totalTimePlayed: levelDuration,
        lastLevelNumber: levelData.level,
      });

      const nextLevel = levelData.level + 1;
      const nextLevelData = getLevelData(nextLevel);
      const newHammerStage = Math.min(3, Math.floor((levelData.level) / 3));

      dispatch({
        type: 'LEVEL_COMPLETE',
        hammerStage: newHammerStage,
        text: nextLevelData ? `Level ${nextLevel}!` : 'All done!',
      });
      playFoley('hammerEvolve');

      const progress = getProgress(lang);
      saveProgress(lang, {
        ...progress,
        currentLevel: nextLevel,
        completions,
        hammerStage: newHammerStage,
      });

      setTimeout(() => {
        dispatch({ type: 'LEVEL_BANNER_DONE' });
        if (nextLevelData) {
          startLevel(nextLevel, completions);
        }
      }, 2500);
    } else {
      saveWordQueue(lang, levelData.level, currentQueue);
      const nextWordId = currentQueue[0];
      const nextWord = levelData.words.find(w => w.id === nextWordId);
      if (!nextWord) return;

      const { pieces, slots } = buildPiecesAndSlots(nextWord, levelData);
      dispatch({ type: 'NEXT_WORD', word: nextWord, queue: currentQueue, pieces, slots });
      setTimeout(() => {
        playWordSlow(nextWord.audio.slow, nextWord.display);
      }, 500);
    }
  }

  const hammerStageColors = [
    { head: '#8B6914', handle: '#6b4c1c' },
    { head: '#5c7a2c', handle: '#3d5216' },
    { head: '#1a6b8a', handle: '#0d3d52' },
    { head: '#6a1a8a', handle: '#3d0d52' },
  ];
  const hammerColor = hammerStageColors[Math.min(state.hammerStage, 3)];

  const pieceColors = state.pieces.map((_, i) => PIECE_COLORS[i % PIECE_COLORS.length]);

  return (
    <div ref={containerRef} className="ws-scene">
      <WallPlaques plaques={state.plaques} />

      <WorkbenchArea
        word={state.currentWord}
        levelData={state.currentLevelData}
        pieces={state.pieces}
        slots={state.slots}
        phase={state.phase}
        hint={state.hint}
        pieceColors={pieceColors}
        onPiecePickup={handlePiecePickup}
        onPieceDrop={handlePieceDrop}
        onWordPlay={() => {
          if (state.currentWord) playWordSlow(state.currentWord.audio.slow, state.currentWord.display);
        }}
        onSlotPlay={(idx) => {
          const slot = state.slots[idx];
          if (slot) playUnit(slot.audioPath, slot.unit);
        }}
        containerRef={containerRef}
      />

      <HammerTool
        stage={state.hammerStage}
        color={hammerColor}
        phase={state.phase}
        onSmash={handleHammerActivated}
        tutorialSeen={state.tutorial.hammerSeen}
        containerRef={containerRef}
      />

      {!state.tutorial.hammerSeen && state.phase === 'present' && (
        <Tutorial type="hammer" />
      )}
      {state.tutorial.hammerSeen && !state.tutorial.dragSeen && state.phase === 'rebuild' && (
        <Tutorial type="drag" />
      )}

      {state.phase === 'complete' && <Celebration />}

      {state.showLevelBanner && (
        <LevelBanner text={state.levelBannerText} hammerStage={state.hammerStage} />
      )}

      <div className="ws-level-indicator">Level {state.currentLevel}</div>
    </div>
  );
}
