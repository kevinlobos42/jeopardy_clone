import { getServerByName, routePartykitRequest, Server } from "partyserver";
import type { Connection, WSMessage } from "partyserver";
import {
  emptyFinalState,
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
import { nameKey, TEAM_COLORS, type CreateRoomResponse, type LobbyView, type TeamView } from "../shared/types.ts";
import { generateRoomCode } from "../shared/roomCode.ts";
import { isTimedMedia, parseClueFile } from "../shared/clueFile.ts";
import { clueKey, maxFinalWager, type Phase, type SoundKind } from "../shared/game.ts";
import { buildGameView, clueAt, isOpen, lowestScoringTeam, nextDeadline, roundHasOpenClues } from "./game.ts";

/**
 * One instance per room code. Holds the room's state (lobby + game),
 * handles every message, runs the timers, and sends each person their view.
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

      // Game: host
      case "loadClues":
        await this.loadClues(connection, result);
        break;
      case "updateSettings":
        await this.updateSettings(connection, result);
        break;
      case "startGame":
        await this.startGame(connection);
        break;
      case "pickClue":
        await this.pickClue(connection, result);
        break;
      case "judge":
        await this.judge(connection, result);
        break;
      case "reveal":
        await this.reveal(connection);
        break;
      case "continue":
        await this.continueGame(connection);
        break;
      case "endRound":
        await this.endRound(connection);
        break;
      case "adjustScore":
        await this.adjustScore(connection, result);
        break;
      case "showFinalClue":
        await this.showFinalClue(connection);
        break;
      case "closeFinal":
        await this.closeFinal(connection);
        break;
      case "judgeFinal":
        await this.judgeFinal(connection, result);
        break;
      case "finishGame":
        await this.finishGame(connection);
        break;
      case "mediaFinished":
        await this.mediaFinished(connection);
        break;

      // Game: players
      case "buzz":
        await this.buzz(connection);
        break;
      case "finalWager":
        await this.finalWager(connection, result);
        break;
      case "finalAnswer":
        await this.finalAnswer(connection, result);
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
      if (team.color === message.color) {
        this.sendError(
          connection,
          "TEAM_COLOR_TAKEN",
          "Another team already has this color",
        );
        return;
      }
    }

    // create team
    const team: Team = {
      id: crypto.randomUUID(),
      name: message.name,
      color: message.color,
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
    const saved = await this.ctx.storage.get<RoomState>(STATE_KEY);
    const fresh = emptyRoomState();
    // Merge with a fresh state so rooms saved by an older version still load.
    this.state = saved ? { ...fresh, ...saved, game: { ...fresh.game, ...saved.game } } : fresh;
    // Teams saved before colors existed: give each one a color nobody else has.
    const teams = Object.values(this.state.teams);
    for (const team of teams) {
      if (team.color) continue;
      const taken = new Set(teams.map((t) => t.color));
      team.color = TEAM_COLORS.find((c) => !taken.has(c)) ?? TEAM_COLORS[0];
    }
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

  // =====================================================================
  // Game
  // =====================================================================

  /** After any game change: save, set the timer alarm, send everyone their view. */
  async commit(): Promise<void> {
    await this.save();
    await this.scheduleAlarm();
    this.sendLobbyToAll();
  }

  /** Tell the display to play a sound (it plays when the number changes). */
  playSound(kind: SoundKind) {
    this.state.game.soundSeq += 1;
    this.state.game.soundKind = kind;
  }

  /** The sender if they're the host; otherwise sends NOT_HOST and returns null. */
  requireHost(connection: Connection<ConnectionData>): Person | null {
    const person = this.whoIs(connection);
    if (!person || person.role !== "host") {
      this.sendError(connection, "NOT_HOST", "Only the host can do that");
      return null;
    }
    return person;
  }

  /** The sender if they're a player on a team; otherwise sends an error and returns null. */
  requireTeamPlayer(connection: Connection<ConnectionData>): (Person & { teamId: string }) | null {
    const person = this.whoIs(connection);
    if (!person || person.role !== "player" || person.teamId === null) {
      this.sendError(connection, "NOT_ALLOWED", "Join a team first");
      return null;
    }
    return person as Person & { teamId: string };
  }

  /** True if the game is in one of these phases; otherwise sends WRONG_PHASE. */
  requirePhase(connection: Connection, ...phases: Phase[]): boolean {
    if (phases.includes(this.state.game.phase)) return true;
    this.sendError(connection, "WRONG_PHASE", "That can't be done right now");
    return false;
  }

  async loadClues(connection: Connection<ConnectionData>, message: ExtractedMessage<"loadClues">) {
    if (!this.requireHost(connection) || !this.requirePhase(connection, "lobby")) return;
    const result = parseClueFile(message.text);
    if (!result.ok) {
      this.send(connection, { type: "clueFileErrors", errors: result.errors });
      return;
    }
    const game = this.state.game;
    game.clues = result.file;
    game.roundIndex = 0;
    game.usedClues = [];
    await this.commit();
  }

  async updateSettings(connection: Connection<ConnectionData>, message: ExtractedMessage<"updateSettings">) {
    if (!this.requireHost(connection)) return;
    this.state.game.settings = message.settings;
    await this.commit();
  }

  async startGame(connection: Connection<ConnectionData>) {
    if (!this.requireHost(connection) || !this.requirePhase(connection, "lobby")) return;
    const game = this.state.game;
    if (!game.clues) {
      this.sendError(connection, "NOT_ALLOWED", "Upload a clue file first");
      return;
    }
    if (Object.keys(this.state.teams).length === 0) {
      this.sendError(connection, "NO_TEAMS", "Create at least one team first");
      return;
    }
    game.phase = "board";
    game.roundIndex = 0;
    game.usedClues = [];
    game.history = [];
    game.scores = {};
    game.current = null;
    game.final = emptyFinalState();
    game.pickingTeamId = lowestScoringTeam(this.state);
    await this.commit();
  }

  async pickClue(connection: Connection<ConnectionData>, message: ExtractedMessage<"pickClue">) {
    if (!this.requireHost(connection) || !this.requirePhase(connection, "board")) return;
    const game = this.state.game;
    const position = { round: game.roundIndex, column: message.column, row: message.row };
    if (!isOpen(game, position)) {
      this.sendError(connection, "CLUE_NOT_AVAILABLE", "That clue isn't available");
      return;
    }
    // Audio/video clues: buzzers stay closed until the display says it finished playing.
    const waitForMedia = isTimedMedia(clueAt(game.clues, position)?.questionMedia);
    game.current = {
      position,
      buzzedTeamId: null,
      buzzedPersonId: null,
      lockedOutTeamIds: [],
      buzzDeadline: waitForMedia ? null : Date.now() + game.settings.buzzSeconds * 1000,
      answerDeadline: null,
      buzzExpired: false,
      answerExpired: false,
      waitingForMedia: waitForMedia,
    };
    game.lastClueValue = clueAt(game.clues, position)?.value ?? game.lastClueValue;
    game.phase = "clue";
    await this.commit();
  }

  async buzz(connection: Connection<ConnectionData>) {
    const person = this.requireTeamPlayer(connection);
    if (!person || !this.requirePhase(connection, "clue")) return;
    const game = this.state.game;
    const current = game.current;
    const now = Date.now();
    // Every check and change below happens before the first `await`, so two
    // buzzes can't both get through: the first one moves the phase on.
    if (current?.waitingForMedia) {
      this.sendError(connection, "NOT_ALLOWED", "Wait for the clue to finish");
      return;
    }
    if (!current || current.buzzExpired || current.buzzDeadline === null || now >= current.buzzDeadline) {
      this.sendError(connection, "NOT_ALLOWED", "Buzzers are closed");
      return;
    }
    if (current.lockedOutTeamIds.includes(person.teamId)) {
      this.sendError(connection, "NOT_ALLOWED", "Your team already answered this one");
      return;
    }
    current.buzzedTeamId = person.teamId;
    current.buzzedPersonId = person.id;
    current.answerDeadline = now + game.settings.answerSeconds * 1000;
    current.answerExpired = false;
    game.phase = "answering";
    this.playSound("buzz");
    await this.commit();
  }

  async judge(connection: Connection<ConnectionData>, message: ExtractedMessage<"judge">) {
    if (!this.requireHost(connection) || !this.requirePhase(connection, "answering")) return;
    const game = this.state.game;
    const current = game.current;
    if (!current || current.buzzedTeamId === null) return;
    const teamId = current.buzzedTeamId;
    const value = clueAt(game.clues, current.position)?.value ?? 0;
    const points = message.correct ? value : -value;

    game.scores[teamId] = (game.scores[teamId] ?? 0) + points;
    game.history.push({ clueKey: clueKey(current.position), teamId, correct: message.correct, points });

    if (message.correct) {
      game.pickingTeamId = teamId;
      game.usedClues.push(clueKey(current.position));
      game.phase = "reveal";
      this.playSound("correct");
    } else {
      // Lock this team out and reopen buzzers for everyone else with a fresh timer.
      current.lockedOutTeamIds.push(teamId);
      current.buzzedTeamId = null;
      current.buzzedPersonId = null;
      current.answerDeadline = null;
      current.answerExpired = false;
      current.buzzDeadline = Date.now() + game.settings.buzzSeconds * 1000;
      // If every team is locked out, nobody can buzz: close buzzers now.
      const everyoneOut = Object.keys(this.state.teams).every((id) => current.lockedOutTeamIds.includes(id));
      current.buzzExpired = everyoneOut;
      game.phase = "clue";
      this.playSound("wrong");
    }
    await this.commit();
  }

  async reveal(connection: Connection<ConnectionData>) {
    if (!this.requireHost(connection) || !this.requirePhase(connection, "clue", "answering")) return;
    const game = this.state.game;
    if (game.current) game.usedClues.push(clueKey(game.current.position));
    game.phase = "reveal";
    await this.commit();
  }

  /** Where to go once the current board is finished: next round's intro, or the final. */
  advanceAfterRound() {
    const game = this.state.game;
    game.current = null;
    const rounds = game.clues?.boards.length ?? 0;
    if (game.roundIndex + 1 < rounds) {
      game.roundIndex += 1;
      game.pickingTeamId = lowestScoringTeam(this.state);
      game.phase = "roundIntro";
    } else {
      game.final = emptyFinalState();
      game.phase = "finalWager";
    }
  }

  async continueGame(connection: Connection<ConnectionData>) {
    if (!this.requireHost(connection) || !this.requirePhase(connection, "reveal", "roundIntro")) return;
    const game = this.state.game;
    if (game.phase === "roundIntro") {
      game.phase = "board";
    } else {
      game.current = null;
      if (roundHasOpenClues(game)) game.phase = "board";
      else this.advanceAfterRound();
    }
    await this.commit();
  }

  async endRound(connection: Connection<ConnectionData>) {
    if (!this.requireHost(connection) || !this.requirePhase(connection, "board")) return;
    this.advanceAfterRound();
    await this.commit();
  }

  async adjustScore(connection: Connection<ConnectionData>, message: ExtractedMessage<"adjustScore">) {
    if (!this.requireHost(connection)) return;
    const game = this.state.game;
    if (game.phase === "lobby") {
      this.sendError(connection, "WRONG_PHASE", "Start the game first");
      return;
    }
    if (!this.state.teams[message.teamId]) {
      this.sendError(connection, "TEAM_NOT_FOUND", "This team does not exist");
      return;
    }
    game.scores[message.teamId] = (game.scores[message.teamId] ?? 0) + message.amount;
    await this.commit();
  }

  async finalWager(connection: Connection<ConnectionData>, message: ExtractedMessage<"finalWager">) {
    const person = this.requireTeamPlayer(connection);
    if (!person || !this.requirePhase(connection, "finalWager")) return;
    const game = this.state.game;
    const max = maxFinalWager(game.scores[person.teamId] ?? 0);
    if (message.amount > max) {
      this.sendError(connection, "NOT_ALLOWED", `Your team can wager up to ${max.toLocaleString("en-US")}`);
      return;
    }
    game.final.wagers[person.teamId] = message.amount;
    await this.commit();
  }

  async showFinalClue(connection: Connection<ConnectionData>) {
    if (!this.requireHost(connection) || !this.requirePhase(connection, "finalWager")) return;
    const game = this.state.game;
    // Scores may have been adjusted since a team wagered: keep every wager within its limit.
    for (const [teamId, wager] of Object.entries(game.final.wagers)) {
      game.final.wagers[teamId] = Math.min(wager, maxFinalWager(game.scores[teamId] ?? 0));
    }
    // Audio/video final clue: the timer starts when it finishes playing.
    const waitForMedia = isTimedMedia(game.clues?.final.questionMedia);
    game.final.waitingForMedia = waitForMedia;
    game.final.deadline = waitForMedia ? null : Date.now() + game.settings.finalSeconds * 1000;
    game.final.expired = false;
    game.phase = "finalClue";
    await this.commit();
  }

  async finalAnswer(connection: Connection<ConnectionData>, message: ExtractedMessage<"finalAnswer">) {
    const person = this.requireTeamPlayer(connection);
    if (!person || !this.requirePhase(connection, "finalClue")) return;
    const final = this.state.game.final;
    if (final.expired || (final.deadline !== null && Date.now() >= final.deadline)) {
      this.sendError(connection, "NOT_ALLOWED", "Time's up");
      return;
    }
    final.answers[person.teamId] = message.text;
    await this.commit();
  }

  async closeFinal(connection: Connection<ConnectionData>) {
    if (!this.requireHost(connection) || !this.requirePhase(connection, "finalClue")) return;
    this.state.game.final.expired = true;
    this.state.game.phase = "finalReveal";
    await this.commit();
  }

  async judgeFinal(connection: Connection<ConnectionData>, message: ExtractedMessage<"judgeFinal">) {
    if (!this.requireHost(connection) || !this.requirePhase(connection, "finalReveal")) return;
    const game = this.state.game;
    if (!this.state.teams[message.teamId]) {
      this.sendError(connection, "TEAM_NOT_FOUND", "This team does not exist");
      return;
    }
    const wager = game.final.wagers[message.teamId] ?? 0;
    const sign = (correct: boolean) => (correct ? wager : -wager);
    // If the host changes their mind, undo the previous ruling first.
    if (message.teamId in game.final.judged) {
      game.scores[message.teamId] = (game.scores[message.teamId] ?? 0) - sign(game.final.judged[message.teamId]);
    }
    game.final.judged[message.teamId] = message.correct;
    game.scores[message.teamId] = (game.scores[message.teamId] ?? 0) + sign(message.correct);
    this.playSound(message.correct ? "correct" : "wrong");
    await this.commit();
  }

  async finishGame(connection: Connection<ConnectionData>) {
    if (!this.requireHost(connection) || !this.requirePhase(connection, "finalReveal")) return;
    this.state.game.phase = "gameOver";
    await this.commit();
  }

  /**
   * The clue's audio/video finished on the display (or the host pressed
   * "open buzzers now"): open buzzers, or start the final timer.
   * Only the first report counts, so several displays are fine.
   */
  async mediaFinished(connection: Connection<ConnectionData>) {
    const person = this.whoIs(connection);
    if (!person || (person.role !== "host" && person.role !== "display")) {
      this.sendError(connection, "NOT_ALLOWED", "Only the host or a display can do that");
      return;
    }
    const game = this.state.game;
    if (game.phase === "clue" && game.current?.waitingForMedia) {
      game.current.waitingForMedia = false;
      game.current.buzzDeadline = Date.now() + game.settings.buzzSeconds * 1000;
    } else if (game.phase === "finalClue" && game.final.waitingForMedia) {
      game.final.waitingForMedia = false;
      game.final.deadline = Date.now() + game.settings.finalSeconds * 1000;
    } else {
      return; // already started: ignore quietly
    }
    await this.commit();
  }

  // ----- Timers -----

  /** Set (or clear) the room's one alarm for the next timer that needs to go off. */
  async scheduleAlarm(): Promise<void> {
    const next = nextDeadline(this.state.game);
    if (next === null) await this.ctx.storage.deleteAlarm();
    else await this.ctx.storage.setAlarm(next);
  }

  /**
   * Cloudflare calls this when the alarm time is reached, even if the room
   * was hibernating. Mark whichever timer ran out and play the time-up sound.
   */
  async onAlarm(): Promise<void> {
    const game = this.state.game;
    const now = Date.now();
    let changed = false;
    const current = game.current;
    if (game.phase === "clue" && current && !current.buzzExpired && current.buzzDeadline !== null && now >= current.buzzDeadline) {
      current.buzzExpired = true;
      changed = true;
    }
    if (game.phase === "answering" && current && !current.answerExpired && current.answerDeadline !== null && now >= current.answerDeadline) {
      current.answerExpired = true;
      changed = true;
    }
    if (game.phase === "finalClue" && !game.final.expired && game.final.deadline !== null && now >= game.final.deadline) {
      game.final.expired = true;
      changed = true;
    }
    if (changed) {
      this.playSound("timeUp");
      await this.commit();
    } else {
      await this.scheduleAlarm();
    }
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
        color: t.color,
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
      game: buildGameView(this.state, me, Date.now()),
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
