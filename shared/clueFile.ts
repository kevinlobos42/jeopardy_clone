/**
 * The clue file the host uploads, described with Zod so it can be
 * checked before a game starts. Matches the format in game-rules.md.
 *
 * Shape checks only. A clue with an empty question or answer is still
 * VALID here; the game treats it as missing and skips it.
 */
import { z } from "zod";

export const CLUE_FILE_VERSION = 1;

const ClueSchema = z.object({
  question: z.string(),
  answer: z.string(),
  value: z.number().int().positive(),
  dailyDouble: z.boolean().optional(),
});

const ColumnSchema = z.object({
  topic: z.string().trim().min(1, "Every column needs a topic"),
  questions: z.array(ClueSchema).min(1, "Every column needs at least one clue"),
});

const BoardSchema = z.object({
  name: z.string().trim().min(1, "Every board needs a name"),
  columns: z.array(ColumnSchema).min(1, "Every board needs at least one column"),
});

const FinalSchema = z.object({
  topic: z.string().trim().min(1, "The final needs a topic"),
  question: z.string().trim().min(1, "The final needs a question"),
  answer: z.string().trim().min(1, "The final needs an answer"),
});

export const ClueFileSchema = z
  .object({
    version: z.literal(CLUE_FILE_VERSION),
    title: z.string().trim().min(1, "The file needs a title"),
    boards: z.array(BoardSchema).min(1, "The file needs at least one board"),
    final: FinalSchema,
  })
  .superRefine((file, ctx) => {
    // Board names must be unique (case-insensitive).
    const seen = new Set<string>();
    file.boards.forEach((board, i) => {
      const key = board.name.trim().toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({ code: "custom", path: ["boards", i, "name"], message: `Board name "${board.name}" is used twice` });
      }
      seen.add(key);
    });
  });

export type ClueFile = z.infer<typeof ClueFileSchema>;
export type Clue = z.infer<typeof ClueSchema>;

/** A clue counts as missing (skipped in play) if its question or answer is empty. */
export function isPlayable(clue: Clue): boolean {
  return clue.question.trim() !== "" && clue.answer.trim() !== "";
}

export type ParseClueFileResult =
  | { ok: true; file: ClueFile }
  | { ok: false; errors: string[] };

/**
 * Check uploaded text. Returns the file, or a list of readable errors
 * such as "boards[1].columns[0].questions[3].value: expected a number".
 */
export function parseClueFile(text: string): ParseClueFileResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["This file isn't valid JSON"] };
  }
  const result = ClueFileSchema.safeParse(data);
  if (result.success) return { ok: true, file: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((issue) => {
      const where = issue.path
        .map((part, i) => (typeof part === "number" ? `[${part}]` : i === 0 ? String(part) : `.${String(part)}`))
        .join("");
      return where ? `${where}: ${issue.message}` : issue.message;
    }),
  };
}
