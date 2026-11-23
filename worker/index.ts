import { routePartykitRequest, Server } from "partyserver";
import type { Connection, WSMessage } from "partyserver";

/**
 * SMOKE TEST VERSION of the room server.
 *
 * One instance of this class exists per room code. Right now it only
 * relays chat messages so you can check that tabs and phones can talk
 * to each other. The real lobby and game logic replaces this later.
 */
export class Room extends Server<Env> {
  // Hibernation lets Cloudflare unload an idle room from memory without
  // dropping its connections, so idle rooms don't use free-plan time.
  static options = { hibernate: true };

  onConnect(connection: Connection) {
    // Tell the newcomer how many people are here, and tell everyone else
    // that someone joined.
    const count = [...this.getConnections()].length;
    connection.send(`You joined room ${this.name}. ${count} connected.`);
    this.broadcast(`Someone joined. ${count} connected.`, [connection.id]);
  }

  onMessage(connection: Connection, message: WSMessage) {
    // Relay the message to everyone except the sender.
    this.broadcast(`${connection.id.slice(0, 4)}: ${String(message)}`, [connection.id]);
  }

  onClose() {
    const count = [...this.getConnections()].length;
    this.broadcast(`Someone left. ${count} connected.`);
  }
}

export default {
  async fetch(request, env) {
    // WebSocket connections to /parties/room/<CODE> go to that room's Room.
    const partyResponse = await routePartykitRequest(request, env);
    if (partyResponse) return partyResponse;

    const url = new URL(request.url);

    // Plain HTTP endpoints live under /api/ (the "create room" request goes here later).
    if (url.pathname.startsWith("/api/")) {
      return Response.json({ ok: true });
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
