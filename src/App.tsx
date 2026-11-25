import { useState } from "react";
import { useRoom } from "./room/useRoom.ts";
import { Home } from "./screens/Home.tsx";
import { Join } from "./screens/Join.tsx";
import { ChooseRole } from "./screens/ChooseRole.tsx";
import { PickTeam } from "./screens/PickTeam.tsx";
import { HostGone, PlayerWaiting } from "./screens/PlayerWaiting.tsx";
import { HostLobby } from "./screens/HostLobby.tsx";
import { DisplayLobby } from "./screens/DisplayLobby.tsx";
import { Button, PhoneScreen } from "./ui/kit.tsx";
import { HostGame } from "./screens/host/HostGame.tsx";
import { PlayerGame } from "./screens/player/PlayerGame.tsx";
import { DisplayGame } from "./screens/display/DisplayGame.tsx";
import { SoundButton, useGameSounds, useServerSound, useThinkingMusic } from "./room/sounds.tsx";

/**
 * Picks which screen to show from the connection state and the lobby
 * the server sent. All decisions come from the server's LobbyView.
 */
function App() {
  const room = useRoom();
  const [view, setView] = useState<"home" | "join">("home");
  const { lobby, error } = room;
  const errorText = error?.message ?? null;

  // Sounds live here (not in a screen) so "enable sound" survives screen changes.
  // Only the display plays them.
  const sounds = useGameSounds();
  const isDisplay = lobby?.you.role === "display";
  useServerSound(lobby?.game.sound.seq ?? null, lobby?.game.sound.kind ?? "none", isDisplay ? sounds.play : noSound);
  // Thinking music: while buzzers are open, and while teams write the final answer.
  const g = lobby?.game;
  const thinking =
    isDisplay &&
    !!g &&
    ((g.phase === "clue" && !!g.current && !g.current.buzzExpired && !g.current.waitingForMedia) ||
      (g.phase === "finalClue" && !!g.final && !g.final.expired && !g.final.waitingForMedia));
  useThinkingMusic(thinking, sounds.enabled, sounds.setThinking);
  const soundButton = <SoundButton enabled={sounds.enabled} onEnable={sounds.enable} />;

  // Not in a room yet (or reconnecting to one).
  if (!lobby) {
    if (room.reconnecting) {
      return (
        <PhoneScreen className="items-center justify-center text-center">
          <p className="m-0 text-lg text-muted">Reconnecting to room {room.code}…</p>
          <Button variant="ghost" onClick={room.leave}>
            Leave and start over
          </Button>
        </PhoneScreen>
      );
    }
    if (view === "join") {
      return (
        <Join
          onBack={() => {
            room.clearError();
            setView("home");
          }}
          onSubmit={(code, name) => room.joinRoom(code, name)}
          busy={room.busy}
          error={errorText}
        />
      );
    }
    return (
      <Home
        onJoin={() => {
          room.clearError();
          setView("join");
        }}
        onHost={room.hostRoom}
        busy={room.busy}
        error={errorText}
      />
    );
  }

  const { you } = lobby;

  const inGame = lobby.game.phase !== "lobby";

  if (inGame && you.role === "host") {
    return <HostGame lobby={lobby} send={room.send} clockOffset={room.clockOffset} error={errorText} onLeave={room.leave} />;
  }

  if (inGame && you.role === "player" && you.teamId !== null) {
    if (!lobby.hostConnected) return <HostGone lobby={lobby} />;
    return <PlayerGame lobby={lobby} send={room.send} clockOffset={room.clockOffset} error={errorText} />;
  }

  if (inGame && you.role === "display") {
    return <DisplayGame lobby={lobby} clockOffset={room.clockOffset} soundButton={soundButton} send={room.send} />;
  }

  if (you.role === "host") {
    return (
      <HostLobby
        lobby={lobby}
        onCreateTeam={(name, color) => room.send({ type: "createTeam", name, color })}
        onLeave={room.leave}
        onLoadClues={(text) => room.send({ type: "loadClues", text })}
        onSettings={(settings) => room.send({ type: "updateSettings", settings })}
        onStart={() => room.send({ type: "startGame" })}
        clueErrors={room.clueErrors}
        error={errorText}
      />
    );
  }

  if (you.role === null) {
    return <ChooseRole lobby={lobby} onChoose={(role) => room.send({ type: "chooseRole", role })} error={errorText} />;
  }

  if (you.role === "display") {
    return (
      <>
        <DisplayLobby lobby={lobby} />
        {soundButton}
      </>
    );
  }

  // Player
  if (!lobby.hostConnected) return <HostGone lobby={lobby} />;
  if (you.teamId === null) {
    return (
      <PickTeam
        lobby={lobby}
        onPick={(teamId) => room.send({ type: "pickTeam", teamId })}
        onCreate={(name, color) => room.send({ type: "createTeam", name, color })}
        error={errorText}
      />
    );
  }
  return <PlayerWaiting lobby={lobby} />;
}

function noSound() {}

export default App;
