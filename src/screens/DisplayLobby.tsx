import type { LobbyView } from "../../shared/types.ts";
import { Dot, teamColor } from "../ui/kit.tsx";

/** The TV / laptop screen. Read-only. */
export function DisplayLobby({ lobby }: { lobby: LobbyView }) {
  const unassigned = lobby.players.filter((p) => p.teamId === null);
  const joinUrl = window.location.host;

  return (
    <main className="flex min-h-dvh flex-col justify-between gap-8 bg-ink px-10 py-10 text-text lg:px-14">
      <div className="flex items-center justify-between">
        <span className="font-display text-[28px] font-bold tracking-tight">Buzzboard</span>
        <span className="inline-flex items-center gap-2.5 text-xl text-muted">
          <Dot color={lobby.hostConnected ? "#f5b83d" : "#ff8a7a"} size={12} />
          {lobby.hostConnected ? "Waiting for the host to start" : "Host disconnected, waiting for them to come back"}
        </span>
      </div>

      <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-14">
        <div className="flex shrink-0 flex-col gap-7">
          <div className="flex flex-col gap-1.5">
            <span className="text-[22px] text-muted">Join on your phone at</span>
            <span className="font-display text-[34px] font-bold">{joinUrl}</span>
          </div>
          <div className="flex flex-col gap-3">
            <span className="text-lg font-semibold uppercase tracking-[0.1em] text-muted">Room code</span>
            <div role="img" aria-label={`Room code ${lobby.code}`} className="flex gap-2.5">
              {lobby.code.split("").map((ch, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className="flex h-24 w-[72px] items-center justify-center rounded-[10px] bg-tile font-display text-[56px] font-bold text-accent"
                >
                  {ch}
                </span>
              ))}
            </div>
          </div>
          <span className="text-xl text-muted">
            {lobby.players.length} {lobby.players.length === 1 ? "player" : "players"} · {lobby.teams.length}{" "}
            {lobby.teams.length === 1 ? "team" : "teams"}
          </span>
        </div>

        <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(200px,1fr))] items-start gap-4">
          {lobby.teams.map((team) => {
            const members = lobby.players.filter((p) => team.memberIds.includes(p.id));
            return (
              <section key={team.id} className="overflow-hidden rounded-[18px] border border-line bg-surface">
                <div className="h-2" style={{ background: teamColor(lobby, team.id) }} />
                <div className="flex flex-col gap-3.5 px-5 pb-5 pt-4">
                  <h2 className="m-0 font-display text-[22px] font-bold leading-tight">{team.name}</h2>
                  <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                    {members.length === 0 && <li className="text-lg text-muted">No one yet</li>}
                    {members.map((p) => (
                      <li key={p.id} className={`text-[19px] ${p.connected ? "" : "text-muted"}`}>
                        {p.name}
                        {!p.connected && " (offline)"}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      <p className="m-0 text-lg text-muted">
        {unassigned.length > 0 ? `Still choosing a team: ${unassigned.map((p) => p.name).join(", ")}` : " "}
      </p>
    </main>
  );
}
