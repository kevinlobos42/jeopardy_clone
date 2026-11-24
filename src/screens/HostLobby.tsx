import { useState } from "react";
import { TEAM_NAME_MAX, type LobbyView } from "../../shared/types.ts";
import { Button, Dot, ErrorText, playerCountLabel, teamColor } from "../ui/kit.tsx";

export function HostLobby({
  lobby,
  onCreateTeam,
  onLeave,
  error,
}: {
  lobby: LobbyView;
  onCreateTeam: (name: string) => void;
  onLeave: () => void;
  error: string | null;
}) {
  const [newTeam, setNewTeam] = useState("");
  const [copied, setCopied] = useState(false);
  const unassigned = lobby.players.filter((p) => p.teamId === null);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(lobby.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked; the code is on screen anyway.
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-ink text-text">
      <header className="flex flex-col gap-1.5 border-b border-line px-6 pb-4 pt-5">
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">Room code · You're the host</span>
        <div className="flex items-center justify-between">
          <span className="font-display text-[44px] font-bold tracking-[0.18em] text-accent">{lobby.code}</span>
          <button
            type="button"
            onClick={copyCode}
            aria-label="Copy room code"
            className="flex size-11 items-center justify-center rounded-xl border border-line bg-surface hover:bg-surface-2"
          >
            {copied ? (
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7ee0a1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7" />
              </svg>
            ) : (
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
            )}
          </button>
        </div>
        <span className="text-[15px] text-muted">
          {playerCountLabel(lobby.players.length)} · {lobby.displayCount === 1 ? "1 display" : `${lobby.displayCount} displays`}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-6 py-5">
        <h2 className="m-0 font-display text-[22px] font-bold">Teams</h2>

        {lobby.teams.length === 0 && <p className="m-0 text-muted">No teams yet. Create one, or let players make their own.</p>}

        {lobby.teams.map((team) => {
          const members = lobby.players.filter((p) => team.memberIds.includes(p.id));
          return (
            <section key={team.id} className="rounded-2xl border border-line bg-surface p-1.5 pb-2">
              <div className="flex items-center gap-2.5 py-2.5 pl-3 pr-3">
                <Dot color={teamColor(lobby, team.id)} size={12} />
                <h3 className="m-0 flex-1 text-[17px] font-semibold">{team.name}</h3>
                <span className="text-sm text-muted">{playerCountLabel(members.length)}</span>
              </div>
              {members.length === 0 && <p className="m-0 px-3 pb-1 text-sm text-muted">Empty</p>}
              {members.map((p) => (
                <div key={p.id} className="flex min-h-11 items-center gap-2.5 px-3">
                  <Dot color={p.connected ? "#7ee0a1" : "#5a6399"} size={8} />
                  <span className={`flex-1 text-base ${p.connected ? "" : "text-muted"}`}>{p.name}</span>
                  {!p.connected && <span className="text-[13px] text-muted">Offline</span>}
                </div>
              ))}
            </section>
          );
        })}

        {unassigned.length > 0 && (
          <section className="flex flex-col gap-1.5 rounded-2xl border-[1.5px] border-dashed border-line px-4 py-3">
            <h3 className="m-0 text-[15px] font-semibold text-muted">Not on a team yet</h3>
            {unassigned.map((p) => (
              <div key={p.id} className="flex min-h-11 items-center justify-between text-base">
                {p.name}
                <span className="text-[13px] text-muted">Choosing…</span>
              </div>
            ))}
          </section>
        )}

        <form
          className="flex gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newTeam.trim()) return;
            onCreateTeam(newTeam.trim());
            setNewTeam("");
          }}
        >
          <label htmlFor="hostteam" className="sr-only">
            New team name
          </label>
          <input
            id="hostteam"
            value={newTeam}
            onChange={(e) => setNewTeam(e.target.value)}
            placeholder="New team name"
            maxLength={TEAM_NAME_MAX}
            className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3.5 text-base outline-none placeholder:text-[#7f88bd] focus:border-accent"
          />
          <Button type="submit" variant="secondary" className="h-12 shrink-0 text-[15px]">
            Add team
          </Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </div>

      <footer className="flex flex-col gap-2 border-t border-line px-6 pb-6 pt-4">
        <Button disabled>Start game</Button>
        <p className="m-0 text-center text-[13px] text-muted">Starting the game comes with the game logic.</p>
        <Button variant="ghost" className="h-11 text-[15px]" onClick={onLeave}>
          Leave room
        </Button>
      </footer>
    </main>
  );
}
