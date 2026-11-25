import { useCallback, useEffect, useRef, useState } from "react";
import type { SoundKind } from "../../shared/game.ts";

/**
 * Game sounds for the display.
 *
 * Your MP3s go in public/sounds/ with these names (any you leave out fall
 * back to a built-in tone, except the thinking music, which just stays silent):
 *
 *   think.mp3    thinking music while buzzers are open (and during the final clue)
 *   correct.mp3  right answer
 *   wrong.mp3    wrong answer
 *   timeout.mp3  a timer ran out (buzz, answer or final)
 *   buzz.mp3     someone buzzed in (optional)
 *
 * Browsers only allow sound after someone clicks the page, so the display
 * shows a "Tap to enable sound" button that calls `enable()` once.
 */

type FileKey = "think" | "correct" | "wrong" | "timeUp" | "buzz";

const FILES: Record<FileKey, string> = {
  think: "/sounds/think.mp3",
  correct: "/sounds/correct.mp3",
  wrong: "/sounds/wrong.mp3",
  timeUp: "/sounds/timeout.mp3",
  buzz: "/sounds/buzz.mp3",
};

// ---------- built-in fallback tones ----------

type Note = { freq: number; start: number; dur: number; type?: OscillatorType; gain?: number };

const TONES: Record<Exclude<SoundKind, "none">, Note[]> = {
  buzz: [{ freq: 520, start: 0, dur: 0.28, type: "square", gain: 0.18 }],
  correct: [
    { freq: 660, start: 0, dur: 0.14, type: "triangle" },
    { freq: 990, start: 0.13, dur: 0.26, type: "triangle" },
  ],
  wrong: [{ freq: 150, start: 0, dur: 0.5, type: "sawtooth", gain: 0.15 }],
  timeUp: [
    { freq: 880, start: 0, dur: 0.16, type: "sine" },
    { freq: 660, start: 0.2, dur: 0.16, type: "sine" },
    { freq: 440, start: 0.4, dur: 0.36, type: "sine" },
  ],
};

function playTones(ctx: AudioContext, kind: Exclude<SoundKind, "none">) {
  const now = ctx.currentTime;
  for (const note of TONES[kind]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.type ?? "sine";
    osc.frequency.value = note.freq;
    const peak = note.gain ?? 0.25;
    gain.gain.setValueAtTime(0.0001, now + note.start);
    gain.gain.exponentialRampToValueAtTime(peak, now + note.start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + note.start);
    osc.stop(now + note.start + note.dur + 0.02);
  }
}

// ---------- the hook ----------

export function useGameSounds() {
  const ctxRef = useRef<AudioContext | null>(null);
  const filesRef = useRef<Partial<Record<FileKey, HTMLAudioElement>>>({});
  const readyRef = useRef<Partial<Record<FileKey, boolean>>>({});
  const [enabled, setEnabled] = useState(false);

  const enable = useCallback(async () => {
    try {
      ctxRef.current ??= new AudioContext();
      await ctxRef.current.resume();
      // Load each MP3 once. A missing file fires "error" and we use the tone instead.
      for (const key of Object.keys(FILES) as FileKey[]) {
        if (filesRef.current[key]) continue;
        const audio = new Audio(FILES[key]);
        audio.preload = "auto";
        audio.addEventListener("canplaythrough", () => (readyRef.current[key] = true), { once: true });
        audio.addEventListener("error", () => (readyRef.current[key] = false), { once: true });
        audio.load();
        filesRef.current[key] = audio;
      }
      setEnabled(ctxRef.current.state === "running");
    } catch {
      setEnabled(false);
    }
  }, []);

  const play = useCallback((kind: SoundKind) => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running" || kind === "none") return;
    const audio = filesRef.current[kind];
    if (audio && readyRef.current[kind]) {
      audio.currentTime = 0;
      audio.play().catch(() => playTones(ctx, kind));
    } else {
      playTones(ctx, kind);
    }
  }, []);

  /** Start (from the beginning) or stop the thinking music. */
  const setThinking = useCallback((on: boolean) => {
    const audio = filesRef.current.think;
    if (!audio) return;
    if (on) {
      if (!readyRef.current.think) return;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
  }, []);

  return { enabled, enable, play, setThinking };
}

/**
 * Plays the server's sound whenever its counter goes up. The first value
 * seen is skipped, so refreshing the display doesn't replay an old sound.
 */
export function useServerSound(seq: number | null, kind: SoundKind, play: (kind: SoundKind) => void) {
  const lastSeq = useRef<number | null>(null);
  useEffect(() => {
    if (seq === null) {
      lastSeq.current = null; // not in a room: the next value seen counts as "first"
      return;
    }
    if (lastSeq.current !== null && seq > lastSeq.current) play(kind);
    lastSeq.current = seq;
  }, [seq, kind, play]);
}

/** Thinking music follows `active`: starts when it turns true, stops when it turns false. */
export function useThinkingMusic(active: boolean, enabled: boolean, setThinking: (on: boolean) => void) {
  useEffect(() => {
    if (!enabled) return;
    setThinking(active);
    return () => setThinking(false);
  }, [active, enabled, setThinking]);
}

/** The display's one-time "enable sound" button. Renders nothing once sound is on. */
export function SoundButton({ enabled, onEnable }: { enabled: boolean; onEnable: () => void }) {
  if (enabled) return null;
  return (
    <button
      type="button"
      onClick={onEnable}
      className="fixed bottom-4 right-4 z-10 inline-flex items-center gap-2.5 rounded-full border border-line bg-surface px-5 py-3 text-base font-semibold text-text shadow-lg hover:bg-surface-2"
    >
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4V5z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
      Tap to enable sound
    </button>
  );
}
