import { Button, ErrorText, PhoneScreen } from "../ui/kit.tsx";

const TILES = ["100", "200", "300", "400", "", "500"];

export function Home({
  onJoin,
  onHost,
  busy,
  error,
}: {
  onJoin: () => void;
  onHost: () => void;
  busy: boolean;
  error: string | null;
}) {
  return (
    <PhoneScreen className="justify-between">
      <div className="flex flex-col items-center gap-7 pt-20">
        <img src="/logo.png" alt="NOT Jeopardy" />
        <div aria-hidden="true" className="grid w-56 grid-cols-3 gap-1.5">
          {TILES.map((t, i) => (
            <div
              key={i}
              className={`flex h-13 items-center justify-center rounded-md font-display text-xl font-bold text-accent ${t ? "bg-tile" : "bg-surface"}`}
            >
              {t}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={onJoin}>Join a game</Button>
        <Button variant="secondary" onClick={onHost} disabled={busy}>
          {busy ? "Creating room…" : "Host a game"}
        </Button>
        <ErrorText>{error}</ErrorText>
      </div>
    </PhoneScreen>
  );
}
