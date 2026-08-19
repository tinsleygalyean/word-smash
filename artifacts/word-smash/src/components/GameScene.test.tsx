/**
 * Component/interaction suite for GameScene (TESTSPEC §1.4).
 * Audio module fully mocked; pointer events simulated in the 1200×540
 * reference canvas (scale pinned to 1 in test setup).
 *
 * Covers: TC-ENG-01/02/03, TC-UI-01/02/03/04/06/08, TC-PHY-03/04 (component
 * half), TC-EVT-03 (bridge stub), TC-NFR-04 (haptics).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { GameScene } from './GameScene';
import { MINI_PACK } from '../test/fixtures';
import { saveProgress, saveWordQueue, getProgress, type Progress } from '../game/storage';
import { TRAY_CENTER, PIECE_GAP, unitWidth, WALL_H } from '../game/design';
import * as audio from '../game/audio';

vi.mock('../game/audio', () => ({
  playWordSlow: vi.fn(),
  playWordNatural: vi.fn(),
  playUnit: vi.fn(),
  playFoley: vi.fn(),
  playCrash: vi.fn(),
  preloadLevel: vi.fn(),
}));

const LANG = 'test';
const HAMMER_DOCK = { x: 1012, y: 428 };

function baseProgress(patch: Partial<Progress> = {}): Progress {
  return {
    currentLevel: 1, completions: {}, hammerStage: 0, plaques: [],
    tutorial: { hammerDone: true }, // skip the persistent first-run hand by default
    ...patch,
  };
}

/** Slot center coords for a word laid out in the tray (mirrors buildLayout). */
function slotCenters(units: string[]): { x: number; y: number }[] {
  const widths = units.map((u) => unitWidth(u));
  const total = widths.reduce((s, w) => s + w, 0) + PIECE_GAP * (units.length - 1);
  let cx = TRAY_CENTER.x - total / 2;
  return units.map((_, i) => {
    const x = cx + widths[i] / 2;
    cx += widths[i] + PIECE_GAP;
    return { x, y: TRAY_CENTER.y };
  });
}

function renderGame() {
  return render(<GameScene langPack={MINI_PACK} lang={LANG} />);
}

function hammerEl(container: HTMLElement): HTMLElement {
  const rock = container.querySelector('.ws-hammer-rock');
  expect(rock, 'hammer not found (expected docked, interactive hammer)').toBeTruthy();
  return rock!.parentElement as HTMLElement;
}

function pieceEl(container: HTMLElement, unit: string): HTMLElement {
  const el = Array.from(container.querySelectorAll('div')).find(
    (d) => d.style.willChange === 'transform' && d.textContent === unit,
  );
  expect(el, `piece "${unit}" not found`).toBeTruthy();
  return el as HTMLElement;
}

function wallPlaqueEl(container: HTMLElement, text: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll('div')).find(
    (d) => d.style.width === '150px' && d.style.cursor === 'grab' && d.textContent === text,
  );
}

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

/** Drive a full hold-through smash: drag the hammer over the plaque, hold. */
function smash(container: HTMLElement) {
  const h = hammerEl(container);
  fireEvent.pointerDown(h, { clientX: HAMMER_DOCK.x, clientY: HAMMER_DOCK.y, pointerId: 1 });
  fireEvent.pointerMove(h, { clientX: TRAY_CENTER.x, clientY: TRAY_CENTER.y, pointerId: 1 });
  advance(620 + 150 + 160 + 20); // apex + hang + strike
}

/** Drag a loose piece from its current position and drop it at (tx, ty). */
function dragPiece(container: HTMLElement, unit: string, from: { x: number; y: number }, to: { x: number; y: number }) {
  const p = pieceEl(container, unit);
  fireEvent.pointerDown(p, { clientX: from.x, clientY: from.y, pointerId: 2 });
  fireEvent.pointerMove(p, { clientX: to.x, clientY: to.y, pointerId: 2 });
  fireEvent.pointerUp(p, { clientX: to.x, clientY: to.y, pointerId: 2 });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
});
afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
describe('cold load (TC-ENG-01)', () => {
  it('reaches present with the first word seated and the restored level', () => {
    saveProgress(LANG, baseProgress({ currentLevel: 2 }));
    saveWordQueue(LANG, 2, ['cat', 'up']);
    const { container, getByText } = renderGame();
    expect(getByText('cat')).toBeInTheDocument(); // whole plaque of the restored level's queued word
    expect(container.querySelector('.ws-vignette')).toBeNull();
    expect(audio.preloadLevel).toHaveBeenCalled();
  });

  it('restores a persisted mid-level queue identically (TC-ENG-05)', () => {
    saveProgress(LANG, baseProgress());
    saveWordQueue(LANG, 1, ['bee', 'up']);
    const { getByText, unmount } = renderGame();
    expect(getByText('bee')).toBeInTheDocument();
    unmount();
    // reload — same queue head, untouched
    const second = renderGame();
    expect(second.getByText('bee')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(`ws_${LANG}_queue_1`)!)).toEqual(['bee', 'up']);
  });
});

