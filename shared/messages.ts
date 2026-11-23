/**
 * Every message that travels over the WebSocket, both directions.
 *
 * Client → server messages are described with Zod, because the server
 * must CHECK them (never trust what a browser sends). Server → client
 * messages are plain types, because the browser trusts the server.
 */
import { z } from "zod";
import { NAME_MAX, TEAM_NAME_MAX } from "./types.ts";
import type { LobbyView } from "./types.ts";

// ---------- Client → server ----------

const personName = z.string().trim().min(1).max(NAME_MAX);
const teamName = z.string().trim().min(1).max(TEAM_NAME_MAX);

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

  // Cut for Thursday (add back later): deleteTeam, movePlayer, resetRole.
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
  | "NOT_ALLOWED"; // right message, wrong moment (e.g. pickTeam before choosing player)

export type ServerMessage =
  /** Sent only to you, after join/rejoin. Save code + key to localStorage. */
  | { type: "welcome"; key: string; id: string }
  /** Sent to everyone after any change. */
  | { type: "lobby"; lobby: LobbyView }
  /** Sent only to you when something you asked for was refused. */
  | { type: "error"; code: ErrorCode; message: string };

/** Small helper so both sides stringify the same way. */
export function encode(message: ClientMessage | ServerMessage): string {
  return JSON.stringify(message);
}

export type ExtractedMessage<T extends ClientMessage["type"]> = Extract<ClientMessage, {type: T}> 
