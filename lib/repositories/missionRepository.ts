import type { CheerMission, MissionParticipation, MissionStatus, MissionType, ParticipationStatus } from "@/types/mission";

export type MissionInput = { title: string; description: string; type: MissionType; points: number; status: MissionStatus; experimental: boolean };

export interface MissionRepository {
  getAll(eventId: string): Promise<{ missions: CheerMission[]; participations: MissionParticipation[] }>;
  create(eventId: string, input: MissionInput): Promise<CheerMission>;
  update(eventId: string, missionId: string, input: MissionInput): Promise<CheerMission>;
  reviewParticipation(eventId: string, participationId: string, status: Exclude<ParticipationStatus, "PENDING">): Promise<MissionParticipation>;
}
