/**
 * Shapes that both the browser and the server share.
 */
import type { GameView } from "./game.ts";

export type Role = "host" | "player" | "display";

/** The roles someone can pick for themselves after joining. */
export type ChosenRole = Exclude<Role, "host">;

export interface TeamView {
  id: string;
  name: string;
  /** One of TEAM_COLORS. Unique within the room. */
  color: string;
  memberIds: string[];
}

/** Colors a team can pick when it's created. No two teams in a room share one. */
export const TEAM_COLORS = ["#5ec8f2", "#c79bff", "#7ee0a1", "#ff8a7a", "#f5b83d", "#8fa8ff", "#ffd27a", "#66e0d0"] as const;
export type TeamColor = (typeof TEAM_COLORS)[number];

export interface PlayerView {
  id: string;
  name: string;
  /** null = joined as a player but hasn't picked a team yet. */
  teamId: string | null;
  connected: boolean;
}

/** Who the receiving client is. Each client gets its own copy. */
export interface YouView {
  id: string;
  /** null = joined but hasn't chosen player or display yet. */
  role: Role | null;
  teamId: string | null;
}

/** Everything a client needs. Sent in full after every change. */
export interface LobbyView {
  code: string;
  hostConnected: boolean;
  teams: TeamView[];
  players: PlayerView[];
  displayCount: number;
  you: YouView;
  /** Everything about the game itself (phase, board, scores, current clue...). */
  game: GameView;
}

/** Response from the "create room" HTTP request (POST /api/rooms). */
export interface CreateRoomResponse {
  code: string;
  hostKey: string;
}

/** Limits for names typed by people. */
export const NAME_MAX = 20;
export const TEAM_NAME_MAX = 24;

/** How names are compared for "already taken": trimmed, case-insensitive. */
export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Where the browser remembers who it is, for refreshes. */
export const STORAGE_KEY = "jeopardy-clone:session";
export interface StoredSession {
  code: string;
  key: string;
}
