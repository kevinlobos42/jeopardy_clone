import type { Role } from "../shared/types.ts"

export type RoomState = {
    claimed: boolean
    hostId: string | null
    people: Record<string, Person>
    teams: Record<string, Team>
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

export function emptyRoomState(): RoomState{
    const room: RoomState = {
        claimed: false,
        hostId: null,
        people: {},
        teams: {}
    }
    return room
}