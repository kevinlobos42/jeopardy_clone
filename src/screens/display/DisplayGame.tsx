import type { ReactNode } from "react";
import type { LobbyView } from "../../../shared/types.ts";
import { useCountdown, useTimeFraction } from "../../room/countdown.ts";
import { Dot, formatScore, scoreOf, teamColor, teamName } from "../../ui/kit.tsx";
import { DisplayFinalClue, DisplayFinalReveal, DisplayFinalWager, DisplayGameOver } from "../final/FinalDisplay.tsx";
import { MediaPlayer } from "../../ui/Media.tsx";
import type { ClientMessage } from "../../../shared/messages.ts";

/** The TV / laptop during the game. Read-only, plays the sounds. */
export function DisplayGame({
  lobby,
  clockOffset,
  soundButton,
  send,
}: {
  lobby: LobbyView;
  clockOffset: number;
  soundButton: ReactNode;
  send: (message: ClientMessage) => void;
}) {
  const mediaFinished = () => send({ type: "mediaFinished" });
  const { game } = lobby;

  let screen: ReactNode;
  switch (game.phase) {
    case "board":
      screen = <BoardScreen lobby={lobby} />;
      break;
    case "clue":
      screen = <ClueScreen lobby={lobby} clockOffset={clockOffset} onMediaFinished={mediaFinished} />;
      break;
    case "answering":
      screen = <BuzzedScreen lobby={lobby} clockOffset={clockOffset} />;
      break;
    case "reveal":
      screen = <RevealScreen lobby={lobby} />;
      break;
    case "roundIntro":
      screen = <RoundIntroScreen lobby={lobby} />;
      break;
    case "finalWager":
      screen = <DisplayFinalWager lobby={lobby} />;
      break;
    case "finalClue":
      screen = <DisplayFinalClue lobby={lobby} clockOffset={clockOffset} onMediaFinished={mediaFinished} />;
      break;
    case "finalReveal":
      screen = <DisplayFinalReveal lobby={lobby} />;
      break;
    case "gameOver":
      screen = <DisplayGameOver lobby={lobby} />;
      break;
    default:
      screen = null;
  }

  return (
    <div className="relative min-h-dvh">
      {screen}
      {!lobby.hostConnected && (
        <div className="absolute inset-x-0 top-0 flex justify-center p-3">
          <span className="rounded-full bg-bad px-5 py-2 text-lg font-semibold text-ink">Host disconnected · waiting for them to come back</span>
        </div>
      )}
      {soundButton}
    </div>
  );
}

function Frame({ children, bg = "bg-ink" }: { children: ReactNode; bg?: string }) {
  return <main className={`flex min-h-dvh flex-col gap-6 px-10 py-8 text-text lg:px-14 ${bg}`}>{children}</main>;
}

function ScoreStrip({ lobby }: { lobby: LobbyView }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      {lobby.teams.map((team) => {
        const score = scoreOf(lobby, team.id);
        return (
          <div key={team.id} className="flex h-[72px] items-center gap-3.5 rounded-[14px] border border-line bg-surface px-5">
            <Dot color={teamColor(lobby, team.id)} size={14} />
            <span className="min-w-0 flex-1 truncate text-xl font-semibold">{team.name}</span>
            <span className={`font-display text-3xl font-bold ${score < 0 ? "text-bad" : ""}`}>{formatScore(score)}</span>
          </div>
        );
      })}
    </div>
  );
}

function ClueTitle({ lobby }: { lobby: LobbyView }) {
  const current = lobby.game.current;
  if (!current) return null;
  return (
    <div className="flex items-center justify-between">
      <span className="font-display text-[26px] font-bold uppercase tracking-[0.06em]">{current.topic}</span>
      <span className="font-display text-[40px] font-bold text-accent">{formatScore(current.value)}</span>
    </div>
  );
}

/** Countdown in a ring, for the corner of the clue. */
function CornerTimer({ seconds, fraction, label }: { seconds: number; fraction: number; label: string }) {
  const deg = Math.round(fraction * 360);
  return (
    <div className="flex items-center gap-3" aria-label={`${label}: ${seconds} seconds`}>
      <span className="text-lg font-semibold text-[#d6dcff]">{label}</span>
      <span
        className="flex size-20 items-center justify-center rounded-full"
        style={{ background: `conic-gradient(#f5b83d ${deg}deg, rgba(11,16,51,0.55) ${deg}deg)` }}
      >
        <span className="flex size-[64px] items-center justify-center rounded-full bg-ink font-display text-3xl font-bold">{seconds}</span>
      </span>
    </div>
  );
}

