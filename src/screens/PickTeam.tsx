import { useState } from "react";
import { TEAM_NAME_MAX, type LobbyView, type TeamColor } from "../../shared/types.ts";
import {
  Button,
  ColorPicker,
  Dot,
  ErrorText,
  memberNames,
  PhoneScreen,
  playerCountLabel,
  RoomPill,
  teamColor,
  Title,
  useTeamColorChoice,
} from "../ui/kit.tsx";

export function PickTeam({
  lobby,
  onPick,
  onCreate,
  error,
}: {
  lobby: LobbyView;
  onPick: (teamId: string) => void;
  onCreate: (name: string, color: TeamColor) => void;
  error: string | null;
}) {
  const [newName, setNewName] = useState("");
  const { color, setColor, taken } = useTeamColorChoice(lobby);

  return (
    <PhoneScreen>
      <RoomPill code={lobby.code} />
      <Title >Pick your team</Title>

      <div className="flex flex-col gap-2.5">
        {lobby.teams.map((team) => {
          const names = memberNames(lobby, team);
          return (
            <button
              key={team.id}
              type="button"
              onClick={() => onPick(team.id)}
              className="flex min-h-16 items-center gap-3.5 rounded-2xl border border-line bg-surface px-4 py-3 text-left hover:bg-surface-2"
            >
              <Dot color={teamColor(lobby, team.id)} size={14} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[17px] font-semibold">{team.name}</span>
                <span className="truncate text-sm text-muted">
                  {names.length ? `${playerCountLabel(names.length)} · ${names.join(", ")}` : "Empty"}
                </span>
              </span>
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a9b0d6" strokeWidth="2" strokeLinecap="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </button>
          );
        })}
      </div>

      <div aria-hidden="true" className="flex items-center gap-3 text-sm text-muted">
        <span className="h-px flex-1 bg-line" />
        or
        <span className="h-px flex-1 bg-line" />
      </div>

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newName.trim() && color) onCreate(newName.trim(), color);
        }}
      >
        <label htmlFor="newteam" className="text-sm font-semibold text-muted">
          Start a new team
        </label>
        <ColorPicker value={color} taken={taken} onChange={setColor} />
        <div className="flex gap-2.5">
          <input
            id="newteam"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Team name"
            maxLength={TEAM_NAME_MAX}
            className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-line bg-surface px-4 text-[17px] outline-none placeholder:text-[#7f88bd] focus:border-accent"
          />
          <Button type="submit" className="shrink-0" disabled={!color}>
            Create
          </Button>
        </div>
        <p className="m-0 text-sm text-muted">
          {color ? "Names and colors must be unique." : "Every color is taken, so no more teams can be made. Join one above."}
        </p>
      </form>
      <ErrorText>{error}</ErrorText>
    </PhoneScreen>
  );
}
