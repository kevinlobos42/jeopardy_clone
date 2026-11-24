import type { ChosenRole, LobbyView } from "../../shared/types.ts";
import { ErrorText, PhoneScreen, RoomPill, Title } from "../ui/kit.tsx";

export function ChooseRole({
  lobby,
  onChoose,
  error,
}: {
  lobby: LobbyView;
  onChoose: (role: ChosenRole) => void;
  error: string | null;
}) {
  return (
    <PhoneScreen>
      <RoomPill code={lobby.code} />
      <Title sub="Pick carefully. Only the host can change this.">How are you joining?</Title>

      <div className="flex flex-col gap-3.5">
        <RoleCard
          title="Player"
          description="Join a team, buzz in and answer from your phone."
          highlight
          onClick={() => onChoose("player")}
          icon={
            <>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
            </>
          }
        />
        <RoleCard
          title="Display"
          description="Show the board on a TV or laptop for the room. You won't play from this device."
          onClick={() => onChoose("display")}
          icon={
            <>
              <rect x="2" y="4" width="20" height="13" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </>
          }
        />
      </div>
      <ErrorText>{error}</ErrorText>
    </PhoneScreen>
  );
}

function RoleCard({
  title,
  description,
  icon,
  highlight = false,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  highlight?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-4 rounded-[18px] border-2 bg-surface p-5 text-left transition hover:bg-surface-2 ${highlight ? "border-accent" : "border-line"}`}
    >
      <span className={`flex size-13 shrink-0 items-center justify-center rounded-2xl ${highlight ? "bg-accent text-ink" : "bg-surface-2 text-text"}`}>
        <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {icon}
        </svg>
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-display text-[22px] font-bold">{title}</span>
        <span className="text-[15px] leading-snug text-muted">{description}</span>
      </span>
    </button>
  );
}
