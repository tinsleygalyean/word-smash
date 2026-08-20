export interface WordAudio {
  slow: string;
  natural: string;
  units: string[];
}
export interface Word {
  id: string;
  display: string;
  units: string[];
  audio: WordAudio;
}
export interface Level {
  level: number;
  ghost: boolean;
  words: Word[];
}
export interface LangPack {
  langCode: string;
  levels: Level[];
}

export interface PieceState {
  id: string;
  unitIndex: number;
  unit: string;
  x: number;         // reference-canvas coords (center)
  y: number;
  rotation: number;
  placed: boolean;
  slotIndex: number | null;
  zIndex: number;
  audioPath: string;
}

export interface SlotState {
  index: number;
  unit: string;
  filled: boolean;
  pieceId: string | null;
  audioPath: string;
  x: number;         // reference-canvas coords (center)
  y: number;
  w: number;
}

export interface WordCompletion {
  wordId: string;
  ghostDone: boolean;
  noGhostDone: boolean;
  highestLevel: number;
  display: string;
  units: string[];
  playCount: number;
}

export interface PlaqueState {
  plaqueId: string;  // stable per-instance id (ONE plaque per wordId — §6)
  wordId: string;
  display: string;
  units: string[];
  x: number;         // wall-zone reference coords (center)
  y: number;
  zOrder: number;
  playCount: number;    // cumulative across ghost/no-ghost/replays — §6
  highestLevel: number; // highest level ever reached for this word (drives replay) — §6
  levelsPlayed: number; // distinct levels completed for this word — drives the plaque finish (replays do NOT advance it)
}

export type GamePhase =
  | 'loading'
  | 'present'      // whole plaque seated, awaiting smash
  | 'windup'       // hammer taken over, scaling to camera
  | 'rebuild'      // pieces scattered, drag to slots
  | 'complete'     // word finished: fuse/hop/flight
  | 'levelComplete'; // 3-beat level transition

export interface HintState {
  type: 'slot' | 'piece' | 'ghost';
  slotIndex?: number;
  pieceId?: string;
}

export interface TutorialFlags {
  hammerDone: boolean; // set after first COMPLETED smash
}
