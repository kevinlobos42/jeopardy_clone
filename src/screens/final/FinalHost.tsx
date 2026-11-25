import { useState } from "react";
import type { LobbyView } from "../../../shared/types.ts";
import type { ClientMessage } from "../../../shared/messages.ts";
import { useCountdown } from "../../room/countdown.ts";
import { Button, Dot, formatScore, scoreOf, standings, teamColor, teamName } from "../../ui/kit.tsx";
import { MediaPreview } from "../../ui/Media.tsx";

type Send = (message: ClientMessage) => void;

function Title({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">Final round</span>
      <h1 className="m-0 font-display text-[26px] font-bold leading-tight">{children}</h1>
      {sub && <p className="m-0 text-[15px] text-muted">{sub}</p>}
    </div>
  );
}

function AnswerBox({ answer }: { answer: string | null }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-dashed border-accent bg-surface px-5 py-3.5">
      <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">Correct answer</span>
      <span className="text-xl font-semibold">{answer ?? "?"}</span>
    </div>
  );
}

// ---------- wagers ----------

export function HostFinalWager({ lobby, send }: { lobby: LobbyView; send: Send }) {
  const final = lobby.game.final;
  if (!final) return null;
  const waiting = final.teams.filter((t) => !t.wagered).length;
  return (
    <>
      <Title sub={`Category: ${final.topic}`}>Teams are wagering</Title>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {final.teams.map((t) => (
          <li key={t.teamId} className="flex min-h-12 items-center gap-2.5 rounded-xl bg-surface px-3.5 text-[15px]">
            <Dot color={teamColor(lobby, t.teamId)} size={9} />
            <span className="flex-1 font-semibold">{teamName(lobby, t.teamId)}</span>
            {t.wagered ? (
              <span className="text-good">{formatScore(t.wager ?? 0)}</span>
            ) : (
              <span className="text-muted">Deciding… (max {formatScore(t.maxWager)})</span>
            )}
          </li>
        ))}
      </ul>
      <p className="m-0 text-sm text-muted">
        {waiting > 0 ? `${waiting} ${waiting === 1 ? "team hasn't" : "teams haven't"} wagered yet. No wager counts as 0.` : "Everyone has wagered."}
      </p>
      <Button className="mt-auto" onClick={() => send({ type: "showFinalClue" })}>
        Show the final clue
      </Button>
    </>
  );
}

// ---------- answering ----------

export function HostFinalClue({ lobby, send, clockOffset }: { lobby: LobbyView; send: Send; clockOffset: number }) {
  const final = lobby.game.final;
  const left = useCountdown(final?.deadline ?? null, clockOffset);
  if (!final) return null;
  const waiting = final.waitingForMedia;
  const timeUp = !waiting && (final.expired || left === 0);
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-[15px] text-muted">{waiting ? "Playing the clip on the display" : timeUp ? "Time's up" : "Teams are answering"}</span>
        <span className={`font-display text-[28px] font-bold ${timeUp ? "text-bad" : "text-accent"}`}>{waiting ? "" : timeUp ? "0s" : `${left}s`}</span>
      </div>
      {waiting && (
        <Button variant="secondary" className="h-12 text-[15px]" onClick={() => send({ type: "mediaFinished" })}>
          Start the timer now
        </Button>
      )}
      <div className="flex flex-col gap-2 rounded-2xl bg-tile px-5 py-4">
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#d6dcff]">{final.topic}</span>
        <p className="m-0 font-display text-[22px] font-bold leading-snug">{final.question}</p>
      </div>
      {final.questionMedia && <MediaPreview media={final.questionMedia} label="Clue file" />}
      <AnswerBox answer={final.answer} />
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {final.teams.map((t) => (
          <li key={t.teamId} className="flex min-h-12 items-center gap-2.5 rounded-xl bg-surface px-3.5 text-[15px]">
            <Dot color={teamColor(lobby, t.teamId)} size={9} />
            <span className="flex-1 font-semibold">{teamName(lobby, t.teamId)}</span>
            <span className={t.answered ? "text-good" : "text-muted"}>{t.answered ? "Answer in" : "Typing…"}</span>
          </li>
        ))}
      </ul>
      <Button variant={timeUp ? "primary" : "secondary"} className="mt-auto" onClick={() => send({ type: "closeFinal" })}>
        {timeUp ? "Reveal the answers" : "Stop now · reveal the answers"}
      </Button>
    </>
  );
}

