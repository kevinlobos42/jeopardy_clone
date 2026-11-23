import { routePartykitRequest, Server } from "partyserver";
import type { Connection, WSMessage } from "partyserver";
import { emptyRoomState, type RoomState, type ConnectionData, type Person, type Team } from "./roomState.ts";
import { encode, parseClientMessage, type ErrorCode, type ExtractedMessage, type ServerMessage } from "../shared/messages.ts";
import { nameKey } from "../shared/types.ts";

/**
 * SMOKE TEST VERSION of the room server.
 */

const STATE_KEY = "state"

export class Room extends Server<Env> {
  // Hibernation lets Cloudflare unload an idle room from memory without
  // dropping its connections, so idle rooms don't use free-plan time.
  static options = { hibernate: true };
  state: RoomState = emptyRoomState() 

  onConnect(connection: Connection) {
    // Tell the newcomer how many people are here, and tell everyone else
    // that someone joined.
    const count = [...this.getConnections()].length;
    connection.send(`You joined room ${this.name}. ${count} connected.`);
    this.broadcast(`Someone joined. ${count} connected.`, [connection.id]);
  }

  async onMessage(connection: Connection<ConnectionData>, message: WSMessage) {
    const result = parseClientMessage(String(message))

     if(result == null){
        this.sendError(connection, "BAD_MESSAGE", "The client message was not as expected")
        return
     }

     switch(result.type){
      case "join": 
        await this.join(connection, result)
        break;
      case "chooseRole":
        await this.chooseRole(connection, result)
        break;
      case "createTeam":
        await this.createTeam(connection, result)
        break;
      case "pickTeam":
        await this.pickTeam(connection, result)
        break;
      case "rejoin":
        this.rejoin(connection, result)
        break;
     }
  }
  

  send(connection: Connection, message: ServerMessage) {
    const encoded: string = encode(message)
    connection.send(encoded)
  }

  sendError(connection: Connection, code: ErrorCode, message: string){
    const serverMessage: ServerMessage = {
          type: "error",
          code,
          message
    }
    this.send(connection, serverMessage)
  }

  async join(connection: Connection<ConnectionData>, message: ExtractedMessage<"join">){
    // if(!this.state.claimed){
    //   this.sendError(connection, "ROOM_NOT_FOUND", "Room is claimed")
    //   return
    // } INTEGRATE LATER

    if(this.whoIs(connection)){
      this.sendError(connection, "NOT_ALLOWED", "You've already joined")
      return
    }
    for(const person of Object.values(this.state.people)){
      if(nameKey(person.name) == nameKey(message.name)){
        this.sendError(connection, "NAME_TAKEN", "This name is already taken")
        return
      }
    }
    const person: Person = {
      id: crypto.randomUUID(),
      key: crypto.randomUUID(),
      name: message.name,
      role: null,
      teamId: null
    }
    this.state.people[person.id]= person
    connection.setState({personId: person.id}) // Help
    await this.save()
    this.send(connection, {type: "welcome", id: person.id, key: person.key})
    this.sendLobbyToAll()
  }

  async chooseRole(connection: Connection<ConnectionData>, message: ExtractedMessage<"chooseRole">){
    const person:Person | null = this.whoIs(connection)
    if(!person){
      this.sendError(connection, "NOT_ALLOWED", "Join first")
      return
    }
    if (person.role !== null){
      this.sendError(connection, "ROLE_ALREADY_CHOSEN", "Role already chosen")
      return
    }

    person.role = message.role

    await this.save()

    this.sendLobbyToAll()

  }

  async createTeam(connection: Connection<ConnectionData>, message: ExtractedMessage<"createTeam">){
    const person:Person | null = this.whoIs(connection)
    if(!person){
      this.sendError(connection, "NOT_ALLOWED", "Join first")
      return
    }
    if(person.role !== "host" && person.role !== "player"){
      this.sendError(connection, "NOT_ALLOWED", "Only hosts and players can create teams")
      return
    }
    if(person.teamId !== null){
      this.sendError(connection, "ALREADY_ON_TEAM", "You can't create a team while you are in another one")
      return
    }
    for (const team of Object.values(this.state.teams)){
      if(nameKey(team.name) === nameKey(message.name)){
        this.sendError(connection, "TEAM_NAME_TAKEN", "This team name is already taken")
        return     
      }
    }

    // create team
    const team: Team = {
      id: crypto.randomUUID(),
      name: message.name
    }
    this.state.teams[team.id] = team
    if(person.role === "player"){
      person.teamId = team.id
    }
    await this.save()
    this.sendLobbyToAll()
  }

  async pickTeam(connection: Connection<ConnectionData>, message: ExtractedMessage<"pickTeam">){
    const person:Person | null = this.whoIs(connection)
    if(!person){
      this.sendError(connection, "NOT_ALLOWED", "Join first")
      return
    }
    if(person.role !== "player"){
      this.sendError(connection, "NOT_ALLOWED", "Only players can join teams")
      return
    }
    if(person.teamId !== null){
      this.sendError(connection, "ALREADY_ON_TEAM", "You can't join a team while you are in another one")
      return
    }
    const team: Team | undefined = this.state.teams[message.teamId]
    if(team === undefined){
      this.sendError(connection, "TEAM_NOT_FOUND", "This team does not exist")
      return
    }

    person.teamId = message.teamId
    await this.save()
    this.sendLobbyToAll()

  }

  rejoin(connection: Connection<ConnectionData>, message: ExtractedMessage<"rejoin">){
    if(this.whoIs(connection)){
      this.sendError(connection, "NOT_ALLOWED", "Already joined")
      return
    }
    let person:Person | null = null
    for(const p of Object.values(this.state.people)){
      if(p.key === message.key){
        person = p
        break;
      } 
    }

    if(person === null){
      this.sendError(connection, "BAD_KEY", "No one found using key")
      return
    }

    connection.setState({personId: person.id})
    this.send(connection, {type: "welcome", id: person.id, key: person.key})
    this.sendLobbyToAll()
  }

  sendLobbyToAll(){
    this.broadcast(JSON.stringify(this.state.teams))
  }
  
  onClose() {
    const count = [...this.getConnections()].length;
    this.broadcast(`Someone left. ${count} connected.`);
  }

  async onStart(): Promise<void>  {
      this.state = await this.ctx.storage.get<RoomState>(STATE_KEY) ?? emptyRoomState()
  }

  async save(): Promise<void>{
    await this.ctx.storage.put(STATE_KEY, this.state)
  }

  whoIs(connection: Connection<ConnectionData>): Person | null {
    const people = this.state.people
    return people[connection.state?.personId ?? ""] ?? null
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
