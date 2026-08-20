/**
 * Component tests for TutorialHand (TC-UI-09, TESTSPEC §4.8).
 * Verifies the three demo loop modes render the correct SVG geometry,
 * animation keyTimes, and ghost-hammer presence/absence.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TutorialHand } from './TutorialHand';
import { HAMMER_DOCK } from '../game/design';

const TARGET = { x: 548, y: 356 }; // TRAY_CENTER

describe('TutorialHand — hammer mode (default)', () => {
  it('renders an SVG overlay with pointer-events none', () => {
    const { container } = render(<TutorialHand target={TARGET} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.style.pointerEvents).toBe('none');
  });

  it('path starts at HAMMER_DOCK and stops short of target (+90px)', () => {
    const { container } = render(<TutorialHand target={TARGET} />);
    // The motion path (id="ws-tut-path") encodes the quadratic bezier
    const motionPath = container.querySelector('path#ws-tut-path');
    expect(motionPath).not.toBeNull();
    const d = motionPath!.getAttribute('d')!;
    // starts at the dock
    expect(d).toMatch(new RegExp(`M ${HAMMER_DOCK.x} ${HAMMER_DOCK.y}`));
    // ends 90px short of target X (stops before the strike zone — §9)
    expect(d).toContain(`${TARGET.x + 90} ${TARGET.y}`);
  });

  it('uses keyTimes "0;0.72;1" (pauses briefly at apex, not an extended hold)', () => {
    const { container } = render(<TutorialHand target={TARGET} />);
    const anim = container.querySelector('animateMotion');
    expect(anim).not.toBeNull();
    expect(anim!.getAttribute('keyTimes')).toBe('0;0.72;1');
  });

  it('shows the ghost hammer SVG rects', () => {
    const { container } = render(<TutorialHand target={TARGET} />);
    // Ghost hammer = handle rect + head rect inside a transform group
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThanOrEqual(2); // handle + head
  });

  it('animation duration is 1.6s', () => {
    const { container } = render(<TutorialHand target={TARGET} />);
    const anim = container.querySelector('animateMotion');
    expect(anim!.getAttribute('dur')).toBe('1.6s');
  });
});

describe('TutorialHand — holdThrough mode', () => {
  it('uses extended keyTimes "0;0.55;1" to show "keep holding"', () => {
    const { container } = render(<TutorialHand target={TARGET} mode="holdThrough" />);
    const anim = container.querySelector('animateMotion');
    expect(anim!.getAttribute('keyTimes')).toBe('0;0.55;1');
  });

  it('path ends AT the target (no short-stop, to teach full hold-through)', () => {
    const { container } = render(<TutorialHand target={TARGET} mode="holdThrough" />);
    const motionPath = container.querySelector('path#ws-tut-path');
    const d = motionPath!.getAttribute('d')!;
    // endpoint is exactly TARGET.x (not +90)
    expect(d).toContain(`${TARGET.x} ${TARGET.y}`);
    expect(d).not.toContain(`${TARGET.x + 90}`);
  });

  it('still shows the ghost hammer', () => {
    const { container } = render(<TutorialHand target={TARGET} mode="holdThrough" />);
    expect(container.querySelectorAll('rect').length).toBeGreaterThanOrEqual(2);
  });
});

describe('TutorialHand — dragPiece mode', () => {
  const FROM = { x: 300, y: 480 };
  const TO   = { x: 548, y: 356 };

  it('does NOT render the ghost hammer (piece drag needs an uncluttered path)', () => {
    const { container } = render(
      <TutorialHand target={TARGET} mode="dragPiece" from={FROM} to={TO} />,
    );
    // ghost hammer group has two rects (handle + head); without it there are none
    expect(container.querySelectorAll('rect').length).toBe(0);
  });

  it('path starts at the piece origin (from) and ends at the slot (to)', () => {
    const { container } = render(
      <TutorialHand target={TARGET} mode="dragPiece" from={FROM} to={TO} />,
    );
    const motionPath = container.querySelector('path#ws-tut-path');
    const d = motionPath!.getAttribute('d')!;
    expect(d).toMatch(new RegExp(`M ${FROM.x} ${FROM.y}`));
    expect(d).toContain(`${TO.x} ${TO.y}`);
  });

  it('animation duration is 1.8s (slower than hammer to read the drag clearly)', () => {
    const { container } = render(
      <TutorialHand target={TARGET} mode="dragPiece" from={FROM} to={TO} />,
    );
    const anim = container.querySelector('animateMotion');
    expect(anim!.getAttribute('dur')).toBe('1.8s');
  });
});
