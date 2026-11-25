import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import type { LobbyView } from "../../../shared/types.ts";
import type { ClientMessage } from "../../../shared/messages.ts";
import { useCountdown } from "../../room/countdown.ts";
import { ErrorText, formatScore, scoreOf, teamColor, teamName } from "../../ui/kit.tsx";
import { PlayerFinalAnswer, PlayerFinalReveal, PlayerFinalWager, PlayerGameOver } from "../final/FinalPlayer.tsx";

type Send = (message: ClientMessage) => void;

/** A player's phone during the game. Header with team name and score; */
export function PlayerGame({
  lobby,
  send,
  clockOffset,
  error,
}: {
  lobby: LobbyView;
  send: Send;
  clockOffset: number;
  error: string | null;
}) {
  const { game, you } = lobby;
  const teamId = you.teamId as string;
  const color = teamColor(lobby, teamId);
  const current = game.current;
  const myTeamUp = game.phase === "answering" && current?.buzzedTeamId === teamId;
  // Where the buzzer was on screen (relative to <main>), so the team color can grow out of it.
  const buzzerSpotRef = useRef<BuzzerSpot | null>(null);

  let body: ReactNode;
  switch (game.phase) {
    case "board":
      body = (
        <Waiting
          title={game.pickingTeamId ? `${teamName(lobby, game.pickingTeamId)} ${game.pickingTeamId === teamId ? "(you) are" : "are"} picking` : "The host is picking"}
        />
      );
      break;
    case "clue":
      body = <BuzzerPanel lobby={lobby} send={send} clockOffset={clockOffset} buzzerSpotRef={buzzerSpotRef} />;
      break;
    case "answering":
      body = myTeamUp ? <TeamUpPanel lobby={lobby} clockOffset={clockOffset} /> : <OtherTeamUpPanel lobby={lobby} />;
      break;
    case "reveal":
      body = <RevealPanel lobby={lobby} />;
      break;
    case "roundIntro":
      body = <Waiting title={game.round?.name ?? "Next round"} sub="The next board is coming up." />;
      break;
    case "finalWager":
      body = <PlayerFinalWager lobby={lobby} send={send} />;
      break;
    case "finalClue":
      body = <PlayerFinalAnswer lobby={lobby} send={send} clockOffset={clockOffset} />;
      break;
    case "finalReveal":
      body = <PlayerFinalReveal lobby={lobby} />;
      break;
    case "gameOver":
      body = <PlayerGameOver lobby={lobby} />;
      break;
    default:
      body = null;
  }

  return (
    <main
      className="relative isolate mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 bg-ink p-6 text-text"
      style={{ color: myTeamUp ? "var(--color-ink)" : undefined }}
    >
      {myTeamUp && <BuzzFill color={color} spotRef={buzzerSpotRef} />}
      <header
        className="flex items-center justify-between rounded-[18px] px-4.5 py-4"
        style={{ background: color, color: "var(--color-ink)", border: "1px solid var(--color-line)" }}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{teamName(lobby, teamId)}</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-display text-[32px] font-bold">{formatScore(scoreOf(lobby, teamId))}</span>
        </div>
      </header>
      {body}
      <ErrorText>{error}</ErrorText>
    </main>
  );
}

type BuzzerSpot = { x: number; y: number; radius: number };

/** The team color, growing out of where the buzzer was until it fills the screen. */
function BuzzFill({ color, spotRef }: { color: string; spotRef: RefObject<BuzzerSpot | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  // Set the starting point before the first paint. No spot (e.g. the page
  // was refreshed mid-answer): grow from the middle.
  useLayoutEffect(() => {
    const el = ref.current;
    const spot = spotRef.current;
    if (!el || !spot) return;
    el.style.setProperty("--x", `${spot.x}px`);
    el.style.setProperty("--y", `${spot.y}px`);
    el.style.setProperty("--r0", `${spot.radius}px`);
  }, [spotRef]);
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="buzz-fill pointer-events-none absolute inset-0 -z-10"
      style={{ "--x": "50%", "--y": "50%", "--r0": "0px", background: color } as CSSProperties}
    />
  );
}

function Waiting({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
      <BuzzerShape label="Buzzer off" disabled dashed />
      <div className="flex flex-col gap-1.5">
        <p className="m-0 text-xl font-semibold">{title}</p>
        <p className="m-0 text-base text-muted">{sub}</p>
      </div>
    </div>
  );
}

