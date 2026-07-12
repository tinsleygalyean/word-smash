// ============================================================================
// Word Smash — "Honey & Paint" design system
// All interactive geometry is expressed in a fixed 1200×540 REFERENCE canvas
// that is scaled to fit the device (see Stage in index.css / GameScene).
// ============================================================================

export const STAGE_W = 1200;
export const STAGE_H = 540;

// Zones
export const WALL_H = Math.round(STAGE_H * 0.46); // ~248 — plaque wall
export const BENCH_TOP = WALL_H; // bench front edge line

// 16:9 safe area (960×540) centered in the 1200 wide stage → 120px margins
export const SAFE_MARGIN = 120;
export const SAFE_LEFT = SAFE_MARGIN;
export const SAFE_RIGHT = STAGE_W - SAFE_MARGIN;
export const SAFE_W = SAFE_RIGHT - SAFE_LEFT;

// Hammer dock (bottom-right inside safe area)
export const HAMMER_DOCK = { x: 1012, y: 428 };
// Distance from plaque center at which the game "takes over" the swing
export const SNAP_RADIUS = 190;

// Tray / plaque anchor (word sits here in present + rebuild)
export const TRAY_CENTER = { x: 548, y: 356 };

// Piece / plaque sizing
export const PIECE_H = 122;
export const PIECE_GAP = 8; // gap between recesses/pieces
export const PIECE_RADIUS = 16;

export function unitWidth(text: string): number {
  // single letter ~104, digraph/syllable grows with glyph count
  return Math.max(104, text.length * 46 + 58);
}

// ---------------------------------------------------------------------------
// Palette (hex) — §2
// ---------------------------------------------------------------------------
export const C = {
  // Wall
  wallTop: '#e3c491',
  wallMid: '#d7b47e',
  wallBot: '#cba76f',
  plank: 'rgba(120,80,40,.14)',
  windowLight: 'rgba(255,244,214,.5)',
  // Bench
  benchTop: '#eed0a0',
  benchTop2: '#e5c188',
  benchBot: '#d3ab70',
  benchBot2: '#c69c60',
  edgeStripA: '#f8e0b4',
  edgeStripB: '#eed0a0',
  boardLine: 'rgba(120,80,40,.08)',
  // Plaque / piece
  faceTop: '#faeed2',
  faceBot: '#f2e0b8',
  faceShadow: '#a3713d',
  ink: '#5a4028',
  inkAlt: '#4a2e18',
  // Color identities
  red: '#c9553e',
  redDark: '#8f3a29',
  redTint: '#e88a6f',
  teal: '#3d8f83',
  tealDark: '#2a6459',
  tealTint: '#8ccabf',
  gold: '#e0a13c',
  goldInk: '#b98a2e',
  goldFaceA: '#f6d488',
  goldFaceB: '#e9b95a',
  goldFaceInk: '#8a5c18',
  // Wood
  handle: '#a5713c',
  handleStroke: '#7c5128',
  rawWood: '#b98a55',
  rawWoodStroke: '#8a6236',
  // Recess
  recess: 'rgba(90,55,20,.23)',
  recessPad: 'rgba(90,55,20,.14)',
  // Light / flash
  flashA: '#fff3d6',
  flashB: '#ffd98f',
} as const;

export type ColorId = 'red' | 'teal' | 'gold';
const CYCLE: ColorId[] = ['red', 'teal', 'gold'];
export function unitColorId(index: number): ColorId {
  return CYCLE[index % CYCLE.length];
}

export interface ColorSet {
  band: string;
  bandDark: string;
  letter: string;
}
export function colorSet(id: ColorId): ColorSet {
  switch (id) {
    case 'red':
      return { band: C.red, bandDark: C.redDark, letter: C.red };
    case 'teal':
      return { band: C.teal, bandDark: C.tealDark, letter: C.teal };
    case 'gold':
      return { band: C.gold, bandDark: '#b8801f', letter: C.goldInk };
  }
}

