/**
 * Room codes: 6 characters,
 */
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "BCDFGHJKMNPQRSTVWXZ23456789";

/** Make a random room code. The Worker checks for collisions and retries. */
export function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const b of bytes) code += ROOM_CODE_ALPHABET[b % ROOM_CODE_ALPHABET.length];
  return code;
}

/** Clean up what someone typed: trim spaces, uppercase. */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase();
}

/** True if the (normalized) code has the right length and only allowed characters. */
export function isValidRoomCode(code: string): boolean {
  if (code.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of code) if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  return true;
}