// ---------------------------------------------------------------------------
describe('smash interaction (TC-UI-01 / TC-UI-02 / TC-NFR-04)', () => {
  beforeEach(() => {
    saveProgress(LANG, baseProgress());
    saveWordQueue(LANG, 1, ['up', 'bee']);
  });

  it('hold-through: drag within range takes over the swing and splits the plaque → rebuild', () => {
    const { container } = renderGame();
    const h = hammerEl(container);
    fireEvent.pointerDown(h, { clientX: HAMMER_DOCK.x, clientY: HAMMER_DOCK.y, pointerId: 1 });
    fireEvent.pointerMove(h, { clientX: TRAY_CENTER.x, clientY: TRAY_CENTER.y, pointerId: 1 });
    // windup: world dims
    expect(container.querySelector('.ws-vignette')).not.toBeNull();
    advance(620 + 150 + 160 + 20);
    // struck → rebuild: vignette gone, whole plaque replaced by loose pieces
    expect(container.querySelector('.ws-vignette')).toBeNull();
    expect(pieceEl(container, 'u')).toBeInTheDocument();
    expect(pieceEl(container, 'p')).toBeInTheDocument();
    expect(audio.playCrash).toHaveBeenCalledTimes(1);
    expect(navigator.vibrate).toHaveBeenCalled(); // haptics on impact
  });

  it('release-early cancels with no penalty: plaque untouched, back to present', () => {
    const { container, getByText } = renderGame();
    const h = hammerEl(container);
    fireEvent.pointerDown(h, { clientX: HAMMER_DOCK.x, clientY: HAMMER_DOCK.y, pointerId: 1 });
    fireEvent.pointerMove(h, { clientX: TRAY_CENTER.x, clientY: TRAY_CENTER.y, pointerId: 1 });
    expect(container.querySelector('.ws-vignette')).not.toBeNull();
    advance(200); // before the commit point (620+150ms)
    fireEvent.pointerUp(h, { clientX: TRAY_CENTER.x, clientY: TRAY_CENTER.y, pointerId: 1 });
    advance(300);
    expect(container.querySelector('.ws-vignette')).toBeNull();
    expect(getByText('up')).toBeInTheDocument(); // whole plaque still seated
    expect(audio.playCrash).not.toHaveBeenCalled();
  });

  it('re-smash re-scatters everything including seated pieces (TC-PHY-04)', () => {
    const { container } = renderGame();
    smash(container);
    const [s0] = slotCenters(['u', 'p']);
    dragPiece(container, 'u', s0, s0); // seat "u"
    expect(pieceEl(container, 'u').style.transform).toContain('rotate(0deg)');
    // drag hammer over the tray during rebuild → resmash
    const h = hammerEl(container);
    fireEvent.pointerDown(h, { clientX: HAMMER_DOCK.x, clientY: HAMMER_DOCK.y, pointerId: 1 });
    fireEvent.pointerMove(h, { clientX: TRAY_CENTER.x, clientY: TRAY_CENTER.y, pointerId: 1 });
    expect(audio.playCrash).toHaveBeenCalledTimes(2);
    // the ghost outline for "u" is back (its slot was cleared again)
    const outlines = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.style.color === 'transparent' && s.textContent === 'u',
    );
    expect(outlines.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe('rebuild drops (TC-UI-03 / TC-PHY-03)', () => {
  beforeEach(() => {
    saveProgress(LANG, baseProgress());
    saveWordQueue(LANG, 1, ['up', 'bee']);
  });

  it('correct drop within SNAP seats flush and plays the unit sound', () => {
    const { container } = renderGame();
    smash(container);
    const [s0] = slotCenters(['u', 'p']);
    vi.mocked(audio.playUnit).mockClear();
    // drop "u" 50px away from its slot — inside SNAP=80
    dragPiece(container, 'u', s0, { x: s0.x + 50, y: s0.y });
    const seated = pieceEl(container, 'u');
    expect(seated.style.transform).toContain(`translate(${s0.x - unitWidth('u') / 2}px`); // snapped flush
    expect(audio.playFoley).toHaveBeenCalledWith('thunk');
    expect(audio.playUnit).toHaveBeenCalled();
  });

  it('wrong-unit drop bounces back with no buzzer (kick foley, piece not seated)', () => {
    const { container } = renderGame();
    smash(container);
    const [s0, s1] = slotCenters(['u', 'p']);
    vi.mocked(audio.playFoley).mockClear();
    // drop "u" onto the "p" slot
    dragPiece(container, 'u', s0, s1);
    expect(audio.playFoley).toHaveBeenCalledWith('kick');
    expect(audio.playFoley).not.toHaveBeenCalledWith('thunk');
    // bounced: not at either slot center, still draggable (cursor grab)
    const p = pieceEl(container, 'u');
    expect(p.style.cursor).toBe('grab');
    expect(p.style.transform).not.toContain(`translate(${s1.x - unitWidth('u') / 2}px`);
  });

  it('a drop beyond SNAP just settles where released', () => {
    const { container } = renderGame();
    smash(container);
    const [s0] = slotCenters(['u', 'p']);
    vi.mocked(audio.playFoley).mockClear();
    dragPiece(container, 'u', s0, { x: 200, y: 480 });
    expect(audio.playFoley).not.toHaveBeenCalledWith('thunk');
    expect(audio.playFoley).not.toHaveBeenCalledWith('kick');
    expect(pieceEl(container, 'u').style.transform).toContain('translate(');
  });
});

// ---------------------------------------------------------------------------
describe('hint modes (TC-UI-04)', () => {
  it('ghost level shows outline letters and mute slots (no play buttons)', () => {
    saveProgress(LANG, baseProgress());
    saveWordQueue(LANG, 1, ['up', 'bee']);
    const { container } = renderGame();
    smash(container);
    const outlines = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.style.color === 'transparent',
    );
    expect(outlines.map((s) => s.textContent)).toEqual(['u', 'p']);
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('no-ghost level shows ghost play buttons that speak the belonging tile sound', () => {
    saveProgress(LANG, baseProgress({ currentLevel: 2 }));
    saveWordQueue(LANG, 2, ['up', 'cat']);
    const { container } = renderGame();
    smash(container);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2); // one per empty slot
    // no outline letters on a no-ghost level
    const outlines = Array.from(container.querySelectorAll('span')).filter(
      (s) => s.style.color === 'transparent' && (s.textContent?.length ?? 0) > 0,
    );
    expect(outlines.length).toBe(0);
    vi.mocked(audio.playUnit).mockClear();
    fireEvent.pointerDown(buttons[0]);
    expect(audio.playUnit).toHaveBeenCalledWith('audios/up_u.mp3', 'u');
  });
});

// ---------------------------------------------------------------------------
describe('word → level completion flow (TC-ENG-02 / TC-ENG-03 / TC-EVT-03)', () => {
  it('completing the last word finishes the level, persists, and starts the next level', () => {
    const posted: string[] = [];
    window.ReactNativeWebView = { postMessage: (m: string) => { posted.push(m); } };
    saveProgress(LANG, baseProgress());
    saveWordQueue(LANG, 1, ['up']); // single-word queue → completing it completes the level
    const { container, getByText } = renderGame();
    smash(container);
    const [s0, s1] = slotCenters(['u', 'p']);
    dragPiece(container, 'u', s0, s0);
    dragPiece(container, 'p', s1, s1);
    // complete: fuse → hop → flight (250/1050/1900ms), then the transition beats
    advance(2000);
    const types = posted.map((m) => JSON.parse(m).payload.data?.type ?? JSON.parse(m).payload.collection);
    expect(types).toContain('word_completed');
    const wc = posted.map((m) => JSON.parse(m).payload).find((p) => p.data?.type === 'word_completed')!;
    expect(wc.data).toMatchObject({ level: 1, word_id: 'up', ghost: true, replay: false, errors: 0, smash_count: 1 });
    expect(types).toContain('level_completed');
    expect(posted.map((m) => JSON.parse(m).payload.collection)).toContain('summary_data');
    // plaque landed on the wall + persisted
    const prog = getProgress(LANG);
    expect(prog.plaques).toHaveLength(1);
    expect(prog.plaques[0].wordId).toBe('up');
    // ride the level transition to its end: persist at beat 2, next word after
    advance(500 + 900 + 600 + 500 + 100);
    expect(getProgress(LANG).currentLevel).toBe(2);
    expect(getProgress(LANG).hammerStage).toBe(1);
    advance(800); // present cue timers
    // level 2's first word is presented
    const l2words = MINI_PACK.levels[1].words.map((w) => w.display);
    // a level-2 word is presented on the bench as the breathing whole plaque
    const whole = Array.from(container.querySelectorAll('div')).filter((d) =>
      d.className.includes('ws-breathe'),
    );
    expect(whole.length).toBe(1);
    expect(l2words).toContain(whole[0].textContent);
  });
});

// ---------------------------------------------------------------------------
describe('wall replay (TC-UI-06)', () => {
  it('dragging a plaque down over the bench starts a replay at its highest level', () => {
    saveProgress(LANG, baseProgress({
      currentLevel: 1,
      plaques: [{
        plaqueId: 'plq-up', wordId: 'up', display: 'up', units: ['u', 'p'],
        x: 300, y: 100, zOrder: 1, playCount: 2, highestLevel: 2, levelsPlayed: 2,
      }],
      completions: {
        up_L1: { wordId: 'up', display: 'up', units: ['u', 'p'], ghostDone: true, noGhostDone: false, highestLevel: 1, playCount: 1 },
        up_L2: { wordId: 'up', display: 'up', units: ['u', 'p'], ghostDone: true, noGhostDone: true, highestLevel: 2, playCount: 2 },
      },
    }));
    saveWordQueue(LANG, 1, ['bee']);
    const { container } = renderGame();
    expect(wallPlaqueEl(container, 'up')).toBeTruthy();
    const plaque = wallPlaqueEl(container, 'up')!;
    // drag down past the wall edge onto the bench
    fireEvent.pointerDown(plaque, { clientX: 300, clientY: 100, pointerId: 3 });
    fireEvent.pointerMove(plaque, { clientX: 300, clientY: WALL_H + 150, pointerId: 3 });
    fireEvent.pointerUp(plaque, { clientX: 300, clientY: WALL_H + 150, pointerId: 3 });
    // replay session: plaque leaves the wall, "up" presented on the bench
    expect(wallPlaqueEl(container, 'up')).toBeUndefined();
    const wholes = Array.from(container.querySelectorAll('div')).filter(
      (d) => d.className.includes('ws-breathe') && d.textContent === 'up',
    );
    expect(wholes.length).toBe(1);
    // tap (no drag) on a plaque just plays the word — verify via a fresh render
  });

  it('a simple tap on a plaque speaks the word without starting a replay', () => {
    saveProgress(LANG, baseProgress({
      plaques: [{
        plaqueId: 'plq-up', wordId: 'up', display: 'up', units: ['u', 'p'],
        x: 300, y: 100, zOrder: 1, playCount: 1, highestLevel: 1, levelsPlayed: 1,
      }],
    }));
    saveWordQueue(LANG, 1, ['bee']);
    const { container } = renderGame();
    const plaque = wallPlaqueEl(container, 'up')!;
    vi.mocked(audio.playWordNatural).mockClear();
    fireEvent.pointerDown(plaque, { clientX: 300, clientY: 100, pointerId: 3 });
    fireEvent.pointerUp(plaque, { clientX: 300, clientY: 100, pointerId: 3 });
    expect(audio.playWordNatural).toHaveBeenCalledWith('audios/up_natural.mp3', 'up');
    expect(wallPlaqueEl(container, 'up')).toBeTruthy(); // still on the wall
  });
});

// ---------------------------------------------------------------------------
// TC-UI-08 — CRITICAL GUARD: no text/emoji/mascot anywhere in gameplay.
// Every rendered text node must be pack content (a word or unit being taught).
// ---------------------------------------------------------------------------
describe('no text/emoji in gameplay (TC-UI-08 / release gate G4)', () => {
  function collectTextNodes(root: Node): string[] {
    const out: string[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const t = n.textContent?.trim();
      if (t) out.push(t);
    }
    return out;
  }
  const allowed = new Set(
    MINI_PACK.levels.flatMap((l) => l.words.flatMap((w) => [w.display, ...w.units])),
  );
  const EMOJI = /\p{Extended_Pictographic}/u;

  it('present phase renders only pack content as text', () => {
    saveProgress(LANG, baseProgress());
    saveWordQueue(LANG, 1, ['up', 'bee']);
    const { container } = renderGame();
    for (const t of collectTextNodes(container)) {
      expect(allowed.has(t), `unexpected gameplay text: "${t}"`).toBe(true);
      expect(EMOJI.test(t), `emoji in gameplay: "${t}"`).toBe(false);
    }
  });

  it('rebuild phase renders only pack content as text', () => {
    saveProgress(LANG, baseProgress());
    saveWordQueue(LANG, 1, ['up', 'bee']);
    const { container } = renderGame();
    smash(container);
    for (const t of collectTextNodes(container)) {
      expect(allowed.has(t), `unexpected gameplay text: "${t}"`).toBe(true);
      expect(EMOJI.test(t), `emoji in gameplay: "${t}"`).toBe(false);
    }
  });
});
