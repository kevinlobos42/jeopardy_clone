import { useState } from "react";
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from "../../shared/roomCode.ts";
import { NAME_MAX } from "../../shared/types.ts";
import { Button, ErrorText, PhoneScreen, TextField, Title } from "../ui/kit.tsx";

export function Join({
  onBack,
  onSubmit,
  busy,
  error,
}: {
  onBack: () => void;
  onSubmit: (code: string, name: string) => void;
  busy: boolean;
  error: string | null;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = normalizeRoomCode(code);
    if (!isValidRoomCode(cleanCode)) {
      setLocalError(`Room codes are ${ROOM_CODE_LENGTH} letters and numbers.`);
      return;
    }
    if (!name.trim()) {
      setLocalError("Enter a name.");
      return;
    }
    setLocalError(null);
    onSubmit(cleanCode, name.trim());
  }

  return (
    <PhoneScreen>
      <button type="button" onClick={onBack} className="flex h-11 items-center gap-1.5 self-start text-base text-muted hover:text-text">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </button>

      <Title sub="The code is on the host's screen.">Join a game</Title>

      <form onSubmit={submit} className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="code" className="text-sm font-semibold text-muted">
            Room code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="K7BX4R"
            maxLength={ROOM_CODE_LENGTH}
            autoComplete="off"
            autoCapitalize="characters"
            className="h-[72px] rounded-2xl border-2 border-line bg-surface text-center font-display text-[34px] font-bold uppercase tracking-[0.35em] text-text outline-none placeholder:text-[#7f88bd] focus:border-accent"
          />
        </div>

        <TextField
          id="name"
          label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What should we call you?"
          maxLength={NAME_MAX}
          autoComplete="nickname"
        />

        <ErrorText>{localError ?? error}</ErrorText>

        <Button type="submit" className="mt-auto" disabled={busy}>
          {busy ? "Joining…" : "Join"}
        </Button>
      </form>
    </PhoneScreen>
  );
}
