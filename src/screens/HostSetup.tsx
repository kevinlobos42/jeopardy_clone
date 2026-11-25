import { useEffect, useRef, useState } from "react";
import { SETTING_LIMITS, type CluesSummary, type GameSettings, type GameView } from "../../shared/game.ts";
import { checkMediaLoads } from "../ui/Media.tsx";

/** Host lobby section: upload the clue file and see what loaded (or what's wrong). */
export function ClueUpload({
  game,
  errors,
  onLoad,
}: {
  game: GameView;
  errors: string[] | null;
  onLoad: (text: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const summary = game.clues;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again after fixing it
    if (!file) return;
    try {
      setReadError(null);
      onLoad(await file.text());
    } catch {
      setReadError("Couldn't read that file.");
    }
  }

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">Clues</h2>
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent">
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
              <path d="M14 3v6h6" />
            </svg>
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-base font-semibold">{summary ? summary.title : "No clue file yet"}</span>
            <span className="text-[13px] text-muted">
              {summary
                ? `Loaded · ${summary.rounds.reduce((n, r) => n + r.clues, 0)} clues`
                : "Upload your .json file"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-11 shrink-0 rounded-[10px] border border-line px-3.5 text-sm font-semibold hover:bg-surface-2"
          >
            {summary ? "Replace" : "Upload"}
          </button>
          <input ref={inputRef} type="file" accept=".json,application/json" className="hidden" onChange={onFile} aria-label="Clue file" />
        </div>

        {summary && (
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {summary.rounds.map((r) => (
              <li key={r.name} className="flex justify-between gap-3">
                <span>{r.name}</span>
                <span className="text-muted">
                  {r.columns} categories · {r.clues} clues
                </span>
              </li>
            ))}
            <li className="flex justify-between gap-3">
              <span>Final round</span>
              <span className="text-muted">{summary.finalTopic}</span>
            </li>
          </ul>
        )}

        {summary && summary.skipped.length > 0 && (
          <div className="flex flex-col gap-1 rounded-[10px] border border-accent/60 bg-accent/10 px-3 py-2.5 text-[13px] leading-snug">
            <span className="font-semibold text-accent">Skipped (empty question or answer):</span>
            {summary.skipped.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        )}

        {summary && summary.media.length > 0 && <MediaCheck media={summary.media} />}

        {(errors || readError) && (
          <div role="alert" className="flex flex-col gap-1 rounded-[10px] border border-bad bg-bad/10 px-3 py-2.5 text-[13px] leading-snug">
            <span className="font-semibold text-bad">That file couldn't be loaded:</span>
            {readError && <span>{readError}</span>}
            {errors?.slice(0, 8).map((err) => (
              <span key={err} className="break-words">
                {err}
              </span>
            ))}
            {errors && errors.length > 8 && <span className="text-muted">…and {errors.length - 8} more</span>}
          </div>
        )}
      </div>
    </section>
  );
}

const ROWS: { key: keyof GameSettings; label: string; hint: string }[] = [
  { key: "buzzSeconds", label: "Time to buzz", hint: "Then buzzers lock" },
  { key: "answerSeconds", label: "Time to answer", hint: "After a buzz; plays a sound" },
  { key: "finalSeconds", label: "Final round answer", hint: "Time to type an answer" },
];

/** Host lobby section: the three timer lengths. */
export function TimerSettings({ settings, onChange }: { settings: GameSettings; onChange: (s: GameSettings) => void }) {
  function step(key: keyof GameSettings, delta: number) {
    const { min, max } = SETTING_LIMITS[key];
    const next = Math.min(max, Math.max(min, settings[key] + delta));
    if (next !== settings[key]) onChange({ ...settings, [key]: next });
  }

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">Timers</h2>
      <div className="flex flex-col rounded-2xl border border-line bg-surface px-4 py-1">
        {ROWS.map((row, i) => (
          <div key={row.key} className={`flex min-h-[60px] items-center justify-between gap-3 ${i < ROWS.length - 1 ? "border-b border-line" : ""}`}>
            <span className="flex flex-col gap-0.5">
              <span className="text-base font-semibold">{row.label}</span>
              <span className="text-[13px] text-muted">{row.hint}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={`Less: ${row.label}`}
                onClick={() => step(row.key, row.key === "finalSeconds" ? -5 : -1)}
                className="size-11 rounded-[10px] bg-surface-2 text-xl hover:brightness-125"
              >
                −
              </button>
              <span className="w-11 text-center font-display text-xl font-bold">{settings[row.key]}s</span>
              <button
                type="button"
                aria-label={`More: ${row.label}`}
                onClick={() => step(row.key, row.key === "finalSeconds" ? 5 : 1)}
                className="size-11 rounded-[10px] bg-surface-2 text-xl hover:brightness-125"
              >
                +
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Loads every image/audio/video in the clue file on this phone and lists any that fail. */
function MediaCheck({ media }: { media: CluesSummary["media"] }) {
  const [state, setState] = useState<{ checking: boolean; failed: CluesSummary["media"] }>({ checking: true, failed: [] });
  const key = media.map((m) => m.src).join("|");

  useEffect(() => {
    let cancelled = false;
    setState({ checking: true, failed: [] });
    Promise.all(media.map(async (m) => ((await checkMediaLoads(m)) ? null : m))).then((results) => {
      if (!cancelled) setState({ checking: false, failed: results.filter((m) => m !== null) });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (state.checking) {
    return <p className="m-0 text-[13px] text-muted">Checking {media.length} files…</p>;
  }
  if (state.failed.length === 0) {
    return <p className="m-0 text-[13px] text-good">All {media.length} files load.</p>;
  }
  return (
    <div role="alert" className="flex flex-col gap-1 rounded-[10px] border border-bad bg-bad/10 px-3 py-2.5 text-[13px] leading-snug">
      <span className="font-semibold text-bad">
        {state.failed.length} of {media.length} files didn't load:
      </span>
      {state.failed.map((m) => (
        <span key={m.where + m.src} className="break-all">
          {m.where}: {m.src}
        </span>
      ))}
      <span className="text-muted">Check the link opens the file itself (not a page), then upload the clue file again.</span>
    </div>
  );
}
