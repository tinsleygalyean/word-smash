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
  x: number;
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
}

export interface WordCompletion {
  wordId: string;
  ghostDone: boolean;
  noGhostDone: boolean;
  highestLevel: number;
  display: string;
  units: string[];
}

export interface PlaqueState {
  wordId: string;
  display: string;
  units: string[];
  ghost: boolean;
  zOrder: number;
  anchorIndex: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
}

export type GamePhase =
  | 'loading'
  | 'present'
  | 'smashing'
  | 'rebuild'
  | 'complete'
  | 'levelComplete';

export interface HintState {
  type: 'slot' | 'piece' | 'ghost';
  slotIndex?: number;
  pieceId?: string;
}

export interface TutorialFlags {
  hammerSeen: boolean;
  dragSeen: boolean;
}
