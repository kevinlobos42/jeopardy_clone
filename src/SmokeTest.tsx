import { useState } from "react";
import usePartySocket from "partysocket/react";

/**
 * SMOKE TEST page. Open it in two tabs and on your phone: anything you
 * send should appear on the others. Delete this once the lobby exists.
 */
export default function SmokeTest() {
  const [log, setLog] = useState<string[]>([]);
  const [text, setText] = useState("");

  const socket = usePartySocket({
    party: "room", // the kebab-case form of the "Room" binding in wrangler.jsonc
    room: "TEST", // the room code
    onMessage(event) {
      setLog((prev) => [...prev, String(event.data)]);
    },
  });

  function send() {
    if (!text.trim()) return;
    socket.send(text);
    setLog((prev) => [...prev, `me: ${text}`]);
    setText("");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-slate-950 p-6 text-slate-100">
      <h1 className="text-2xl font-bold">Smoke test · room TEST</h1>

      <ul className="flex flex-1 flex-col gap-2 rounded-xl bg-slate-900 p-4 text-sm">
        {log.length === 0 && <li className="text-slate-400">Waiting for messages…</li>}
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor="msg" className="sr-only">
          Message
        </label>
        <input
          id="msg"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something"
          className="h-12 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3"
        />
        <button type="submit" className="h-12 rounded-lg bg-amber-400 px-5 font-bold text-slate-950">
          Send
        </button>
      </form>
    </main>
  );
}
