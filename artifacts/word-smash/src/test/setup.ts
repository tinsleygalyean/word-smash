import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// The game positions everything in a 1200×540 reference canvas scaled from the
// stage element's bounding rect. jsdom reports 0×0 rects, which would make
// screenToStage divide by zero — pin every rect to the reference canvas so
// client coords === stage coords (scale 1).
// ---------------------------------------------------------------------------
HTMLElement.prototype.getBoundingClientRect = function () {
  return {
    left: 0, top: 0, right: 1200, bottom: 540,
    width: 1200, height: 540, x: 0, y: 0,
    toJSON() { return {}; },
  } as DOMRect;
};

// Pointer events — jsdom has no PointerEvent / pointer capture.
if (!('PointerEvent' in window)) {
  class PointerEventPoly extends MouseEvent {
    pointerId: number;
    constructor(type: string, props: MouseEventInit & { pointerId?: number } = {}) {
      super(type, props);
      this.pointerId = props.pointerId ?? 1;
    }
  }
  (window as unknown as Record<string, unknown>).PointerEvent = PointerEventPoly;
}
HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};

// Scatter physics runs on requestAnimationFrame. Stub it to never fire so the
// scattered pieces keep deterministic positions (their pre-scatter slot
// coordinates) for drag/drop assertions.
window.requestAnimationFrame = (() => 0) as typeof requestAnimationFrame;
window.cancelAnimationFrame = () => {};

// Haptics (TC-NFR-04): feature-detected call site — provide a spyable stub.
Object.defineProperty(navigator, 'vibrate', { value: vi.fn(), writable: true, configurable: true });

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete (window as { ReactNativeWebView?: unknown }).ReactNativeWebView;
});
