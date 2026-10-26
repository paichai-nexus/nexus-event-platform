import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import type { MissionInput, MissionRepository } from "@/lib/repositories/missionRepository";
import type { CheerMission, MissionParticipation } from "@/types/mission";

const MOCK_EVENT_ID = "00000000-0000-4000-8000-000000000100";
type MissionStore = { missions: CheerMission[]; participations: MissionParticipation[] };
const globalForMissions = globalThis as typeof globalThis & { __missionStore?: MissionStore };
function store() { globalForMissions.__missionStore ??= { missions: [], participations: [] }; return globalForMissions.__missionStore; }
function assertEvent(eventId: string) { if (eventId !== MOCK_EVENT_ID) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404); }

export function resetMockMissions() { globalForMissions.__missionStore = { missions: [], participations: [] }; }

export class MockMissionRepository implements MissionRepository {
  async getAll(eventId: string) { assertEvent(eventId); return structuredClone(store()); }
  async create(eventId: string, input: MissionInput) {
    assertEvent(eventId);
    const mission = { id: crypto.randomUUID(), ...input };
    store().missions.push(mission);
    return structuredClone(mission);
  }
  async update(eventId: string, missionId: string, input: MissionInput) {
    assertEvent(eventId);
    const index = store().missions.findIndex((mission) => mission.id === missionId);
    if (index < 0) throw new DomainError("NOT_FOUND", "미션을 찾을 수 없습니다.", 404);
    store().missions[index] = { id: missionId, ...input };
    return structuredClone(store().missions[index]);
  }
  async reviewParticipation(eventId: string, participationId: string, status: "APPROVED" | "REJECTED") {
    assertEvent(eventId);
    const participation = store().participations.find((item) => item.id === participationId);
    if (!participation) throw new DomainError("NOT_FOUND", "참여 이력을 찾을 수 없습니다.", 404);
    const mission = store().missions.find((item) => item.id === participation.missionId);
    participation.status = status;
    participation.awardedPoints = status === "APPROVED" ? mission?.points ?? 0 : 0;
    return structuredClone(participation);
  }
}