// ---------- board ----------

function BoardScreen({ lobby }: { lobby: LobbyView }) {
  const { game } = lobby;
  const board = game.board ?? [];
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <span className="font-display text-[22px] font-bold text-muted">{game.round?.name}</span>
        {game.pickingTeamId && (
          <span className="inline-flex items-center gap-2.5 text-xl">
            <Dot color={teamColor(lobby, game.pickingTeamId)} size={12} />
            {teamName(lobby, game.pickingTeamId)} pick next
          </span>
        )}
      </div>
      <div
        className="grid flex-1 content-start gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, board.length)}, minmax(0, 1fr))` }}
      >
        {board.map((col, i) => (
          <div
            key={`t${i}`}
            className="flex h-[84px] items-center justify-center rounded-lg bg-tile px-2.5 text-center font-display text-[19px] font-bold uppercase leading-tight tracking-[0.03em]"
          >
            {col.topic}
          </div>
        ))}
        {Array.from({ length: Math.max(0, ...board.map((c) => c.cells.length)) }).flatMap((_, row) =>
          board.map((col, column) => {
            const cell = col.cells[row];
            const open = cell?.state === "open";
            return (
              <div
                key={`${column}-${row}`}
                className={`flex h-[68px] items-center justify-center rounded-lg font-display text-[38px] font-bold text-accent ${open ? "bg-tile" : "bg-[#121844]"}`}
              >
                {open ? formatScore(cell.value) : ""}
              </div>
            );
          }),
        )}
      </div>
      <ScoreStrip lobby={lobby} />
    </Frame>
  );
}

// ---------- clue (buzzers open) ----------

function ClueScreen({ lobby, clockOffset, onMediaFinished }: { lobby: LobbyView; clockOffset: number; onMediaFinished: () => void }) {
  const current = lobby.game.current;
  const left = useCountdown(current?.buzzDeadline ?? null, clockOffset);
  const fraction = useTimeFraction(current?.buzzDeadline ?? null, lobby.game.settings.buzzSeconds, clockOffset);
  if (!current) return null;
  const closed = current.buzzExpired || left === 0;
  const media = current.questionMedia;

  return (
    <Frame bg="bg-tile">
      <ClueTitle lobby={lobby} />
      <div className="m-auto flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-6">
        {media && (
          <div className={`flex min-h-0 items-center justify-center ${media.type === "audio" ? "" : "max-h-[52vh] w-full"}`}>
            <MediaPlayer media={media} autoPlay={current.waitingForMedia} onFinished={onMediaFinished} className="max-h-[50vh]" />
          </div>
        )}
        <p
          className={`m-0 max-w-[1100px] px-10 text-center font-display font-bold uppercase leading-tight ${
            media && media.type !== "audio" ? "text-[clamp(24px,2.8vw,40px)]" : "text-[clamp(32px,4.4vw,64px)]"
          }`}
        >
          {current.question}
        </p>
      </div>
      <div className="flex items-center justify-between gap-6">
        <div className="flex flex-wrap gap-3">
          {current.lockedOutTeamIds.map((id) => (
            <span key={id} className="inline-flex items-center gap-2.5 rounded-full bg-ink/60 px-5 py-2.5 text-lg">
              <Dot color={teamColor(lobby, id)} size={12} />
              {teamName(lobby, id)} is out
            </span>
          ))}
        </div>
        {current.waitingForMedia ? (
          <span className="rounded-full bg-ink/60 px-7 py-3.5 font-display text-2xl font-bold">Buzzers open when it ends</span>
        ) : closed ? (
          <span className="rounded-full bg-ink/60 px-7 py-3.5 font-display text-2xl font-bold">Buzzers locked</span>
        ) : (
          <CornerTimer seconds={left ?? 0} fraction={fraction} label="Buzz now" />
        )}
      </div>
    </Frame>
  );
}

// ---------- someone buzzed (clue hidden) ----------

