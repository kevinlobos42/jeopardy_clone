import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import type { LobbyView, TeamView } from "../../shared/types.ts";

/** Phone-sized screen wrapper used by every phone screen. */
export function PhoneScreen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main className={`mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 bg-ink p-6 text-text ${className}`}>
      {children}
    </main>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" };

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles = {
    primary: "bg-accent text-ink font-bold hover:brightness-105",
    secondary: "bg-surface text-text border border-line font-semibold hover:bg-surface-2",
    ghost: "bg-transparent text-muted font-medium hover:text-text",
  }[variant];
  return (
    <button
      type="button"
      className={`flex h-14 items-center justify-center rounded-2xl px-5 text-[17px] transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function RoomPill({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center gap-2 self-start rounded-full border border-line bg-surface px-3 py-1.5 text-sm text-muted">
      Room <strong className="font-display tracking-[0.15em] text-text">{code}</strong>
    </span>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="m-0 text-sm text-bad">
      {children}
    </p>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="m-0 font-display text-[34px] font-bold leading-tight tracking-tight">{children}</h1>
      {sub && <p className="m-0 text-base text-muted">{sub}</p>}
    </div>
  );
}

export function TextField({
  id,
  label,
  hint,
  ...props
}: { id: string; label: string; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        className="h-14 rounded-2xl border-2 border-line bg-surface px-4 text-[17px] text-text outline-none placeholder:text-[#7f88bd] focus:border-accent"
        {...props}
      />
      {hint}
    </div>
  );
}

/** Team colors, assigned by the team's position in the lobby. */
const TEAM_COLORS = ["#5ec8f2", "#c79bff", "#7ee0a1", "#ff8a7a", "#f5b83d", "#8fa8ff", "#ffd27a", "#66e0d0"];

export function teamColor(lobby: LobbyView, teamId: string | null): string {
  const index = lobby.teams.findIndex((t) => t.id === teamId);
  return index === -1 ? "#5a6399" : TEAM_COLORS[index % TEAM_COLORS.length];
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <span aria-hidden="true" className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: color }} />
  );
}

/** Names of a team's members, in join order. */
export function memberNames(lobby: LobbyView, team: TeamView): string[] {
  return team.memberIds.map((id) => lobby.players.find((p) => p.id === id)?.name ?? "?");
}

export function playerCountLabel(n: number): string {
  return n === 1 ? "1 player" : `${n} players`;
}
