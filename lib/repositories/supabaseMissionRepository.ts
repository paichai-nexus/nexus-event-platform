import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import type { MissionInput, MissionRepository } from "@/lib/repositories/missionRepository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CheerMission, MissionParticipation } from "@/types/mission";

type MissionRow = { id: string; title: string; description: string; mission_type: CheerMission["type"]; points: number; status: CheerMission["status"]; experimental: boolean };
type ParticipationRow = { id: string; mission_id: string; participant_id: string; status: MissionParticipation["status"]; awarded_points: number; created_at: string };
const toMission = (row: MissionRow): CheerMission => ({ id: row.id, title: row.title, description: row.description, type: row.mission_type, points: row.points, status: row.status, experimental: row.experimental });
const toParticipation = (row: ParticipationRow): MissionParticipation => ({ id: row.id, missionId: row.mission_id, participantId: row.participant_id, status: row.status, awardedPoints: row.awarded_points, createdAt: row.created_at });

export class SupabaseMissionRepository implements MissionRepository {
  private async client() { const client = await createSupabaseServerClient(); if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503); return client; }
  async getAll(eventId: string) {
    const supabase = await this.client();
    const [missionResult, participationResult] = await Promise.all([
      supabase.from("cheer_missions").select("id, title, description, mission_type, points, status, experimental").eq("event_id", eventId).order("created_at"),
      supabase.from("mission_participations").select("id, mission_id, participant_id, status, awarded_points, created_at").eq("event_id", eventId).order("created_at", { ascending: false }),
    ]);
    if (missionResult.error || participationResult.error) throw new DomainError("DATABASE_ERROR", "응원 미션을 조회하지 못했습니다.", 500);
    return { missions: (missionResult.data as MissionRow[]).map(toMission), participations: (participationResult.data as ParticipationRow[]).map(toParticipation) };
  }
  async create(eventId: string, input: MissionInput) {
    const supabase = await this.client();
    const { data, error } = await supabase.from("cheer_missions").insert({ event_id: eventId, title: input.title, description: input.description, mission_type: input.type, points: input.points, status: input.status, experimental: input.experimental }).select("id, title, description, mission_type, points, status, experimental").single();
    if (error || !data) throw new DomainError("DATABASE_ERROR", "미션을 생성하지 못했습니다.", 500);
    return toMission(data as MissionRow);
  }
  async update(eventId: string, missionId: string, input: MissionInput) {
    const supabase = await this.client();
    const { data, error } = await supabase.from("cheer_missions").update({ title: input.title, description: input.description, mission_type: input.type, points: input.points, status: input.status, experimental: input.experimental }).eq("id", missionId).eq("event_id", eventId).select("id, title, description, mission_type, points, status, experimental").single();
    if (error || !data) throw new DomainError("DATABASE_ERROR", "미션을 수정하지 못했습니다.", 500);
    return toMission(data as MissionRow);
  }
  async reviewParticipation(eventId: string, participationId: string, status: "APPROVED" | "REJECTED") {
    const supabase = await this.client();
    const { data: participation } = await supabase.from("mission_participations").select("mission_id").eq("id", participationId).eq("event_id", eventId).single();
    if (!participation) throw new DomainError("NOT_FOUND", "참여 이력을 찾을 수 없습니다.", 404);
    const { data: mission } = await supabase.from("cheer_missions").select("points").eq("id", participation.mission_id).single();
    const { data, error } = await supabase.from("mission_participations").update({ status, awarded_points: status === "APPROVED" ? mission?.points ?? 0 : 0 }).eq("id", participationId).eq("event_id", eventId).select("id, mission_id, participant_id, status, awarded_points, created_at").single();
    if (error || !data) throw new DomainError("DATABASE_ERROR", "참여 승인 상태를 저장하지 못했습니다.", 500);
    return toParticipation(data as ParticipationRow);
  }
}
