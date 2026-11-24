import type { LobbyView } from "../../shared/types.ts";
import { Dot, PhoneScreen, playerCountLabel, RoomPill, teamColor } from "../ui/kit.tsx";

export function PlayerWaiting({ lobby }: { lobby: LobbyView }) {
  const team = lobby.teams.find((t) => t.id === lobby.you.teamId);
  const color = teamColor(lobby, lobby.you.teamId);
  const members = team ? lobby.players.filter((p) => team.memberIds.includes(p.id)) : [];

  return (
    <PhoneScreen className="justify-between">
      <RoomPill code={lobby.code} />

      <div className="flex flex-col items-center gap-7">
        <span className="flex size-22 items-center justify-center rounded-full bg-accent text-ink">
          <svg role="img" aria-label="Joined" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7" />
          </svg>
        </span>
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="m-0 font-display text-4xl font-bold tracking-tight">You're in!</h1>
          <p className="m-0 text-base text-muted">Waiting for the host to start the game.</p>
        </div>

        {team && (
          <div className="w-full overflow-hidden rounded-[18px] border border-line bg-surface">
            <div className="h-1.5" style={{ background: color }} />
            <div className="flex flex-col gap-3.5 px-5 py-4">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-[22px] font-bold">{team.name}</span>
                <span className="text-sm text-muted">{playerCountLabel(members.length)}</span>
              </div>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-base">
                {members.map((p) => (
                  <li key={p.id} className={`flex items-center gap-2.5 ${p.id === lobby.you.id ? "font-semibold" : ""}`}>
                    <Dot color={p.connected ? "#7ee0a1" : "#5a6399"} size={8} />
                    {p.name}
                    {p.id === lobby.you.id && " (you)"}
                    {!p.connected && <span className="text-sm text-muted">offline</span>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <p className="m-0 text-center text-sm text-muted">Keep this screen open. Your buzzer will appear here.</p>
    </PhoneScreen>
  );
}

export function HostGone({ lobby }: { lobby: LobbyView }) {
  const team = lobby.teams.find((t) => t.id === lobby.you.teamId);
  return (
    <PhoneScreen className="justify-between">
      <RoomPill code={lobby.code} />
      <div className="flex flex-col items-center gap-7 text-center">
        <span className="flex size-22 items-center justify-center rounded-full border-2 border-bad bg-surface-2 text-bad">
          <svg role="img" aria-label="Connection lost" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8.8a15 15 0 0 1 4.2-2.6M10 5.1a15 15 0 0 1 12 3.7M5 12.5a10 10 0 0 1 5.2-2.6M16.5 10.6a10 10 0 0 1 2.5 1.9M8.5 16a5 5 0 0 1 7 0M12 20h.01M3 3l18 18" />
          </svg>
        </span>
        <div className="flex flex-col items-center gap-2">
          <h1 className="m-0 font-display text-[34px] font-bold tracking-tight">Host disconnected</h1>
          <p className="m-0 max-w-[300px] text-base leading-relaxed text-muted">
            Hang tight. Everything is saved and the game picks up when they're back.
          </p>
        </div>
      </div>
      <p className="m-0 text-center text-sm text-muted">{team ? `You're on ${team.name}. No need to rejoin.` : "No need to rejoin."}</p>
    </PhoneScreen>
  );
}
