import type { Role } from "../shared/types.ts"
import type { ClueFile } from "../shared/clueFile.ts"

export type RoomState = {
    claimed: boolean
    hostId: string | null
    people: Record<string, Person>
    teams: Record<string, Team>
    game: GameState
}

export type ConnectionData = {
    personId: string
}

export type Person = {
    id: string
    key: string
    name: string
    role: Role | null
    teamId: string | null
}

export type Team = {
    id: string
    name: string
}

/** Every situation the game can be in. See "Phases" in game-rules.md. */
export type Phase =
    | "lobby"
    | "board"
    | "clue"
    | "answering"
    | "reveal"
    | "roundIntro"
    | "finalWager"
    | "finalClue"
    | "finalReveal"
    | "gameOver"

/** Timer lengths the host can change. Seconds. */
export type GameSettings = {
    buzzSeconds: number
    answerSeconds: number
    finalSeconds: number
}

export const DEFAULT_SETTINGS: GameSettings = {
    buzzSeconds: 8,
    answerSeconds: 5,
    finalSeconds: 30,
}

/**
 * Identifies one clue on the boards, as a string so it can live in lists
 * and lookups that save as JSON. HOW it's built from a clue's position
 * (round, column, row) is your point 5.
 */
export type ClueKey = string

/** One result on one clue: "Night Owls got 0-2-1 wrong, -400". */
export type ClueResult = {
    clueKey: ClueKey
    teamId: string
    correct: boolean
    /** Points added (negative when wrong). */
    points: number
}

/** Everything about the final round. Lookups are by team id. */
export type FinalState = {
    /** Each team's locked-in wager, 0 to 1,000. */
    wagers: Record<string, number>
    /** Each team's latest typed answer. */
    answers: Record<string, string>
    /** When the final answer timer ends (ms timestamp), or null if not started. */
    deadline: number | null
    /** The host's ruling for each team: true = correct, false = wrong. Missing = not judged yet. */
    judged: Record<string, boolean>
}

export type GameState = {
    phase: Phase
    /** The uploaded clue file, or null until the host uploads one. */
    clues: ClueFile | null
    settings: GameSettings
    /** Which round we're on: an index into clues.boards. */
    roundIndex: number

    /** Clues already played, across all rounds. */
    usedClues: ClueKey[]
    /** Team that picks the next clue, or null (host picks freely). */
    pickingTeamId: string | null
    /** Each team's score by team id. A team missing here has 0. */
    scores: Record<string, number>
    /** Every ruling the host made, in order. */
    history: ClueResult[]
    final: FinalState

    // Your part (points 5 and 9–12): how a ClueKey is built, the current
    // clue, who buzzed, locked-out teams, and the buzz/answer deadlines.
}

export function emptyRoomState(): RoomState{
    const room: RoomState = {
        claimed: false,
        hostId: null,
        people: {},
        teams: {},
        game: {
            phase: "lobby",
            clues: null,
            settings: { ...DEFAULT_SETTINGS },
            roundIndex: 0,
            usedClues: [],
            pickingTeamId: null,
            scores: {},
            history: [],
            final: { wagers: {}, answers: {}, deadline: null, judged: {} },
        },
    }
    return room
}