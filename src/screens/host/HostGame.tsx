import { useState, type ReactNode } from "react";
import type { LobbyView } from "../../../shared/types.ts";
import type { ClientMessage } from "../../../shared/messages.ts";
import type { CurrentClueView } from "../../../shared/game.ts";
import { useCountdown } from "../../room/countdown.ts";
import { Button, Dot, ErrorText, formatScore, teamColor, teamName } from "../../ui/kit.tsx";
import { Scoreboard } from "../../ui/Scoreboard.tsx";
import { MediaPreview } from "../../ui/Media.tsx";
import { HostFinalClue, HostFinalReveal, HostFinalWager, HostGameOver } from "../final/FinalHost.tsx";

type Send = (message: ClientMessage) => void;

/** The host's phone during the game. Picks the right panel for the phase; scores are always at the bottom. */
export function HostGame({
  lobby,
  send,
  clockOffset,
  error,
  onLeave,
}: {
  lobby: LobbyView;
  send: Send;
  clockOffset: number;
  error: string | null;
  onLeave: () => void;
}) {
  const { game } = lobby;

  let panel: ReactNode;
  switch (game.phase) {
    case "board":
      panel = <BoardPanel lobby={lobby} send={send} />;
      break;
    case "clue":
      panel = <CluePanel lobby={lobby} send={send} clockOffset={clockOffset} />;
      break;
    case "answering":
      panel = <AnsweringPanel lobby={lobby} send={send} clockOffset={clockOffset} />;
      break;
    case "reveal":
      panel = <RevealPanel lobby={lobby} send={send} />;
      break;
    case "roundIntro":
      panel = <RoundIntroPanel lobby={lobby} send={send} />;
      break;
    case "finalWager":
      panel = <HostFinalWager lobby={lobby} send={send} />;
      break;
    case "finalClue":
      panel = <HostFinalClue lobby={lobby} send={send} clockOffset={clockOffset} />;
      break;
    case "finalReveal":
      panel = <HostFinalReveal lobby={lobby} send={send} />;
      break;
    case "gameOver":
      panel = <HostGameOver lobby={lobby} onLeave={onLeave} />;
      break;
    default:
      panel = null;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-ink text-text">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <span className="text-sm text-muted">
          Room <strong className="font-display tracking-[0.15em] text-text">{lobby.code}</strong>
        </span>
        <span className="text-sm text-muted">
          {game.phase.startsWith("final") ? "Final round" : game.phase === "gameOver" ? "Game over" : game.round ? `${game.round.name} · ${game.round.index + 1} of ${game.round.total}` : ""}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-4 px-6 py-5">
        {panel}
        <ErrorText>{error}</ErrorText>
      </div>
      {game.phase !== "gameOver" && (
        <footer className="border-t border-line px-6 pb-6 pt-4">
          <Scoreboard lobby={lobby} onAdjust={(teamId, amount) => send({ type: "adjustScore", teamId, amount })} />
        </footer>
      )}
    </main>
  );
}

function PanelTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="m-0 font-display text-[26px] font-bold leading-tight">{children}</h1>
      {sub && <p className="m-0 text-[15px] text-muted">{sub}</p>}
    </div>
  );
}

function ClueHeader({ current }: { current: CurrentClueView }) {
  return (
    <span className="font-display text-base font-bold uppercase tracking-[0.06em]">
      {current.topic} · <span className="text-accent">{formatScore(current.value)}</span>
    </span>
  );
}

function AnswerBox({ answer }: { answer: string | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-dashed border-accent bg-surface px-5 py-3.5">
      <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">Answer</span>
      <span className="text-xl font-semibold">{answer ?? "?"}</span>
    </div>
  );
}

