/**
 * Game shapes both sides share: phases, settings, clue positions, and the
 * GameView each client receives (inside the lobby message).
 */

/** Every situation the game can be in, in the order a game usually goes. */
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

/** Teams with less than this (but not negative) can still wager up to it. */
export const FINAL_WAGER_FLOOR = 1000;

/**
 * The most a team can wager in the final round:
 * - negative score: enough to get back to 0 (score -400 → up to 400)
 * - 0 to 999: up to 1,000
 * - 1,000 or more: up to their whole score
 */
export function maxFinalWager(score: number): number {
  return score < 0 ? -score : Math.max(score, FINAL_WAGER_FLOOR);
}

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

/** A clue's image / audio / video (same shape as in the clue file). */
export interface MediaView {
  type: "image" | "audio" | "video";
  src: string;
}

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
  questionMedia: MediaView | null;
  /** Same visibility as `answer`. */
  answerMedia: MediaView | null;
  /** True while the clue's audio/video plays on the display; buzzers open when it ends. */
  waitingForMedia: boolean;
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
  /** The most this team may wager (from its current score). */
  maxWager: number;
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
  questionMedia: MediaView | null;
  /** Same visibility as `answer`. */
  answerMedia: MediaView | null;
  /** True while the final clue's audio/video plays; the timer starts when it ends. */
  waitingForMedia: boolean;
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
  /** Every media file in the clue file, so the host's phone can check they load. */
  media: { where: string; type: MediaView["type"]; src: string }[];
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