function BuzzedScreen({ lobby, clockOffset }: { lobby: LobbyView; clockOffset: number }) {
  const current = lobby.game.current;
  const left = useCountdown(current?.answerDeadline ?? null, clockOffset);
  const fraction = useTimeFraction(current?.answerDeadline ?? null, lobby.game.settings.answerSeconds, clockOffset);
  if (!current || !current.buzzedTeamId) return null;
  const color = teamColor(lobby, current.buzzedTeamId);
  const timeUp = current.answerExpired || left === 0;

  return (
    <Frame>
      <ClueTitle lobby={lobby} />
      <div className="m-auto flex flex-col items-center gap-6 text-center">
        <span aria-hidden="true" className="size-9 rounded-full" style={{ background: color, boxShadow: `0 0 0 14px ${color}38` }} />
        <span className="font-display text-[clamp(56px,7.5vw,110px)] font-bold leading-none tracking-tight">{teamName(lobby, current.buzzedTeamId)}</span>
        <span className="text-[28px] text-muted">
          {current.buzzedByName ? `${current.buzzedByName} buzzed in` : "buzzed in"} · answer out loud
        </span>
      </div>
      <div className="flex justify-end">
        {timeUp ? (
          <span className="rounded-full bg-bad px-7 py-3.5 font-display text-2xl font-bold text-ink">Time!</span>
        ) : (
          <CornerTimer seconds={left ?? 0} fraction={fraction} label="Answer" />
        )}
      </div>
    </Frame>
  );
}

// ---------- reveal ----------

function RevealScreen({ lobby }: { lobby: LobbyView }) {
  const current = lobby.game.current;
  if (!current) return null;
  return (
    <Frame>
      <span className="font-display text-2xl font-bold uppercase tracking-[0.06em] text-muted">
        {current.topic} · {formatScore(current.value)}
      </span>
      <div className="m-auto flex flex-col items-center gap-4 text-center">
        <p className="m-0 max-w-[900px] text-[26px] leading-snug text-muted">{current.question}</p>
        {current.answerMedia && (
          <div className="flex items-center justify-center">
            <MediaPlayer media={current.answerMedia} autoPlay className="max-h-[24vh]" />
          </div>
        )}
        <p
          className={`m-0 font-display font-bold leading-tight text-accent ${current.answerMedia ? "text-[clamp(40px,4.5vw,64px)]" : "text-[clamp(48px,6vw,84px)]"}`}
        >
          {current.answer}
        </p>
        <div className="flex flex-wrap justify-center gap-3.5">
          {current.results.map((r, i) => (
            <span
              key={i}
              className="inline-flex h-[52px] items-center gap-2.5 rounded-full border-2 bg-surface px-5 text-xl"
              style={{ borderColor: r.correct ? "#7ee0a1" : "#ff8a7a" }}
            >
              <Dot color={teamColor(lobby, r.teamId)} size={12} />
              {teamName(lobby, r.teamId)}
              <strong className={r.correct ? "text-good" : "text-bad"}>{r.points < 0 ? formatScore(r.points) : `+${formatScore(r.points)}`}</strong>
            </span>
          ))}
          {current.results.length === 0 && <span className="text-xl text-muted">Nobody got this one</span>}
        </div>
      </div>
      <ScoreStrip lobby={lobby} />
    </Frame>
  );
}

// ---------- round intro ----------

function RoundIntroScreen({ lobby }: { lobby: LobbyView }) {
  const { game } = lobby;
  const values = Array.from(
    new Set((game.board ?? []).flatMap((col) => col.cells.filter((c) => c.state !== "missing").map((c) => c.value))),
  ).sort((a, b) => a - b);
  return (
    <Frame>
      <div aria-hidden="true" className="flex justify-center gap-2.5">
        {values.map((v) => (
          <span key={v} className="flex h-[72px] w-[132px] items-center justify-center rounded-lg bg-tile font-display text-3xl font-bold text-accent">
            {formatScore(v)}
          </span>
        ))}
      </div>
      <div className="m-auto flex flex-col items-center gap-3.5 text-center">
        <span className="text-2xl uppercase tracking-[0.12em] text-muted">
          Round {(game.round?.index ?? 0) + 1} of {game.round?.total}
        </span>
        <h1 className="m-0 font-display text-[clamp(64px,8vw,104px)] font-bold leading-none tracking-tight">{game.round?.name}</h1>
        {game.pickingTeamId && (
          <p className="m-0 text-[26px] text-muted">{teamName(lobby, game.pickingTeamId)} pick first · lowest score starts</p>
        )}
      </div>
      <ScoreStrip lobby={lobby} />
    </Frame>
  );
}
