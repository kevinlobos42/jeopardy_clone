/**
 * Game shapes both sides share: phases, settings, clue positions, and the
 * GameView each client receives (inside the lobby message).
 */

/** Every situation the game can be in. See "Phases" in game-rules.md. */
export type Phase =
  | "lobby"
  | "board"
  | "clue"
  | "answering"
  | "reveal"
  | "roundIntro"
  | "finalWager"
  | "finalClue"
  | "finalReveal"
  | "gameOver";

/** Timer lengths the host can change. Seconds. */
export interface GameSettings {
  buzzSeconds: number;
  answerSeconds: number;
  finalSeconds: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  buzzSeconds: 8,
  answerSeconds: 5,
  finalSeconds: 30,
};

export const SETTING_LIMITS = {
  buzzSeconds: { min: 3, max: 60 },
  answerSeconds: { min: 2, max: 60 },
  finalSeconds: { min: 10, max: 300 },
} as const;

/** Final-round wagers are capped at this for every team. */
export const FINAL_WAGER_MAX = 1000;

/** Where one clue lives in the clue file. */
export interface CluePosition {
  round: number;
  column: number;
  row: number;
}

/** String form of a position, for lists and lookups ("1-3-0"). */
export function clueKey(p: CluePosition): string {
  return `${p.round}-${p.column}-${p.row}`;
}

// ---------- What clients receive ----------

export type CellState = "open" | "used" | "missing";

export interface BoardCellView {
  row: number;
  value: number;
  state: CellState;
}

export interface BoardColumnView {
  topic: string;
  cells: BoardCellView[];
}

export interface ClueResultView {
  teamId: string;
  correct: boolean;
  points: number;
}

export interface CurrentClueView {
  position: CluePosition;
  topic: string;
  value: number;
  question: string;
  /** Only the host gets this before the reveal; everyone gets it during reveal. */
  answer: string | null;
  /** Team currently answering (phase "answering"), or null. */
  buzzedTeamId: string | null;
  /** Name of the person who pressed first. */
  buzzedByName: string | null;
  lockedOutTeamIds: string[];
  /** ms timestamps (server clock). */
  buzzDeadline: number | null;
  answerDeadline: number | null;
  /** True once the buzz timer ran out and buzzers locked. */
  buzzExpired: boolean;
  /** True once the answer timer ran out. */
  answerExpired: boolean;
  /** Rulings made on this clue so far. */
  results: ClueResultView[];
}

export interface FinalTeamView {
  teamId: string;
  /** Has this team locked in a wager? */
  wagered: boolean;
  /** The wager amount, when this client may see it (host, own team, or after judging). */
  wager: number | null;
  /** Has this team sent an answer? */
  answered: boolean;
  /** The answer text, when this client may see it (host, own team, or after judging). */
  answer: string | null;
  /** Host's ruling, or null if not judged yet. */
  correct: boolean | null;
}

export interface FinalView {
  topic: string;
  /** Shown from the finalClue phase on. */
  question: string | null;
  /** Shown to the host always; to everyone at game over. */
  answer: string | null;
  deadline: number | null;
  expired: boolean;
  teams: FinalTeamView[];
}

export interface CluesSummary {
  title: string;
  rounds: { name: string; columns: number; clues: number }[];
  finalTopic: string;
  /** Clues skipped because their question or answer is empty, e.g. "Round 2 · Wordplay, row 2". */
  skipped: string[];
}

export interface GameView {
  phase: Phase;
  settings: GameSettings;
  /** Host only: what was uploaded. */
  clues: CluesSummary | null;
  /** True once a clue file is loaded (everyone gets this). */
  cluesLoaded: boolean;
  round: { index: number; name: string; total: number } | null;
  board: BoardColumnView[] | null;
  /** Score per team id; missing = 0. */
  scores: Record<string, number>;
  pickingTeamId: string | null;
  current: CurrentClueView | null;
  final: FinalView | null;
  /** Bumps every time the display should play a sound. */
  sound: { seq: number; kind: SoundKind };
  /** Server clock when this view was built, so clients can correct countdowns. */
  serverNow: number;
  /** Value the host's +/− buttons use right now. */
  adjustAmount: number;
}

export type SoundKind = "none" | "buzz" | "timeUp" | "correct" | "wrong";
