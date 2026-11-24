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

/**
 * Picks which screen to show from the connection state and the lobby
 * the server sent. All decisions come from the server's LobbyView.
 */
function App() {
  const room = useRoom();
  const [view, setView] = useState<"home" | "join">("home");
  const { lobby, error } = room;
  const errorText = error?.message ?? null;

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

  if (you.role === "host") {
    return (
      <HostLobby
        lobby={lobby}
        onCreateTeam={(name) => room.send({ type: "createTeam", name })}
        onLeave={room.leave}
        error={errorText}
      />
    );
  }

  if (you.role === null) {
    return <ChooseRole lobby={lobby} onChoose={(role) => room.send({ type: "chooseRole", role })} error={errorText} />;
  }

  if (you.role === "display") {
    return <DisplayLobby lobby={lobby} />;
  }

  // Player
  if (!lobby.hostConnected) return <HostGone lobby={lobby} />;
  if (you.teamId === null) {
    return (
      <PickTeam
        lobby={lobby}
        onPick={(teamId) => room.send({ type: "pickTeam", teamId })}
        onCreate={(name) => room.send({ type: "createTeam", name })}
        error={errorText}
      />
    );
  }
  return <PlayerWaiting lobby={lobby} />;
}

export default App;
