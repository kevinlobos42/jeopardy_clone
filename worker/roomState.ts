import type { Role } from "../shared/types.ts"
import type { ClueFile } from "../shared/clueFile.ts"
import { DEFAULT_SETTINGS, type CluePosition, type GameSettings, type Phase, type SoundKind } from "../shared/game.ts"

/**
 * Everything one room remembers. Private to the server: it contains
 * everyone's secret keys, so it is never sent to a browser as-is.
 * Must stay plain data (no Map/Set/classes) so it can be saved.
 */
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

/** Identifies one clue as a string ("round-column-row"), made with clueKey() in shared/game.ts. */
export type ClueKey = string

/** One result on one clue: "Night Owls got 0-2-1 wrong, -400". */
export type ClueResult = {
    clueKey: ClueKey
    teamId: string
    correct: boolean
    /** Points added (negative when wrong). */
    points: number
}

/** The clue that's open right now. Set to null in one go when it's finished. */
export type CurrentClue = {
    position: CluePosition
    /** Team answering right now, or null while buzzers are open. */
    buzzedTeamId: string | null
    buzzedPersonId: string | null
    /** Teams that got this clue wrong and can't buzz again. */
    lockedOutTeamIds: string[]
    /** When the buzz timer ends (ms timestamp). Reset after a wrong answer. */
    buzzDeadline: number | null
    /** When the answer timer ends (ms timestamp), while a team is answering. */
    answerDeadline: number | null
    /** Set once the buzz timer has run out (buzzers locked, sound played). */
    buzzExpired: boolean
    /** Set once the answer timer has run out (sound played). */
    answerExpired: boolean
}

/** Everything about the final round. Lookups are by team id. */
export type FinalState = {
    /** Each team's wager, 0 to 1,000. */
    wagers: Record<string, number>
    /** Each team's latest typed answer. */
    answers: Record<string, string>
    /** When the final answer timer ends (ms timestamp), or null if not started. */
    deadline: number | null
    expired: boolean
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
    current: CurrentClue | null
    final: FinalState
    /** Value of the last clue opened: what the host's +/- buttons use between clues. */
    lastClueValue: number
    /** Bumped whenever the display should play a sound. */
    soundSeq: number
    soundKind: SoundKind
}

export function emptyFinalState(): FinalState {
    return { wagers: {}, answers: {}, deadline: null, expired: false, judged: {} }
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
            current: null,
            final: emptyFinalState(),
            lastClueValue: 100,
            soundSeq: 0,
            soundKind: "none",
        },
    }
    return room
}