// ---------------------------------------------------------------------------
// Plaque wall play-count finish — §6
// 1× red · 2× teal · 3× gold · 4×+ gold-on-gold
// ---------------------------------------------------------------------------
export interface Finish {
  faceA: string;
  faceB: string;
  band: string;
  ink: string;
  goldFace: boolean;
}
export function finishForPlayCount(n: number): Finish {
  if (n >= 4) {
    return { faceA: C.goldFaceA, faceB: C.goldFaceB, band: C.gold, ink: C.goldFaceInk, goldFace: true };
  }
  if (n === 3) {
    return { faceA: C.faceTop, faceB: C.faceBot, band: C.gold, ink: C.goldInk, goldFace: false };
  }
  if (n === 2) {
    return { faceA: C.faceTop, faceB: C.faceBot, band: C.teal, ink: C.teal, goldFace: false };
  }
  return { faceA: C.faceTop, faceB: C.faceBot, band: C.red, ink: C.red, goldFace: false };
}

// ---------------------------------------------------------------------------
// Hammer — 10 stages, one silhouette, visible delta each level — §7
// size ramps 76→156px across L1..L10
// ---------------------------------------------------------------------------
export interface HammerStage {
  headA: string;   // head gradient top
  headB: string;   // head gradient bottom
  headStroke: string;
  grip: string;    // handle color
  gripStroke: string;
  size: number;    // head width at reference
  handleRing: boolean;
  stripe: boolean;
  goldBand: number; // 0,1,2 gold inlay bands
  creamDot: boolean;
  star: 0 | 1 | 2;  // 0 none, 1 filled, 2 outlined
  sparkle: boolean;
}

const RAW = C.rawWood;
const RAWS = C.rawWoodStroke;
export const HAMMER_STAGES: HammerStage[] = [
  // L1 plain raw wood
  { headA: RAW, headB: '#a97f4c', headStroke: RAWS, grip: RAW, gripStroke: RAWS, size: 76, handleRing: false, stripe: false, goldBand: 0, creamDot: false, star: 0, sparkle: false },
  // L2 darker wood + carved handle ring
  { headA: '#a5713c', headB: '#8a5e30', headStroke: C.handleStroke, grip: C.handle, gripStroke: C.handleStroke, size: 85, handleRing: true, stripe: false, goldBand: 0, creamDot: false, star: 0, sparkle: false },
  // L3 red painted head
  { headA: C.redTint, headB: C.red, headStroke: C.redDark, grip: C.handle, gripStroke: C.handleStroke, size: 94, handleRing: true, stripe: false, goldBand: 0, creamDot: false, star: 0, sparkle: false },
  // L4 + highlight stripe
  { headA: C.redTint, headB: C.red, headStroke: C.redDark, grip: C.handle, gripStroke: C.handleStroke, size: 103, handleRing: true, stripe: true, goldBand: 0, creamDot: false, star: 0, sparkle: false },
  // L5 teal head, thicker handle
  { headA: C.tealTint, headB: C.teal, headStroke: C.tealDark, grip: C.handle, gripStroke: C.handleStroke, size: 112, handleRing: true, stripe: true, goldBand: 0, creamDot: false, star: 0, sparkle: false },
  // L6 + gold inlay band
  { headA: C.tealTint, headB: C.teal, headStroke: C.tealDark, grip: C.handle, gripStroke: C.handleStroke, size: 121, handleRing: true, stripe: true, goldBand: 1, creamDot: false, star: 0, sparkle: false },
  // L7 red head, gold band + cream dot
  { headA: C.redTint, headB: C.red, headStroke: C.redDark, grip: C.handle, gripStroke: C.handleStroke, size: 130, handleRing: true, stripe: true, goldBand: 1, creamDot: true, star: 0, sparkle: false },
  // L8 + second gold band, painted grip
  { headA: C.redTint, headB: C.red, headStroke: C.redDark, grip: C.teal, gripStroke: C.tealDark, size: 139, handleRing: true, stripe: true, goldBand: 2, creamDot: true, star: 0, sparkle: false },
  // L9 + star emblem, teal grip
  { headA: C.redTint, headB: C.red, headStroke: C.redDark, grip: C.teal, gripStroke: C.tealDark, size: 148, handleRing: true, stripe: true, goldBand: 2, creamDot: false, star: 1, sparkle: false },
  // L10 gold head, red+teal bands, outlined star, sparkle glints
  { headA: C.goldFaceA, headB: C.goldFaceB, headStroke: '#a9821f', grip: C.teal, gripStroke: C.tealDark, size: 156, handleRing: true, stripe: true, goldBand: 2, creamDot: false, star: 2, sparkle: true },
];

export function hammerStageForLevel(level: number): number {
  // level 1..10 → stage index 0..9
  return Math.max(0, Math.min(HAMMER_STAGES.length - 1, level - 1));
}
