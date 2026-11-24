/**
 * Game helpers that only read state. No sending, no saving.
 * The Room class (worker/index.ts) calls these from its handlers.
 */
import { isPlayable, type Clue, type ClueFile } from "../shared/clueFile.ts";
import {
  clueKey,
  type BoardColumnView,
  type CluePosition,
  type CluesSummary,
  type CurrentClueView,
  type FinalView,
  type GameView,
} from "../shared/game.ts";
import type { GameState, Person, RoomState } from "./roomState.ts";

/** The clue at a position, or null if the position doesn't exist. */
export function clueAt(file: ClueFile | null, p: CluePosition): Clue | null {
  return file?.boards[p.round]?.columns[p.column]?.questions[p.row] ?? null;
}

export function topicAt(file: ClueFile | null, p: CluePosition): string {
  return file?.boards[p.round]?.columns[p.column]?.topic ?? "";
}

/** Can this clue be opened right now? (exists, not blank, not used) */
export function isOpen(game: GameState, p: CluePosition): boolean {
  const clue = clueAt(game.clues, p);
  return clue !== null && isPlayable(clue) && !game.usedClues.includes(clueKey(p));
}

/** Does the current round's board still have anything to play? */
export function roundHasOpenClues(game: GameState): boolean {
  const board = game.clues?.boards[game.roundIndex];
  if (!board) return false;
  return board.columns.some((col, column) =>
    col.questions.some((_, row) => isOpen(game, { round: game.roundIndex, column, row })),
  );
}

export function scoreOf(game: GameState, teamId: string): number {
  return game.scores[teamId] ?? 0;
}

/** Team with the lowest score (ties: first created). Used to pick who starts a new round. */
export function lowestScoringTeam(state: RoomState): string | null {
  const teams = Object.values(state.teams);
  if (teams.length === 0) return null;
  let best = teams[0];
  for (const t of teams) if (scoreOf(state.game, t.id) < scoreOf(state.game, best.id)) best = t;
  return best.id;
}

/** Short description of the uploaded file for the host's setup screen. */
export function summarizeClues(file: ClueFile): CluesSummary {
  const skipped: string[] = [];
  const rounds = file.boards.map((board) => {
    let clues = 0;
    board.columns.forEach((col) =>
      col.questions.forEach((q, row) => {
        if (isPlayable(q)) clues++;
        else skipped.push(`${board.name} · ${col.topic}, row ${row + 1}`);
      }),
    );
    return { name: board.name, columns: board.columns.length, clues };
  });
  return { title: file.title, rounds, finalTopic: file.final.topic, skipped };
}

/**
 * The earliest timer that still needs to "go off" (play a sound / lock),
 * or null. The Room sets one Cloudflare alarm for this moment.
 */
export function nextDeadline(game: GameState): number | null {
  const times: number[] = [];
  const c = game.current;
  if (game.phase === "clue" && c?.buzzDeadline && !c.buzzExpired) times.push(c.buzzDeadline);
  if (game.phase === "answering" && c?.answerDeadline && !c.answerExpired) times.push(c.answerDeadline);
  if (game.phase === "finalClue" && game.final.deadline && !game.final.expired) times.push(game.final.deadline);
  return times.length ? Math.min(...times) : null;
}

// ---------- Views: what each person is allowed to see ----------

export function buildGameView(state: RoomState, viewer: Person, now: number): GameView {
  const game = state.game;
  const file = game.clues;
  const isHost = viewer.role === "host";
  const round = file?.boards[game.roundIndex];

  let board: BoardColumnView[] | null = null;
  if (round && game.phase !== "lobby") {
    board = round.columns.map((col, column) => ({
      topic: col.topic,
      cells: col.questions.map((q, row) => {
        const used = game.usedClues.includes(clueKey({ round: game.roundIndex, column, row }));
        return { row, value: q.value, state: !isPlayable(q) ? "missing" : used ? "used" : "open" };
      }),
    }));
  }

  return {
    phase: game.phase,
    settings: game.settings,
    clues: isHost && file ? summarizeClues(file) : null,
    cluesLoaded: file !== null,
    round: file && round ? { index: game.roundIndex, name: round.name, total: file.boards.length } : null,
    board,
    scores: game.scores,
    pickingTeamId: game.pickingTeamId,
    current: buildCurrentView(state, isHost),
    final: buildFinalView(state, viewer),
    sound: { seq: game.soundSeq, kind: game.soundKind },
    serverNow: now,
    adjustAmount: game.current ? (clueAt(file, game.current.position)?.value ?? game.lastClueValue) : game.lastClueValue,
  };
}

function buildCurrentView(state: RoomState, isHost: boolean): CurrentClueView | null {
  const game = state.game;
  const c = game.current;
  if (!c) return null;
  const clue = clueAt(game.clues, c.position);
  if (!clue) return null;
  const key = clueKey(c.position);
  return {
    position: c.position,
    topic: topicAt(game.clues, c.position),
    value: clue.value,
    question: clue.question,
    answer: isHost || game.phase === "reveal" ? clue.answer : null,
    buzzedTeamId: c.buzzedTeamId,
    buzzedByName: c.buzzedPersonId ? (state.people[c.buzzedPersonId]?.name ?? null) : null,
    lockedOutTeamIds: c.lockedOutTeamIds,
    buzzDeadline: c.buzzDeadline,
    answerDeadline: c.answerDeadline,
    buzzExpired: c.buzzExpired,
    answerExpired: c.answerExpired,
    results: game.history
      .filter((r) => r.clueKey === key)
      .map((r) => ({ teamId: r.teamId, correct: r.correct, points: r.points })),
  };
}

const FINAL_PHASES = new Set(["finalWager", "finalClue", "finalReveal", "gameOver"]);

function buildFinalView(state: RoomState, viewer: Person): FinalView | null {
  const game = state.game;
  if (!game.clues || !FINAL_PHASES.has(game.phase)) return null;
  const isHost = viewer.role === "host";
  const f = game.final;
  return {
    topic: game.clues.final.topic,
    question: game.phase === "finalWager" ? null : game.clues.final.question,
    answer: isHost || game.phase === "gameOver" ? game.clues.final.answer : null,
    deadline: f.deadline,
    expired: f.expired,
    teams: Object.values(state.teams).map((team) => {
      const ownTeam = viewer.teamId === team.id;
      const judged = team.id in f.judged;
      const canSee = isHost || ownTeam || judged;
      return {
        teamId: team.id,
        wagered: team.id in f.wagers,
        wager: canSee ? (f.wagers[team.id] ?? null) : null,
        answered: (f.answers[team.id] ?? "").trim() !== "",
        answer: canSee ? (f.answers[team.id] ?? null) : null,
        correct: judged ? f.judged[team.id] : null,
      };
    }),
  };
}
