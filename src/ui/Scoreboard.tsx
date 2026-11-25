import type { LobbyView } from "../../shared/types.ts";
import { formatScore, scoreOf, teamColor } from "./kit.tsx";

/**
 * Team scores. For the host, each team gets − / + buttons that change the
 * score by `amount` (the current clue's value, or the last one).
 */
export function Scoreboard({
  lobby,
  onAdjust,
  compact = false,
}: {
  lobby: LobbyView;
  onAdjust?: (teamId: string, amount: number) => void;
  compact?: boolean;
}) {
  const amount = lobby.game.adjustAmount;
  return (
    <section aria-label="Scores" className="flex flex-col gap-2">
      {onAdjust && (
        <div className="flex items-baseline justify-between">
          <h2 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted">Scores</h2>
          <span className="text-[13px] text-muted">± {formatScore(amount)}</span>
        </div>
      )}
      <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-1"}`}>
        {lobby.teams.map((team) => {
          const score = scoreOf(lobby, team.id);
          return (
            <div
              key={team.id}
              className="flex min-h-12 items-center gap-2.5 rounded-xl border border-line px-3 py-1.5"
              style={{ background: teamColor(lobby, team.id), color: "var(--color-ink)" }}
            >
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{team.name}</span>
              <span className="font-display text-lg font-bold">{formatScore(score)}</span>
              {onAdjust && (
                <span className="flex gap-1">
                  <button
                    type="button"
                    aria-label={`Take ${amount} from ${team.name}`}
                    onClick={() => onAdjust(team.id, -amount)}
                    className="size-10 rounded-lg bg-surface-2 text-lg text-text hover:brightness-125"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    aria-label={`Give ${amount} to ${team.name}`}
                    onClick={() => onAdjust(team.id, amount)}
                    className="size-10 rounded-lg bg-surface-2 text-lg text-text hover:brightness-125"
                  >
                    +
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