function ResultsSoFar({ lobby, current }: { lobby: LobbyView; current: CurrentClueView }) {
  if (current.results.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {current.results.map((r, i) => (
        <li key={i} className="flex min-h-10 items-center justify-between rounded-xl bg-surface px-3.5 text-[15px]">
          <span className="flex items-center gap-2">
            <Dot color={teamColor(lobby, r.teamId)} size={8} />
            {teamName(lobby, r.teamId)} · {r.correct ? "right" : "wrong"}
          </span>
          <span className={`font-semibold ${r.points < 0 ? "text-bad" : "text-good"}`}>
            {r.points < 0 ? formatScore(r.points) : `+${formatScore(r.points)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------- board ----------

function BoardPanel({ lobby, send }: { lobby: LobbyView; send: Send }) {
  const { game } = lobby;
  // "End round" needs two taps so it can't happen by accident.
  const [confirmEnd, setConfirmEnd] = useState(false);
  return (
    <>
      <PanelTitle
        sub={
          game.pickingTeamId ? (
            <span className="inline-flex items-center gap-2">
              <Dot color={teamColor(lobby, game.pickingTeamId)} size={10} />
              {teamName(lobby, game.pickingTeamId)} choose
            </span>
          ) : (
            "Choose any clue"
          )
        }
      >
        Pick a clue
      </PanelTitle>

      <div className="flex flex-col gap-3.5">
        {game.board?.map((col, column) => (
          <div key={column} className="flex flex-col gap-1.5">
            <h2 className="m-0 text-[13px] font-bold uppercase tracking-[0.06em] text-muted">{col.topic}</h2>
            <div className="grid grid-cols-5 gap-1.5">
              {col.cells.map((cell) =>
                cell.state === "open" ? (
                  <button
                    key={cell.row}
                    type="button"
                    onClick={() => send({ type: "pickClue", column, row: cell.row })}
                    className="flex h-11 items-center justify-center rounded-lg bg-tile font-display text-[15px] font-bold text-accent hover:brightness-110"
                  >
                    {formatScore(cell.value)}
                  </button>
                ) : (
                  <span key={cell.row} className="flex h-11 items-center justify-center rounded-lg bg-[#121844] text-xs text-[#5a6399]">
                    {cell.state === "used" ? "Done" : "—"}
                  </span>
                ),
              )}
            </div>
          </div>
        ))}
      </div>

      {confirmEnd ? (
        <div className="flex gap-2">
          <Button variant="secondary" className="h-11 flex-1 text-[15px]" onClick={() => setConfirmEnd(false)}>
            Keep playing
          </Button>
          <Button className="h-11 flex-1 bg-bad text-[15px]" onClick={() => send({ type: "endRound" })}>
            End round
          </Button>
        </div>
      ) : (
        <Button variant="ghost" className="h-11 text-[15px]" onClick={() => setConfirmEnd(true)}>
          End this round now…
        </Button>
      )}
    </>
  );
}

// ---------- clue (buzzers open) ----------

function CluePanel({ lobby, send, clockOffset }: { lobby: LobbyView; send: Send; clockOffset: number }) {
  const current = lobby.game.current;
  const left = useCountdown(current?.buzzDeadline ?? null, clockOffset);
  if (!current) return null;
  const waiting = current.waitingForMedia;
  const closed = !waiting && (current.buzzExpired || left === 0);
  const canBuzz = lobby.teams.filter((t) => !current.lockedOutTeamIds.includes(t.id));

  return (
    <>
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-2 text-[15px] font-semibold ${closed ? "text-bad" : "text-accent"}`}>
          <Dot color={closed ? "#ff8a7a" : "#f5b83d"} size={10} />
          {waiting ? `Playing ${current.questionMedia?.type ?? "clip"} on the display` : closed ? "Buzzers locked" : "Buzzers open"}
        </span>
        <ClueHeader current={current} />
      </div>
      {waiting && (
        <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-3">
          <p className="m-0 text-sm text-muted">Buzzers open when it finishes. If it won't play, open them yourself.</p>
          <Button variant="secondary" className="h-12 text-[15px]" onClick={() => send({ type: "mediaFinished" })}>
            Open buzzers now
          </Button>
        </div>
      )}
      {!closed && !waiting && (
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">Time left to buzz</span>
          <span className="font-display text-3xl font-bold">{left}s</span>
        </div>
      )}
      <div className="flex flex-col gap-2 rounded-2xl bg-tile px-5 py-4">
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#d6dcff]">On screen</span>
        <p className="m-0 font-display text-[22px] font-bold leading-snug">{current.question}</p>
      </div>
      {current.questionMedia && <MediaPreview media={current.questionMedia} label="Clue file" />}
      <AnswerBox answer={current.answer} />
      {current.answerMedia && <MediaPreview media={current.answerMedia} label="Answer file (shown on reveal)" />}
      {!closed && !waiting && (
        <div className="flex flex-wrap gap-2">
          {canBuzz.map((t) => (
            <span key={t.id} className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm">
              <Dot color={teamColor(lobby, t.id)} size={8} />
              {t.name}
            </span>
          ))}
        </div>
      )}
      <ResultsSoFar lobby={lobby} current={current} />
      <Button variant={closed ? "primary" : "secondary"} className="mt-auto" onClick={() => send({ type: "reveal" })}>
        {closed ? "Show the answer" : "Skip · show the answer now"}
      </Button>
    </>
  );
}

// ---------- answering (a team buzzed) ----------

function AnsweringPanel({ lobby, send, clockOffset }: { lobby: LobbyView; send: Send; clockOffset: number }) {
  const current = lobby.game.current;
  const left = useCountdown(current?.answerDeadline ?? null, clockOffset);
  if (!current || !current.buzzedTeamId) return null;
  const color = teamColor(lobby, current.buzzedTeamId);

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[15px] text-muted">{current.answerExpired || left === 0 ? "Answer time's up" : `Answer time: ${left}s`}</span>
        <ClueHeader current={current} />
      </div>
      <div className="flex flex-col gap-1.5 rounded-2xl px-5 py-4" style={{ background: color, color: "var(--color-ink)" }}>
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] opacity-70">Buzzed in</span>
        <span className="font-display text-[28px] font-bold">{teamName(lobby, current.buzzedTeamId)}</span>
        {current.buzzedByName && <span className="text-[15px] opacity-80">{current.buzzedByName} pressed first · any teammate can answer</span>}
      </div>
      <AnswerBox answer={current.answer} />
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => send({ type: "judge", correct: true })}
          className="flex h-24 flex-col items-center justify-center gap-0.5 rounded-2xl bg-good text-ink hover:brightness-105"
        >
          <span className="font-display text-xl font-bold">Correct</span>
          <span className="text-[15px] font-semibold">+{formatScore(current.value)}</span>
        </button>
        <button
          type="button"
          onClick={() => send({ type: "judge", correct: false })}
          className="flex h-24 flex-col items-center justify-center gap-0.5 rounded-2xl bg-bad text-ink hover:brightness-105"
        >
          <span className="font-display text-xl font-bold">Wrong</span>
          <span className="text-[15px] font-semibold">−{formatScore(current.value)} · reopen</span>
        </button>
      </div>
      <ResultsSoFar lobby={lobby} current={current} />
      <Button variant="ghost" className="h-11 text-[15px]" onClick={() => send({ type: "reveal" })}>
        Skip · show the answer
      </Button>
    </>
  );
}