function BuzzerShape({ label, disabled, dashed = false, icon }: { label: string; disabled?: boolean; dashed?: boolean; icon?: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-60 flex-col items-center justify-center gap-2 rounded-full font-display text-2xl font-bold ${
        dashed ? "border-[3px] border-dashed border-line bg-[#121844] text-muted" : "border-[3px] border-line bg-surface-2 text-muted"
      } ${disabled ? "" : ""}`}
    >
      {icon}
      {label}
    </span>
  );
}

const LOCK_ICON = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

function ClueLabel({ lobby }: { lobby: LobbyView }) {
  const current = lobby.game.current;
  if (!current) return null;
  return (
    <span className="font-display text-xl font-bold uppercase tracking-[0.06em] text-muted">
      {current.topic} · <span className="text-accent">{formatScore(current.value)}</span>
    </span>
  );
}

// ---------- buzzers open ----------

function BuzzerPanel({
  lobby,
  send,
  clockOffset,
  buzzerSpotRef,
}: {
  lobby: LobbyView;
  send: Send;
  clockOffset: number;
  buzzerSpotRef: RefObject<BuzzerSpot | null>;
}) {
  /** Remember where the buzzer is, relative to <main>. Teammates' phones record it too, so their fill starts there as well. */
  const measure = (el: HTMLElement | null) => {
    const main = el?.closest("main");
    if (!el || !main) return;
    const b = el.getBoundingClientRect();
    const m = main.getBoundingClientRect();
    buzzerSpotRef.current = { x: b.left - m.left + b.width / 2, y: b.top - m.top + b.height / 2, radius: b.width / 2 };
  };
  const current = lobby.game.current;
  const teamId = lobby.you.teamId as string;
  const left = useCountdown(current?.buzzDeadline ?? null, clockOffset);
  // After tapping, show "Buzzing…" until the server answers, so a double tap does nothing.
  const [pressed, setPressed] = useState(false);
  const deadline = current?.buzzDeadline;
  useEffect(() => setPressed(false), [deadline]);

  if (!current) return null;
  const lockedOut = current.lockedOutTeamIds.includes(teamId);
  const closed = current.buzzExpired || left === 0;

  let main: ReactNode;
  let caption: string;
  if (current.waitingForMedia) {
    main = <BuzzerShape label="Listen…" dashed />;
    caption = "Buzzers open when the clip on the screen finishes.";
  } else if (lockedOut) {
    main = <BuzzerShape label="Locked" icon={LOCK_ICON} />;
    caption = "Your team already answered this one. Other teams can still buzz.";
  } else if (closed) {
    main = <BuzzerShape label="Time's up" icon={LOCK_ICON} />;
    caption = "Buzzers are locked. Waiting for the host.";
  } else {
    main = (
      <button
        ref={measure}
        type="button"
        disabled={pressed}
        onClick={(e) => {
          measure(e.currentTarget);
          setPressed(true);
          navigator.vibrate?.(40);
          send({ type: "buzz" });
        }}
        className="flex size-[300px] items-center justify-center rounded-full bg-accent font-display text-5xl font-bold tracking-[0.04em] text-ink transition active:scale-95 disabled:opacity-70"
      >
        {pressed ? "…" : "BUZZ"}
      </button>
    );
    caption = left !== null ? `${left}s to buzz · first team in answers` : "First team in answers";
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
      <ClueLabel lobby={lobby} />
      {main}
      <p className="m-0 max-w-[300px] text-base leading-relaxed text-muted">{caption}</p>
      <p className="m-0 max-w-[320px] text-[15px] leading-relaxed">{current.question}</p>
    </div>
  );
}

// ---------- someone buzzed ----------

function TeamUpPanel({ lobby, clockOffset }: { lobby: LobbyView; clockOffset: number }) {
  const current = lobby.game.current;
  const left = useCountdown(current?.answerDeadline ?? null, clockOffset);
  if (!current) return null;
  return (
    <div className="fade-up flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <span className="font-display text-lg font-bold uppercase tracking-[0.08em]">
        {current.topic} · {formatScore(current.value)}
      </span>
      <h1 className="m-0 font-display text-[52px] font-bold leading-none tracking-tight">Your team buzzed!</h1>
      <p className="m-0 max-w-[300px] text-[19px] leading-relaxed">
        {current.buzzedByName ? `${current.buzzedByName} buzzed first. ` : ""}
      </p>
      <span className="font-display text-3xl font-bold">{left === 0 || current.answerExpired ? "Time!" : `${left}s`}</span>
    </div>
  );
}

function OtherTeamUpPanel({ lobby }: { lobby: LobbyView }) {
  const current = lobby.game.current;
  if (!current) return null;
  const teamId = lobby.you.teamId as string;
  const lockedOut = current.lockedOutTeamIds.includes(teamId);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
      <ClueLabel lobby={lobby} />
      <BuzzerShape label="Locked" icon={LOCK_ICON} />
      <div className="flex flex-col gap-1.5">
        <p className="m-0 text-xl font-semibold">{teamName(lobby, current.buzzedTeamId)} buzzed first</p>
        <p className="m-0 max-w-[300px] text-base leading-relaxed text-muted">
          {lockedOut ? "Your team is out for this one." : "If they get it wrong, your buzzer turns back on."}
        </p>
      </div>
    </div>
  );
}

// ---------- reveal ----------

function RevealPanel({ lobby }: { lobby: LobbyView }) {
  const current = lobby.game.current;
  if (!current) return null;
  const teamId = lobby.you.teamId as string;
  const mine = current.results.filter((r) => r.teamId === teamId);
  const net = mine.reduce((n, r) => n + r.points, 0);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
      <ClueLabel lobby={lobby} />
      <p className="m-0 max-w-[320px] text-base text-muted">{current.question}</p>
      <p className="m-0 font-display text-[40px] font-bold leading-tight text-accent">{current.answer}</p>
      {mine.length > 0 && (
        <p className={`m-0 text-xl font-semibold ${net < 0 ? "text-bad" : "text-good"}`}>
          {net < 0 ? `Wrong. ${formatScore(net)}` : `Correct! +${formatScore(net)}`}
        </p>
      )}
    </div>
  );
}