// ---------- judging ----------

export function HostFinalReveal({ lobby, send }: { lobby: LobbyView; send: Send }) {
  const final = lobby.game.final;
  const [confirmFinish, setConfirmFinish] = useState(false);
  if (!final) return null;
  const unjudged = final.teams.filter((t) => t.correct === null).length;
  // Suggest revealing from the lowest score up, like the show.
  const order = [...final.teams].sort((a, b) => scoreOf(lobby, a.teamId) - scoreOf(lobby, b.teamId));

  return (
    <>
      <Title sub="Tap Correct or Wrong for each team.">Reveal each team</Title>
      <AnswerBox answer={final.answer} />
      <div className="flex flex-col gap-3">
        {order.map((t) => {
          const color = teamColor(lobby, t.teamId);
          return (
            <section key={t.teamId} className="flex flex-col gap-3 rounded-2xl border-2 bg-surface p-4" style={{ borderColor: t.correct === null ? "var(--color-line)" : t.correct ? "#7ee0a1" : "#ff8a7a" }}>
              <div className="flex items-center gap-2.5">
                <Dot color={color} size={11} />
                <span className="flex-1 font-display text-lg font-bold">{teamName(lobby, t.teamId)}</span>
                <span className="text-sm text-muted">has {formatScore(scoreOf(lobby, t.teamId))}</span>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xl font-semibold">{t.answer?.trim() ? `“${t.answer}”` : <span className="text-muted">No answer</span>}</span>
                <span className="shrink-0 text-sm text-muted">wager {formatScore(t.wager ?? 0)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => send({ type: "judgeFinal", teamId: t.teamId, correct: true })}
                  aria-pressed={t.correct === true}
                  className={`h-12 rounded-xl font-semibold ${t.correct === true ? "bg-good text-ink" : "bg-surface-2 text-good hover:brightness-125"}`}
                >
                  Correct +{formatScore(t.wager ?? 0)}
                </button>
                <button
                  type="button"
                  onClick={() => send({ type: "judgeFinal", teamId: t.teamId, correct: false })}
                  aria-pressed={t.correct === false}
                  className={`h-12 rounded-xl font-semibold ${t.correct === false ? "bg-bad text-ink" : "bg-surface-2 text-bad hover:brightness-125"}`}
                >
                  Wrong −{formatScore(t.wager ?? 0)}
                </button>
              </div>
            </section>
          );
        })}
      </div>
      {unjudged > 0 && !confirmFinish ? (
        <Button variant="secondary" onClick={() => setConfirmFinish(true)}>
          Show final standings…
        </Button>
      ) : unjudged > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm text-bad">
            {unjudged} {unjudged === 1 ? "team hasn't" : "teams haven't"} been judged. Their scores won't change.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConfirmFinish(false)}>
              Back
            </Button>
            <Button className="flex-1" onClick={() => send({ type: "finishGame" })}>
              Finish anyway
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => send({ type: "finishGame" })}>Show final standings</Button>
      )}
    </>
  );
}

// ---------- game over ----------

export function HostGameOver({ lobby, onLeave }: { lobby: LobbyView; onLeave: () => void }) {
  const table = standings(lobby);
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">Game over</span>
        <h1 className="m-0 font-display text-[26px] font-bold leading-tight">
          {table[0] ? `${table.filter((s) => s.place === 1).length > 1 ? "Winners" : "Winner"}: ${table.filter((s) => s.place === 1).map((s) => s.name).join(" & ")}` : "Thanks for playing"}
        </h1>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {table.map((s) => (
          <li key={s.teamId} className="flex min-h-12 items-center gap-3 rounded-xl bg-surface px-3.5">
            <span className={`w-6 font-display text-lg font-bold ${s.place === 1 ? "text-accent" : "text-muted"}`}>{s.place}</span>
            <Dot color={teamColor(lobby, s.teamId)} size={9} />
            <span className="flex-1 font-semibold">{s.name}</span>
            <span className={`font-display text-lg font-bold ${s.score < 0 ? "text-bad" : ""}`}>{formatScore(s.score)}</span>
          </li>
        ))}
      </ol>
      <Button variant="ghost" className="mt-auto" onClick={onLeave}>
        Leave room
      </Button>
    </>
  );
}
