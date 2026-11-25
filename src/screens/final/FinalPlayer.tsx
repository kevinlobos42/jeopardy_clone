import { useEffect, useState } from "react";
import type { LobbyView } from "../../../shared/types.ts";
import type { ClientMessage } from "../../../shared/messages.ts";
import { useCountdown } from "../../room/countdown.ts";
import { Button, Dot, formatScore, ordinal, standings, teamColor } from "../../ui/kit.tsx";

type Send = (message: ClientMessage) => void;

function myFinalTeam(lobby: LobbyView) {
  return lobby.game.final?.teams.find((t) => t.teamId === lobby.you.teamId) ?? null;
}

// ---------- wager ----------

export function PlayerFinalWager({ lobby, send }: { lobby: LobbyView; send: Send }) {
  const final = lobby.game.final;
  const mine = myFinalTeam(lobby);
  const max = mine?.maxWager ?? 0;
  const [amount, setAmount] = useState<string>(mine?.wager != null ? String(mine.wager) : "");

  // When a teammate changes the wager, show their number.
  const serverWager = mine?.wager ?? null;
  useEffect(() => {
    if (serverWager !== null) setAmount(String(serverWager));
  }, [serverWager]);

  if (!final || !mine) return null;
  const value = Number(amount);
  const valid = amount.trim() !== "" && Number.isInteger(value) && value >= 0 && value <= max;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold uppercase tracking-[0.08em] text-accent">Final round · {final.topic}</span>
        <h1 className="m-0 font-display text-[30px] font-bold leading-tight tracking-tight">How much will your team wager?</h1>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) send({ type: "finalWager", amount: value });
        }}
      >
        <label htmlFor="wager" className="text-sm font-semibold text-muted">
          Wager (0 to {formatScore(max)})
        </label>
        <input
          id="wager"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="0"
          className="h-[72px] rounded-2xl border-2 border-accent bg-surface text-center font-display text-4xl font-bold outline-none"
        />
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Nothing", 0],
            ["Half", Math.floor(max / 2)],
            ["All in", max],
          ].map(([label, v]) => (
            <button
              key={label}
              type="button"
              onClick={() => setAmount(String(v))}
              className="h-11 rounded-[10px] bg-surface-2 text-[15px] font-semibold hover:brightness-125"
            >
              {label}
            </button>
          ))}
        </div>
        {!valid && amount.trim() !== "" && <p className="m-0 text-sm text-bad">Pick a number from 0 to {formatScore(max)}.</p>}
        <Button type="submit" disabled={!valid}>
          {mine.wagered ? "Update wager" : "Lock in wager"}
        </Button>
      </form>

      <p className="m-0 rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm leading-relaxed text-muted">
        {mine.wagered ? (
          <>
            Your team's wager: <strong className="text-text">{formatScore(mine.wager ?? 0)}</strong>. Anyone on the team can change it until the
            host shows the clue.
          </>
        ) : (
          "One wager per team. Anyone on the team can set it. No wager counts as 0."
        )}
      </p>
    </div>
  );
}

// ---------- answer ----------

