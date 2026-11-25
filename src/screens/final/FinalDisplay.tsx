import type { ReactNode } from "react";
import type { LobbyView } from "../../../shared/types.ts";
import { useCountdown, useTimeFraction } from "../../room/countdown.ts";
import { Dot, formatScore, scoreOf, standings, teamColor, teamName } from "../../ui/kit.tsx";
import { MediaPlayer } from "../../ui/Media.tsx";

function Frame({ children, bg = "bg-ink" }: { children: ReactNode; bg?: string }) {
  return <main className={`flex min-h-dvh flex-col gap-6 px-10 py-8 text-text lg:px-14 ${bg}`}>{children}</main>;
}

function Header({ step }: { step: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="font-display text-2xl font-bold uppercase tracking-[0.1em] text-accent">Final round</span>
      <span className="text-xl text-muted">{step}</span>
    </div>
  );
}

/** One card per team: score plus a status line. */
function TeamStatusGrid({ lobby, status }: { lobby: LobbyView; status: (teamId: string) => { text: string; color: string } }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
      {lobby.teams.map((team) => {
        const s = status(team.id);
        const score = scoreOf(lobby, team.id);
        return (
          <div key={team.id} className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface px-5 py-3.5">
            <div className="flex items-center gap-3">
              <Dot color={teamColor(lobby, team.id)} size={14} />
              <span className="min-w-0 flex-1 truncate text-xl font-semibold">{team.name}</span>
              <span className={`font-display text-[26px] font-bold ${score < 0 ? "text-bad" : ""}`}>{formatScore(score)}</span>
            </div>
            <span className="text-base" style={{ color: s.color }}>
              {s.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const GOOD = "#7ee0a1";
const WAIT = "#a9b0d6";
const BAD = "#ff8a7a";

// ---------- wagers ----------

export function DisplayFinalWager({ lobby }: { lobby: LobbyView }) {
  const final = lobby.game.final;
  if (!final) return null;
  return (
    <Frame>
      <Header step="Step 1 of 3 · wagers" />
      <div className="m-auto flex flex-col items-center gap-3 text-center">
        <span className="text-2xl text-muted">The category is</span>
        <h1 className="m-0 font-display text-[clamp(56px,7.5vw,96px)] font-bold uppercase leading-none tracking-[0.02em]">{final.topic}</h1>
        <p className="m-0 text-[22px] text-muted">Teams, place your wagers on your phones</p>
      </div>
      <TeamStatusGrid
        lobby={lobby}
        status={(id) => {
          const t = final.teams.find((x) => x.teamId === id);
          return t?.wagered ? { text: "Wager locked in", color: GOOD } : { text: `Deciding… (up to ${formatScore(t?.maxWager ?? 0)})`, color: WAIT };
        }}
      />
    </Frame>
  );
}

// ---------- the clue ----------

export function DisplayFinalClue({ lobby, clockOffset, onMediaFinished }: { lobby: LobbyView; clockOffset: number; onMediaFinished: () => void }) {
  const final = lobby.game.final;
  const left = useCountdown(final?.deadline ?? null, clockOffset);
  const fraction = useTimeFraction(final?.deadline ?? null, lobby.game.settings.finalSeconds, clockOffset);
  if (!final) return null;
  const timeUp = final.expired || left === 0;
  return (
    <Frame>
      <Header step="Step 2 of 3 · answers" />
      <div className="m-auto flex w-full max-w-[1100px] flex-col items-center gap-6 rounded-3xl bg-tile px-12 py-10 text-center">
        <span className="font-display text-2xl font-bold uppercase tracking-[0.06em] text-[#d6dcff]">{final.topic}</span>
        {final.questionMedia && (
          <div className="flex max-h-[40vh] items-center justify-center">
            <MediaPlayer media={final.questionMedia} autoPlay={final.waitingForMedia} onFinished={onMediaFinished} className="max-h-[36vh]" />
          </div>
        )}
        <p className="m-0 font-display text-[clamp(32px,4vw,56px)] font-bold uppercase leading-tight">{final.question}</p>
        {final.waitingForMedia ? (
          <span className="rounded-full bg-ink/60 px-7 py-3 font-display text-2xl font-bold">The timer starts when it ends</span>
        ) : timeUp ? (
          <span className="rounded-full bg-bad px-7 py-3 font-display text-2xl font-bold text-ink">Time's up</span>
        ) : (
          <div className="flex items-center gap-4">
            <div aria-hidden="true" className="h-2 w-[360px] overflow-hidden rounded bg-ink/55">
              <div className="h-full bg-accent" style={{ width: `${fraction * 100}%` }} />
            </div>
            <span className="font-display text-[28px] font-bold">{left}s</span>
          </div>
        )}
      </div>
      <TeamStatusGrid
        lobby={lobby}
        status={(id) => (final.teams.find((x) => x.teamId === id)?.answered ? { text: "Answer in", color: GOOD } : { text: "Typing…", color: WAIT })}
      />
    </Frame>
  );
}

// ---------- reveal ----------

export function DisplayFinalReveal({ lobby }: { lobby: LobbyView }) {
  const final = lobby.game.final;
  if (!final) return null;
  const revealed = final.teams.filter((t) => t.correct !== null);
  return (
    <Frame>
      <Header step="Step 3 of 3 · reveal" />
      <div className="m-auto flex w-full flex-col items-center gap-6 text-center">
        <p className="m-0 max-w-[1000px] text-2xl leading-snug text-muted">{final.question}</p>
        {revealed.length === 0 ? (
          <p className="m-0 font-display text-5xl font-bold">Let's see what you wrote…</p>
        ) : (
          <div className="grid w-full max-w-[1150px] grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
            {revealed.map((t) => (
              <div
                key={t.teamId}
                className="flex flex-col items-center gap-2 rounded-2xl border-[3px] bg-surface px-6 py-5"
                style={{ borderColor: t.correct ? GOOD : BAD }}
              >
                <span className="inline-flex items-center gap-2.5 text-xl font-semibold">
                  <Dot color={teamColor(lobby, t.teamId)} size={12} />
                  {teamName(lobby, t.teamId)} wrote
                </span>
                <span className="font-display text-[40px] font-bold leading-tight text-accent">{t.answer?.trim() ? t.answer : "(nothing)"}</span>
                <span className="text-lg" style={{ color: t.correct ? GOOD : BAD }}>
                  Wagered {formatScore(t.wager ?? 0)} · {t.correct ? "Correct" : "Wrong"} · now {formatScore(scoreOf(lobby, t.teamId))}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <TeamStatusGrid
        lobby={lobby}
        status={(id) => {
          const t = final.teams.find((x) => x.teamId === id);
          if (t?.correct === null || t?.correct === undefined) return { text: "Up next", color: WAIT };
          return t.correct ? { text: "Revealed · correct", color: GOOD } : { text: "Revealed · wrong", color: BAD };
        }}
      />
    </Frame>
  );
}

// ---------- game over ----------

export function DisplayGameOver({ lobby }: { lobby: LobbyView }) {
  const table = standings(lobby);
  const winners = table.filter((s) => s.place === 1);
  // Podium order: 2nd, 1st, 3rd.
  const podium = [table[1], table[0], table[2]].filter(Boolean);
  const heights: Record<number, string> = { 1: "h-[260px]", 2: "h-[180px]", 3: "h-[120px]" };
  const rest = table.slice(3);

  return (
    <Frame>
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-[22px] uppercase tracking-[0.12em] text-muted">Final standings</span>
        <h1 className="m-0 font-display text-[clamp(44px,5.5vw,72px)] font-bold leading-tight tracking-tight">
          {winners.length ? `${winners.length > 1 ? "Winners" : "Winner"}: ${winners.map((w) => w.name).join(" & ")}` : "Thanks for playing"}
        </h1>
        {lobby.game.final?.answer && <span className="text-xl text-muted">Final answer: {lobby.game.final.answer}</span>}
        {lobby.game.final?.answerMedia?.type === "image" && (
          <img src={lobby.game.final.answerMedia.src} alt="" className="max-h-[22vh] rounded-xl object-contain" />
        )}
      </div>
      <div className="flex flex-1 items-end justify-center gap-5">
        {podium.map((s) => (
          <div key={s.teamId} className="flex w-[300px] flex-col items-center gap-3">
            <span className={`font-semibold ${s.place === 1 ? "text-[26px]" : "text-[22px]"}`}>{s.name}</span>
            <span className={`font-display font-bold ${s.place === 1 ? "text-[52px] text-accent" : "text-[40px]"} ${s.score < 0 ? "text-bad" : ""}`}>
              {formatScore(s.score)}
            </span>
            <div
              className={`flex w-full justify-center rounded-t-2xl pt-4 font-display font-bold ${heights[s.place] ?? "h-[100px]"} ${s.place === 1 ? "bg-tile text-[72px] text-accent" : "bg-surface text-[52px] text-muted"}`}
              style={{ borderTop: `8px solid ${teamColor(lobby, s.teamId)}` }}
            >
              {s.place}
            </div>
          </div>
        ))}
      </div>
      {rest.length > 0 && (
        <div className="flex flex-wrap justify-center gap-3">
          {rest.map((s) => (
            <span key={s.teamId} className="inline-flex items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-2 text-lg">
              {s.place}. {s.name} · {formatScore(s.score)}
            </span>
          ))}
        </div>
      )}
    </Frame>
  );
}
