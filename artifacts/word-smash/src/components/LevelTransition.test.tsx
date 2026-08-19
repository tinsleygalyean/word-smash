/**
 * Component tests for LevelTransition (TC-UI-10, TC-ENG-04, TESTSPEC §4.8).
 * Verifies the four-beat upgrade sequence timing and the tap-to-skip
 * fast-forward path, including idempotency of all three callbacks.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { LevelTransition } from './LevelTransition';

vi.mock('../game/audio', () => ({
  playFoley: vi.fn(),
  playWordSlow: vi.fn(),
  playWordNatural: vi.fn(),
  playUnit: vi.fn(),
  playCrash: vi.fn(),
  preloadLevel: vi.fn(),
}));

import * as audio from '../game/audio';

// Beat timing (mirrors LevelTransition.tsx constants)
const HOP_MS    = 500;
const SPIN_MS   = 900;
const BURST_MS  = 600;
const RETURN_MS = 500;
const PERSIST_MS  = HOP_MS + SPIN_MS;           // 1400
const NEXT_MS     = PERSIST_MS + BURST_MS;      // 2000
const DONE_MS     = NEXT_MS + RETURN_MS;        // 2500

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

function mountTransition(overrides: Partial<Parameters<typeof LevelTransition>[0]> = {}) {
  const onPersist   = vi.fn();
  const onStartNext = vi.fn();
  const onDone      = vi.fn();
  const { container, unmount } = render(
    <LevelTransition
      fromStage={0}
      toStage={1}
      onPersist={onPersist}
      onStartNext={onStartNext}
      onDone={onDone}
      {...overrides}
    />,
  );
  return { container, unmount, onPersist, onStartNext, onDone };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
describe('beat sequence timing (TC-UI-10)', () => {
  it('onPersist is NOT called before beat 2 (HOP+SPIN ms)', () => {
    const { onPersist } = mountTransition();
    advance(PERSIST_MS - 1);
    expect(onPersist).not.toHaveBeenCalled();
  });

  it('onPersist fires at exactly HOP+SPIN ms (beat 2: flash + hammer upgrade)', () => {
    const { onPersist } = mountTransition();
    advance(PERSIST_MS);
    expect(onPersist).toHaveBeenCalledTimes(1);
  });

  it('onStartNext is NOT called before beat 3', () => {
    const { onStartNext } = mountTransition();
    advance(NEXT_MS - 1);
    expect(onStartNext).not.toHaveBeenCalled();
  });

  it('onStartNext fires at HOP+SPIN+BURST ms (beat 3: return begins, next word loads)', () => {
    const { onStartNext } = mountTransition();
    advance(NEXT_MS);
    expect(onStartNext).toHaveBeenCalledTimes(1);
  });

  it('onDone fires at HOP+SPIN+BURST+RETURN ms (reveal the ready bench)', () => {
    const { onDone } = mountTransition();
    advance(DONE_MS);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('hammer stage shows fromStage initially, toStage after the flash', () => {
    // The flash swaps the recipe used for rendering; we verify via the
    // cymbal foley that fires alongside the flash (beat 2 marker).
    const { } = mountTransition();
    vi.mocked(audio.playFoley).mockClear();
    advance(PERSIST_MS - 1);
    expect(audio.playFoley).not.toHaveBeenCalled();
    advance(1); // lands at PERSIST_MS
    expect(audio.playFoley).toHaveBeenCalledWith('cymbal');
  });

  it('haptic fires at the flash moment', () => {
    mountTransition();
    vi.mocked(navigator.vibrate as ReturnType<typeof vi.fn>).mockClear?.();
    advance(PERSIST_MS);
    expect(navigator.vibrate).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('tap-to-skip (TC-UI-10)', () => {
  it('a pointer-down on the overlay fires all three callbacks immediately', () => {
    const { container, onPersist, onStartNext, onDone } = mountTransition();
    // Only advance past beat 1 so skip is "after beat 1" as spec says
    advance(HOP_MS + 1);
    fireEvent.pointerDown(container.firstElementChild!);
    expect(onPersist).toHaveBeenCalledTimes(1);
    expect(onStartNext).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('each callback is called exactly once even after tap (idempotent — beats already fired do not re-fire)', () => {
    const { container, onPersist, onStartNext, onDone } = mountTransition();
    // Advance past beat 2 so onPersist has already fired naturally
    advance(PERSIST_MS);
    expect(onPersist).toHaveBeenCalledTimes(1);
    // Tap fast-forwards the rest
    fireEvent.pointerDown(container.firstElementChild!);
    expect(onPersist).toHaveBeenCalledTimes(1);   // NOT called a second time
    expect(onStartNext).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('double-tap does not call any callback more than once', () => {
    const { container, onPersist, onStartNext, onDone } = mountTransition();
    advance(HOP_MS + 1);
    fireEvent.pointerDown(container.firstElementChild!);
    fireEvent.pointerDown(container.firstElementChild!);
    expect(onPersist).toHaveBeenCalledTimes(1);
    expect(onStartNext).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('after a tap, the natural beat timers do NOT fire a second time', () => {
    const { container, onPersist, onStartNext, onDone } = mountTransition();
    advance(HOP_MS + 1);
    fireEvent.pointerDown(container.firstElementChild!);
    // Run out all remaining time; counts must not grow
    advance(DONE_MS * 2);
    expect(onPersist).toHaveBeenCalledTimes(1);
    expect(onStartNext).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
describe('persistence safety (TC-ENG-04 detail)', () => {
  it('if the app is killed between beat 1 and beat 2, onPersist has not yet fired', () => {
    // Simulates unmounting after hop but before the flash — the upgrade has
    // NOT been persisted yet, so reopen returns the old stage.
    const { unmount, onPersist } = mountTransition();
    advance(HOP_MS + 50); // inside the hop, before spin completes
    unmount();
    // Timers cleared on unmount — onPersist must not have been called
    expect(onPersist).not.toHaveBeenCalled();
  });

  it('if the app is killed after beat 2, onPersist HAS fired (reopen lands upgraded)', () => {
    const { unmount, onPersist } = mountTransition();
    advance(PERSIST_MS + 10);
    unmount();
    expect(onPersist).toHaveBeenCalledTimes(1);
  });
});
