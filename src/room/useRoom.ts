import { useCallback, useEffect, useRef, useState } from "react";
import PartySocket from "partysocket";
import { encode, type ClientMessage, type ErrorCode, type ServerMessage } from "../../shared/messages.ts";
import type { CreateRoomResponse, LobbyView } from "../../shared/types.ts";
import { clearSession, loadSession, saveSession } from "./session.ts";

export interface RoomError {
  code: ErrorCode | "NETWORK";
  message: string;
}

/**
 * Everything the screens need to talk to a room:
 * - `lobby`: the latest LobbyView from the server (null until joined)
 * - `hostRoom()`, `joinRoom(code, name)`, `send(message)`, `leave()`
 *
 * Reconnecting is automatic: PartySocket reopens dropped connections
 * (phone screen locks, Wi-Fi blips), and every time the socket opens we
 * send `rejoin` with the saved key.
 */
export function useRoom() {
  const [code, setCode] = useState<string | null>(() => loadSession()?.code ?? null);
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [error, setError] = useState<RoomError | null>(null);
  const [busy, setBusy] = useState(false);

  const socketRef = useRef<PartySocket | null>(null);
  // Name waiting to be sent as `join` once the socket opens.
  const pendingNameRef = useRef<string | null>(null);

  useEffect(() => {
    if (!code) return;

    const socket = new PartySocket({ host: window.location.host, party: "room", room: code });
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      const session = loadSession();
      if (session && session.code === code) {
        socket.send(encode({ type: "rejoin", key: session.key }));
      } else if (pendingNameRef.current) {
        socket.send(encode({ type: "join", name: pendingNameRef.current }));
      }
    });

    socket.addEventListener("message", (event: MessageEvent) => {
      let message: ServerMessage;
      try {
        message = JSON.parse(String(event.data)) as ServerMessage;
      } catch {
        return;
      }
      switch (message.type) {
        case "welcome":
          saveSession({ code, key: message.key });
          pendingNameRef.current = null;
          setError(null);
          setBusy(false);
          break;
        case "lobby":
          setLobby(message.lobby);
          setBusy(false);
          break;
        case "error":
          setError({ code: message.code, message: message.message });
          setBusy(false);
          // The room is gone or our key no longer works: forget it and go home.
          if (message.code === "ROOM_NOT_FOUND" || message.code === "BAD_KEY") {
            clearSession();
            pendingNameRef.current = null;
            setLobby(null);
            setCode(null);
          }
          break;
      }
    });

    return () => {
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [code]);

  const send = useCallback((message: ClientMessage) => {
    setError(null);
    socketRef.current?.send(encode(message));
  }, []);

  const joinRoom = useCallback(
    (roomCode: string, name: string) => {
      setError(null);
      setBusy(true);
      pendingNameRef.current = name;
      if (roomCode === code && socketRef.current?.readyState === WebSocket.OPEN) {
        // Already connected to this room (e.g. retrying after "name taken").
        socketRef.current.send(encode({ type: "join", name }));
      } else {
        setCode(roomCode);
      }
    },
    [code],
  );

  const hostRoom = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/rooms", { method: "POST" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const created = (await response.json()) as CreateRoomResponse;
      saveSession({ code: created.code, key: created.hostKey });
      setLobby(null);
      setCode(created.code);
    } catch {
      setBusy(false);
      setError({ code: "NETWORK", message: "Couldn't create a room. Check your connection and try again." });
    }
  }, []);

  const leave = useCallback(() => {
    clearSession();
    pendingNameRef.current = null;
    setLobby(null);
    setError(null);
    setBusy(false);
    setCode(null);
  }, []);

  /** True while we have a saved session but haven't received the lobby yet. */
  const reconnecting = code !== null && lobby === null && loadSession()?.code === code;

  return { code, lobby, error, busy, reconnecting, send, joinRoom, hostRoom, leave, clearError: () => setError(null) };
}

export type Room = ReturnType<typeof useRoom>;