// ---------- reveal ----------

function RevealPanel({ lobby, send }: { lobby: LobbyView; send: Send }) {
  const { game } = lobby;
  const current = game.current;
  const anyLeft = game.board?.some((col) => col.cells.some((c) => c.state === "open")) ?? false;
  const lastRound = game.round ? game.round.index + 1 >= game.round.total : true;
  const next = anyLeft ? "Back to the board" : lastRound ? "Go to the final round" : "Next round";

  return (
    <>
      {current && <ClueHeader current={current} />}
      <PanelTitle>{current?.answer ?? "Answer"}</PanelTitle>
      {current?.answerMedia && <MediaPreview media={current.answerMedia} label="On screen now" />}
      {current && <p className="m-0 text-[15px] text-muted">{current.question}</p>}
      {current && <ResultsSoFar lobby={lobby} current={current} />}
      {current && current.results.length === 0 && <p className="m-0 text-muted">Nobody got this one.</p>}
      <Button className="mt-auto" onClick={() => send({ type: "continue" })}>
        {next}
      </Button>
    </>
  );
}

// ---------- round intro ----------

function RoundIntroPanel({ lobby, send }: { lobby: LobbyView; send: Send }) {
  const { game } = lobby;
  return (
    <>
      <PanelTitle sub={game.pickingTeamId ? `${teamName(lobby, game.pickingTeamId)} pick first (lowest score)` : undefined}>
        {game.round?.name ?? "Next round"}
      </PanelTitle>
      <p className="m-0 text-muted">The display is showing the round intro. Continue when everyone's ready.</p>
      <Button className="mt-auto" onClick={() => send({ type: "continue" })}>
        Show the board
      </Button>
    </>
  );
}
