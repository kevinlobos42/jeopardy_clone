/**
 * Every message that travels over the WebSocket, both directions.
 *
 * Client → server messages are described with Zod, because the server
 * must CHECK them (never trust what a browser sends). Server → client
 * messages are plain types, because the browser trusts the server.
 */
import { z } from "zod";
import { NAME_MAX, TEAM_NAME_MAX } from "./types.ts";
import { FINAL_WAGER_MAX, SETTING_LIMITS } from "./game.ts";
import type { LobbyView } from "./types.ts";

// ---------- Client → server ----------

const personName = z.string().trim().min(1).max(NAME_MAX);
const teamName = z.string().trim().min(1).max(TEAM_NAME_MAX);
const seconds = (limits: { min: number; max: number }) => z.number().int().min(limits.min).max(limits.max);

export const ClientMessageSchema = z.discriminatedUnion("type", [
  /** Anyone: "I've been here before, here's my key." The host always enters this way. */
  z.object({ type: z.literal("rejoin"), key: z.string().min(1) }),
  /** New person: "I'm joining with this name." */
  z.object({ type: z.literal("join"), name: personName }),
  /** Joined, no role yet: "I'll be a player / a display." */
  z.object({ type: z.literal("chooseRole"), role: z.enum(["player", "display"]) }),
  /** Unassigned player: "Put me on this team." */
  z.object({ type: z.literal("pickTeam"), teamId: z.string().min(1) }),
  /** Unassigned player: make a team and join it. Host: make an empty team. */
  z.object({ type: z.literal("createTeam"), name: teamName }),

  // ----- Game (host) -----
  /** Host, lobby: upload the clue file as text. */
  z.object({ type: z.literal("loadClues"), text: z.string().min(1).max(500_000) }),
  /** Host: change timer lengths. */
  z.object({
    type: z.literal("updateSettings"),
    settings: z.object({
      buzzSeconds: seconds(SETTING_LIMITS.buzzSeconds),
      answerSeconds: seconds(SETTING_LIMITS.answerSeconds),
      finalSeconds: seconds(SETTING_LIMITS.finalSeconds),
    }),
  }),
  /** Host, lobby: start the game. */
  z.object({ type: z.literal("startGame") }),
  /** Host, board: open a clue on the current round's board. */
  z.object({ type: z.literal("pickClue"), column: z.number().int().min(0), row: z.number().int().min(0) }),
  /** Host, answering: rule on the team that buzzed. */
  z.object({ type: z.literal("judge"), correct: z.boolean() }),
  /** Host, clue or answering: stop and show the answer. */
  z.object({ type: z.literal("reveal") }),
  /** Host, reveal or roundIntro: move on. */
  z.object({ type: z.literal("continue") }),
  /** Host, board: skip the rest of this round. */
  z.object({ type: z.literal("endRound") }),
  /** Host, any time after start: manual score fix. */
  z.object({ type: z.literal("adjustScore"), teamId: z.string().min(1), amount: z.number().int().min(-100_000).max(100_000) }),
  /** Host, finalWager: show the final clue and start its timer. */
  z.object({ type: z.literal("showFinalClue") }),
  /** Host, finalClue: stop answers and go to the reveal. */
  z.object({ type: z.literal("closeFinal") }),
  /** Host, finalReveal: rule on one team's final answer. */
  z.object({ type: z.literal("judgeFinal"), teamId: z.string().min(1), correct: z.boolean() }),
  /** Host, finalReveal: show final standings. */
  z.object({ type: z.literal("finishGame") }),

  // ----- Game (players) -----
  /** Player on a team, clue phase: buzz in. */
  z.object({ type: z.literal("buzz") }),
  /** Player on a team, finalWager: set the team's wager. */
  z.object({ type: z.literal("finalWager"), amount: z.number().int().min(0).max(FINAL_WAGER_MAX) }),
  /** Player on a team, finalClue: set the team's answer. */
  z.object({ type: z.literal("finalAnswer"), text: z.string().max(200) }),

  // Cut for Thursday (add back later): deleteTeam, movePlayer, resetRole, Daily Double.
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

/**
 * Turn raw text from the socket into a checked message, or null if it's
 * not valid JSON or doesn't match any message shape.
 */
export function parseClientMessage(raw: string): ClientMessage | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = ClientMessageSchema.safeParse(data);
  return result.success ? result.data : null;
}

// ---------- Server → client ----------

export type ErrorCode =
  | "BAD_MESSAGE" // couldn't understand what was sent
  | "ROOM_NOT_FOUND"
  | "BAD_KEY"
  | "NOT_HOST"
  | "NAME_TAKEN"
  | "TEAM_NAME_TAKEN"
  | "INVALID_NAME"
  | "TEAM_NOT_FOUND"
  | "ALREADY_ON_TEAM"
  | "ROLE_ALREADY_CHOSEN"
  | "NOT_ALLOWED" // right message, wrong moment (e.g. pickTeam before choosing player)
  | "WRONG_PHASE" // the game isn't at the stage where this works
  | "BAD_CLUE_FILE"
  | "CLUE_NOT_AVAILABLE"
  | "NO_TEAMS";

export type ServerMessage =
  /** Sent only to you, after join/rejoin. Save code + key to localStorage. */
  | { type: "welcome"; key: string; id: string }
  /** Sent to everyone after any change. */
  | { type: "lobby"; lobby: LobbyView }
  /** Sent only to you when something you asked for was refused. */
  | { type: "error"; code: ErrorCode; message: string }
  /** Sent only to the host when an uploaded clue file has problems. */
  | { type: "clueFileErrors"; errors: string[] };

/** Small helper so both sides stringify the same way. */
export function encode(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

export type ExtractedMessage<T extends ClientMessage["type"]> = Extract<ClientMessage, {type: T}> 
