import { useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";
import { TEAM_COLORS, type LobbyView, type TeamColor, type TeamView } from "../../shared/types.ts";

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
    ghost: "bg-transparent text-muted font-medium hover:text-text hover:underline",
  }[variant];
  return (
    <button
      type="button"
      className={`flex h-14 items-center justify-center rounded-2xl px-5 text-[17px] transition hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`}
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

/** The color the team picked when it was created. Grey if there's no such team. */
export function teamColor(lobby: LobbyView, teamId: string | null): string {
  return lobby.teams.find((t) => t.id === teamId)?.color ?? "#5a6399";
}

/** Spoken names for the colors, for screen readers. */
const COLOR_NAMES: Record<TeamColor, string> = {
  "#5ec8f2": "Sky blue",
  "#c79bff": "Purple",
  "#7ee0a1": "Green",
  "#ff8a7a": "Coral",
  "#f5b83d": "Gold",
  "#8fa8ff": "Periwinkle",
  "#ffd27a": "Yellow",
  "#66e0d0": "Teal",
};

/**
 * The color picked for a new team. If the picked color gets taken by
 * another team in the meantime, it falls back to the first free one.
 * `color` is null when every color is taken.
 */
export function useTeamColorChoice(lobby: LobbyView) {
  const [picked, setPicked] = useState<TeamColor | null>(null);
  const taken = new Set(lobby.teams.map((t) => t.color));
  const free = TEAM_COLORS.filter((c) => !taken.has(c));
  const color = picked !== null && free.includes(picked) ? picked : (free[0] ?? null);
  return { color, setColor: setPicked, taken };
}

/** A row of color swatches for a new team. Colors other teams have are crossed out. */
export function ColorPicker({
  value,
  taken,
  onChange,
}: {
  value: TeamColor | null;
  taken: Set<string>;
  onChange: (color: TeamColor) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Team color" className="flex flex-wrap gap-2.5">
      {TEAM_COLORS.map((c) => {
        const isTaken = taken.has(c);
        const selected = c === value;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={isTaken ? `${COLOR_NAMES[c]} (taken)` : COLOR_NAMES[c]}
            disabled={isTaken}
            onClick={() => onChange(c)}
            className={`relative size-10 rounded-full transition disabled:cursor-not-allowed disabled:opacity-25 ${
              selected ? "ring-[3px] ring-text ring-offset-[3px] ring-offset-ink" : "hover:scale-110"
            }`}
            style={{ background: c }}
          >
            {isTaken && (
              <svg aria-hidden="true" className="absolute inset-0 m-auto" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0b1033" strokeWidth="3" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
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

/** 1200 → "1,200", -400 → "−400" (real minus sign). */
export function formatScore(n: number): string {
  const abs = Math.abs(n).toLocaleString("en-US");
  return n < 0 ? `−${abs}` : abs;
}

export function teamName(lobby: LobbyView, teamId: string | null): string {
  return lobby.teams.find((t) => t.id === teamId)?.name ?? "No team";
}

export function scoreOf(lobby: LobbyView, teamId: string): number {
  return lobby.game.scores[teamId] ?? 0;
}

export interface Standing {
  teamId: string;
  name: string;
  score: number;
  /** 1 = first. Tied scores share a place. */
  place: number;
}

/** Teams sorted by score, highest first, with shared places for ties. */
export function standings(lobby: LobbyView): Standing[] {
  const sorted = lobby.teams
    .map((t) => ({ teamId: t.id, name: t.name, score: scoreOf(lobby, t.id) }))
    .sort((a, b) => b.score - a.score);
  return sorted.map((s) => ({ ...s, place: sorted.findIndex((o) => o.score === s.score) + 1 }));
}

export function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}