export function PlayerFinalAnswer({ lobby, send, clockOffset }: { lobby: LobbyView; send: Send; clockOffset: number }) {
  const final = lobby.game.final;
  const mine = myFinalTeam(lobby);
  const left = useCountdown(final?.deadline ?? null, clockOffset);
  const [text, setText] = useState(mine?.answer ?? "");
  const serverAnswer = mine?.answer ?? null;
  const [dirty, setDirty] = useState(false);

  // Show a teammate's latest answer, unless you're in the middle of typing.
  useEffect(() => {
    if (!dirty && serverAnswer !== null) setText(serverAnswer);
  }, [serverAnswer, dirty]);

  if (!final || !mine) return null;
  const timeUp = final.expired || left === 0;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">Wagered {formatScore(mine.wager ?? 0)}</span>
        <span className={`font-display text-[28px] font-bold ${timeUp ? "text-bad" : "text-accent"}`}>
          {final.waitingForMedia ? "Watch the screen" : timeUp ? "Time's up" : `${left}s`}
        </span>
      </div>
      <div className="flex flex-col gap-2 rounded-2xl bg-tile px-5 py-4">
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#d6dcff]">{final.topic}</span>
        <p className="m-0 font-display text-[22px] font-bold leading-snug">{final.question}</p>
      </div>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send({ type: "finalAnswer", text: text.trim() });
          setDirty(false);
        }}
      >
        <label htmlFor="final" className="text-sm font-semibold text-muted">
          Your team's answer
        </label>
        <textarea
          id="final"
          rows={3}
          value={text}
          disabled={timeUp}
          onChange={(e) => {
            setText(e.target.value);
            setDirty(true);
          }}
          placeholder="Type your answer"
          maxLength={200}
          className="resize-none rounded-2xl border-2 border-accent bg-surface px-4 py-3.5 text-xl outline-none disabled:opacity-60"
        />
        <p className="m-0 text-sm text-muted">
          {mine.answered && !dirty ? "Sent. Shared with your team" : "Shared with your team."}
        </p>
        <Button type="submit" disabled={timeUp || text.trim() === ""}>
          {mine.answered ? "Send new answer" : "Send answer"}
        </Button>
      </form>
    </div>
  );
}

// ---------- reveal (waiting for the host) ----------

export function PlayerFinalReveal({ lobby }: { lobby: LobbyView }) {
  const mine = myFinalTeam(lobby);
  if (!mine) return null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <span className="text-sm font-semibold uppercase tracking-[0.08em] text-accent">Final round</span>
      {mine.correct === null ? (
        <>
          <h1 className="m-0 font-display text-4xl font-bold">Answers are in</h1>
        </>
      ) : (
        <>
          <h1 className={`m-0 font-display text-4xl font-bold ${mine.correct ? "text-good" : "text-bad"}`}>
            {mine.correct ? "You got it!" : "Not quite"}
          </h1>
          <p className="m-0 text-lg">
            {mine.correct ? "+" : "−"}
            {formatScore(mine.wager ?? 0)}
          </p>
        </>
      )}
      {mine.answer && <p className="m-0 text-base text-muted">Your answer: “{mine.answer}”</p>}
    </div>
  );
}

// ---------- game over ----------

export function PlayerGameOver({ lobby }: { lobby: LobbyView }) {
  const table = standings(lobby);
  const me = table.find((s) => s.teamId === lobby.you.teamId);
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col items-center gap-2 pt-6 text-center">
        <span className="text-sm font-semibold uppercase tracking-[0.1em] text-muted">Game over</span>
        {me && (
          <>
            <span className="font-display text-[80px] font-bold leading-none" style={{ color: teamColor(lobby, me.teamId) }}>
              {ordinal(me.place)}
            </span>
            <p className="m-0 text-lg">
              {me.name} finished with <strong>{formatScore(me.score)}</strong>
            </p>
          </>
        )}
      </div>
      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {table.map((s) => (
          <li
            key={s.teamId}
            className="flex min-h-16 items-center gap-3.5 rounded-2xl bg-surface px-[18px]"
            style={{ border: s.teamId === lobby.you.teamId ? `2px solid ${teamColor(lobby, s.teamId)}` : "1px solid var(--color-line)" }}
          >
            <span className={`w-7 font-display text-xl font-bold ${s.place === 1 ? "text-accent" : "text-muted"}`}>{s.place}</span>
            <Dot color={teamColor(lobby, s.teamId)} />
            <span className="flex-1 text-[17px] font-semibold">
              {s.name}
              {s.teamId === lobby.you.teamId && " (you)"}
            </span>
            <span className={`font-display text-xl font-bold ${s.score < 0 ? "text-bad" : ""}`}>{formatScore(s.score)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
