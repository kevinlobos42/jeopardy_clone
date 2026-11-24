import { getServerByName, routePartykitRequest, Server } from "partyserver";
import type { Connection, WSMessage } from "partyserver";
import {
  emptyRoomState,
  type RoomState,
  type ConnectionData,
  type Person,
  type Team,
} from "./roomState.ts";
import {
  encode,
  parseClientMessage,
  type ErrorCode,
  type ExtractedMessage,
  type ServerMessage,
} from "../shared/messages.ts";
import { nameKey, type CreateRoomResponse, type LobbyView, type TeamView } from "../shared/types.ts";
import { generateRoomCode } from "../shared/roomCode.ts";

/**
 * Holds lobby state and handles messages
 */

const STATE_KEY = "state";

export class Room extends Server<Env> {
  // Hibernation lets Cloudflare unload an idle room from memory without
  // dropping its connections, so idle rooms don't use free-plan time.
  static options = { hibernate: true };
  state: RoomState = emptyRoomState();

  async onMessage(connection: Connection<ConnectionData>, message: WSMessage) {
    const result = parseClientMessage(String(message));

    if (result == null) {
      this.sendError(
        connection,
        "BAD_MESSAGE",
        "The client message was not as expected",
      );
      return;
    }

    switch (result.type) {
      case "join":
        await this.join(connection, result);
        break;
      case "chooseRole":
        await this.chooseRole(connection, result);
        break;
      case "createTeam":
        await this.createTeam(connection, result);
        break;
      case "pickTeam":
        await this.pickTeam(connection, result);
        break;
      case "rejoin":
        this.rejoin(connection, result);
        break;
    }
  }

  send(connection: Connection, message: ServerMessage) {
    const encoded: string = encode(message);
    connection.send(encoded);
  }

  sendError(connection: Connection, code: ErrorCode, message: string) {
    const serverMessage: ServerMessage = {
      type: "error",
      code,
      message,
    };
    this.send(connection, serverMessage);
  }

  async join(
    connection: Connection<ConnectionData>,
    message: ExtractedMessage<"join">,
  ) {
    if(!this.state.claimed){
      this.sendError(connection, "ROOM_NOT_FOUND", "No room with that code")
      return
    }

    if (this.whoIs(connection)) {
      this.sendError(connection, "NOT_ALLOWED", "You've already joined");
      return;
    }
    for (const person of Object.values(this.state.people)) {
      if (nameKey(person.name) == nameKey(message.name)) {
        this.sendError(connection, "NAME_TAKEN", "This name is already taken");
        return;
      }
    }
    const person: Person = {
      id: crypto.randomUUID(),
      key: crypto.randomUUID(),
      name: message.name,
      role: null,
      teamId: null,
    };
    this.state.people[person.id] = person;
    connection.setState({ personId: person.id }); // Help
    await this.save();
    this.send(connection, { type: "welcome", id: person.id, key: person.key });
    this.sendLobbyToAll();
  }

  async chooseRole(
    connection: Connection<ConnectionData>,
    message: ExtractedMessage<"chooseRole">,
  ) {
    const person: Person | null = this.whoIs(connection);
    if (!person) {
      this.sendError(connection, "NOT_ALLOWED", "Join first");
      return;
    }
    if (person.role !== null) {
      this.sendError(connection, "ROLE_ALREADY_CHOSEN", "Role already chosen");
      return;
    }

    person.role = message.role;

    await this.save();

    this.sendLobbyToAll();
  }

  async createTeam(
    connection: Connection<ConnectionData>,
    message: ExtractedMessage<"createTeam">,
  ) {
    const person: Person | null = this.whoIs(connection);
    if (!person) {
      this.sendError(connection, "NOT_ALLOWED", "Join first");
      return;
    }
    if (person.role !== "host" && person.role !== "player") {
      this.sendError(
        connection,
        "NOT_ALLOWED",
        "Only hosts and players can create teams",
      );
      return;
    }
    if (person.teamId !== null) {
      this.sendError(
        connection,
        "ALREADY_ON_TEAM",
        "You can't create a team while you are in another one",
      );
      return;
    }
    for (const team of Object.values(this.state.teams)) {
      if (nameKey(team.name) === nameKey(message.name)) {
        this.sendError(
          connection,
          "TEAM_NAME_TAKEN",
          "This team name is already taken",
        );
        return;
      }
    }

    // create team
    const team: Team = {
      id: crypto.randomUUID(),
      name: message.name,
    };
    this.state.teams[team.id] = team;
    if (person.role === "player") {
      person.teamId = team.id;
    }
    await this.save();
    this.sendLobbyToAll();
  }

