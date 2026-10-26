import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import type { EventControlRepository, EventControlSnapshot } from "@/lib/repositories/eventControlRepository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DisplayMode, EventMode, EventStatus, ResultStatus } from "@/types/event";
import type { VotingStatus } from "@/types/voting";

type EventRow = {
  id: string;
  mode: EventMode;
  status: EventStatus;
  voting_status: VotingStatus;
  version: number;
  active_team_id: string | null;
  display_mode: DisplayMode;
  result_status: ResultStatus;
  reveal_step: number;
};

function toSnapshot(row: EventRow): EventControlSnapshot {
  return {
    eventId: row.id,
    mode: row.mode,
    status: row.status,
    votingStatus: row.voting_status,
    version: Number(row.version),
    activeTeamId: row.active_team_id,
    displayMode: row.display_mode,
    resultStatus: row.result_status,
    revealStep: Number(row.reveal_step),
  };
}

const SNAPSHOT_COLUMNS = "id, mode, status, voting_status, version, active_team_id, display_mode, result_status, reveal_step";

export class SupabaseEventControlRepository implements EventControlRepository {
  private async client() {
    const client = await createSupabaseServerClient();
    if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
    return client;
  }

  async getSnapshot(eventId?: string) {
    const supabase = await this.client();
    let query = supabase.from("events").select(SNAPSHOT_COLUMNS);
    query = eventId ? query.eq("id", eventId) : query.order("starts_at", { ascending: false }).limit(1);
    const { data, error } = await query.single();
    if (error || !data) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
    return toSnapshot(data as EventRow);
  }

  async setVotingStatus(eventId: string, status: VotingStatus) {
    const supabase = await this.client();
    const { data, error } = await supabase.rpc("set_event_voting_status", { p_event_id: eventId, p_status: status });
    if (error || !data) throw new DomainError("DATABASE_ERROR", "청중평가 상태를 변경하지 못했습니다.", 500);
    return toSnapshot(data as EventRow);
  }

  async setMode(eventId: string, mode: EventMode) {
    const supabase = await this.client();
    const { data, error } = await supabase.rpc("set_event_mode", { p_event_id: eventId, p_mode: mode });
    if (error || !data) throw new DomainError("DATABASE_ERROR", "행사 모드를 변경하지 못했습니다.", 500);
    return toSnapshot(data as EventRow);
  }

  async setStatus(eventId: string, status: EventStatus) {
    const supabase = await this.client();
    const { data, error } = await supabase.rpc("set_event_status", { p_event_id: eventId, p_status: status });
    if (error || !data) throw new DomainError("DATABASE_ERROR", "행사 상태를 변경하지 못했습니다.", 500);
    return toSnapshot(data as EventRow);
  }

  async setActiveTeam(eventId: string, teamId: string | null) {
    if (!teamId) throw new DomainError("VALIDATION_ERROR", "발표팀을 선택해주세요.", 422);
    const supabase = await this.client();
    const { data, error } = await supabase.rpc("activate_event_team", { p_event_id: eventId, p_team_id: teamId });
    if (error || !data) throw new DomainError("DATABASE_ERROR", "발표팀을 시작하지 못했습니다.", 500);
    return toSnapshot(data as EventRow);
  }

  async completeActiveTeam(eventId: string) {
    const supabase = await this.client();
    const { data, error } = await supabase.rpc("complete_event_team", { p_event_id: eventId });
    if (error || !data) throw new DomainError("DATABASE_ERROR", "발표팀을 완료하지 못했습니다.", 500);
    return toSnapshot(data as EventRow);
  }

  async setDisplayMode(eventId: string, displayMode: DisplayMode) {
    const supabase = await this.client();
    const { data, error } = await supabase.rpc("set_event_display_mode", { p_event_id: eventId, p_display_mode: displayMode });
    if (error || !data) throw new DomainError("DATABASE_ERROR", "전광판 모드를 변경하지 못했습니다.", 500);
    return toSnapshot(data as EventRow);
  }

  async setRevealStep(eventId: string, revealStep: number) {
    const supabase = await this.client();
    const { data, error } = await supabase.rpc("set_event_reveal_step", { p_event_id: eventId, p_reveal_step: revealStep });
    if (error || !data) throw new DomainError("DATABASE_ERROR", "수상 공개 단계를 변경하지 못했습니다.", 500);
    return toSnapshot(data as EventRow);
  }

  async resetRehearsal(eventId: string) {
    const supabase = await this.client();
    const { error } = await supabase.rpc("reset_rehearsal_event", { p_event_id: eventId });
    if (error) throw new DomainError("DATABASE_ERROR", "리허설 데이터를 초기화하지 못했습니다.", 500);
    return this.getSnapshot(eventId);
  }
}
