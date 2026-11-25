import { useEffect, useRef } from "react";
import type { MediaView } from "../../shared/game.ts";

/**
 * Shows a clue's image, or plays its audio / video.
 *
 * - `autoPlay`: play audio/video straight away (the display, once per clue).
 * - `onFinished`: called once when audio/video ends, fails to load, or the
 *   browser refuses to play it, so the game never gets stuck waiting.
 */
export function MediaPlayer({
  media,
  autoPlay,
  onFinished,
  className = "max-h-full",
}: {
  media: MediaView;
  autoPlay: boolean;
  onFinished?: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLMediaElement | null>(null);
  const reported = useRef(false);
  const finish = () => {
    if (reported.current) return;
    reported.current = true;
    onFinished?.();
  };

  useEffect(() => {
    reported.current = false;
    const el = ref.current;
    if (!el) return;
    if (!autoPlay) {
      el.pause(); // e.g. the host opened buzzers early: stop the clip
      return;
    }
    el.currentTime = 0;
    el.play().catch(() => finish()); // e.g. autoplay blocked: don't hold the game up
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.src, autoPlay]);

  if (media.type === "image") {
    return <img src={media.src} alt="" className={`max-w-full rounded-2xl object-contain ${className}`} />;
  }

  if (media.type === "audio") {
    return (
      <div className={`flex items-center gap-3 rounded-full bg-ink/60 px-6 py-3 text-xl ${className}`}>
        <svg aria-hidden="true" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
        {autoPlay ? "Listen…" : "Audio clue"}
        <audio
          ref={(el) => {
            ref.current = el;
          }}
          src={media.src}
          preload="auto"
          onEnded={finish}
          onError={finish}
        />
      </div>
    );
  }

  return (
    <video
      ref={(el) => {
        ref.current = el;
      }}
      src={media.src}
      preload="auto"
      playsInline
      onEnded={finish}
      onError={finish}
      className={`max-w-full rounded-2xl bg-black ${className}`}
    />
  );
}

/** Small preview for the host's phone: a thumbnail, or a label for audio/video. */
export function MediaPreview({ media, label }: { media: MediaView; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
      {media.type === "image" ? (
        <img src={media.src} alt="" className="size-14 shrink-0 rounded-lg bg-ink object-cover" />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[13px] font-semibold uppercase text-muted">
          {media.type}
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">{label}</span>
        <span className="truncate text-sm">{media.src.split("/").pop()}</span>
      </span>
    </div>
  );
}

/** Try to load a media file in this browser. Resolves true if it loads, false if not (or after 15s). */
export function checkMediaLoads(media: { type: MediaView["type"]; src: string }): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => done(false), 15000);
    function done(ok: boolean) {
      clearTimeout(timer);
      resolve(ok);
    }
    if (media.type === "image") {
      const img = new Image();
      img.onload = () => done(true);
      img.onerror = () => done(false);
      img.src = media.src;
      return;
    }
    const el = document.createElement(media.type);
    el.preload = "metadata";
    el.onloadedmetadata = () => done(true);
    el.onerror = () => done(false);
    el.src = media.src;
  });
}