  async pickTeam(
    connection: Connection<ConnectionData>,
    message: ExtractedMessage<"pickTeam">,
  ) {
    const person: Person | null = this.whoIs(connection);
    if (!person) {
      this.sendError(connection, "NOT_ALLOWED", "Join first");
      return;
    }
    if (person.role !== "player") {
      this.sendError(connection, "NOT_ALLOWED", "Only players can join teams");
      return;
    }
    if (person.teamId !== null) {
      this.sendError(
        connection,
        "ALREADY_ON_TEAM",
        "You can't join a team while you are in another one",
      );
      return;
    }
    const team: Team | undefined = this.state.teams[message.teamId];
    if (team === undefined) {
      this.sendError(connection, "TEAM_NOT_FOUND", "This team does not exist");
      return;
    }

    person.teamId = message.teamId;
    await this.save();
    this.sendLobbyToAll();
  }

  rejoin(
    connection: Connection<ConnectionData>,
    message: ExtractedMessage<"rejoin">,
  ) {
    if (this.whoIs(connection)) {
      this.sendError(connection, "NOT_ALLOWED", "Already joined");
      return;
    }
    let person: Person | null = null;
    for (const p of Object.values(this.state.people)) {
      if (p.key === message.key) {
        person = p;
        break;
      }
    }

    if (person === null) {
      this.sendError(connection, "BAD_KEY", "No one found using key");
      return;
    }

    connection.setState({ personId: person.id });
    this.send(connection, { type: "welcome", id: person.id, key: person.key });
    this.sendLobbyToAll();
  }

  sendLobbyToAll() {
    const connections = this.getConnections<ConnectionData>()
    for(const c of connections){
      if(!c.state?.personId) continue
      const lobbyView = this.buildLobbyView(c.state.personId)
      if(lobbyView == null) continue
      this.send(c, {type: "lobby", lobby: lobbyView})
    }
  }

  onClose() {
    this.sendLobbyToAll()
  }

  async onStart(): Promise<void> {
    this.state =
      (await this.ctx.storage.get<RoomState>(STATE_KEY)) ?? emptyRoomState();
  }

  async save(): Promise<void> {
    await this.ctx.storage.put(STATE_KEY, this.state);
  }

  whoIs(connection: Connection<ConnectionData>): Person | null {
    const people = this.state.people;
    return people[connection.state?.personId ?? ""] ?? null;
  }

  isConnected(personId: string): boolean {
    const connections = this.getConnections<ConnectionData>();
    for (const connection of connections) {
      if (connection.state?.personId === personId) {
        return true;
      }
    }
    return false;
  }

  buildLobbyView(personId: string): LobbyView | null {
    const me: Person | undefined = this.state.people[personId];

    if(me === undefined){
      return null
    }

    const teams: TeamView[] = [];
    for (const t of Object.values(this.state.teams)) {
      const members = Object.values(this.state.people)
        .filter((p) => p.teamId === t.id)
        .map((p) => p.id);
      teams.push({
        id: t.id,
        name: t.name,
        memberIds: members,
      });
    }

    const lobbyView: LobbyView = {
      code: this.name,
      hostConnected: this.state.hostId
        ? this.isConnected(this.state.hostId)
        : false,
      teams: teams,
      players: Object.values(this.state.people)
        .filter((p) => p.role === "player")
        .map((p) => ({
          id: p.id,
          name: p.name,
          teamId: p.teamId,
          connected: this.isConnected(p.id),
        })),
      displayCount: Object.values(this.state.people).filter(
        (p) => p.role === "display",
      ).length,
      you: {
        id: me.id,
        role: me.role,
        teamId: me.teamId,
      },
    };

    return lobbyView;
  }

  async claim(): Promise<string | null> {
    if (this.state.claimed) return null;

    const host: Person = {
      id: crypto.randomUUID(),
      key: crypto.randomUUID(),
      name: "Host",
      role: "host",
      teamId: null,
    };
    this.state.people[host.id] = host;
    this.state.claimed = true;
    this.state.hostId = host.id;
    await this.save();
    return host.key;
  }

}

export default {
  async fetch(request, env) {
    // WebSocket connections to /parties/room/<CODE> go to that room's Room.
    const partyResponse = await routePartykitRequest(request, env);
    if (partyResponse) return partyResponse;

    const url = new URL(request.url);

        // Create a room: pick a code, ask that room to claim itself, retry if taken.
    if (url.pathname === "/api/rooms" && request.method === "POST") {
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateRoomCode();
        const room = await getServerByName(env.Room, code);
        const hostKey = await room.claim();
        if (hostKey) {
          const body: CreateRoomResponse = { code, hostKey };
          return Response.json(body);
        }
      }
      return Response.json({ error: "Could not create a room, try again" }, { status: 500 });
    }

    // Plain HTTP endpoints live under /api/ (the "create room" request goes here later).
    if (url.pathname.startsWith("/api/")) {
      return Response.json({ ok: true });
    }

    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
