import "server-only";

import { z } from "zod";
import { DomainError } from "@/lib/errors/domainError";
import type { EventControlRepository } from "@/lib/repositories/eventControlRepository";
import { canTransitionEvent } from "@/features/event/lib/eventStateMachine";

export const eventControlInputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SET_VOTING"), eventId: z.string().uuid(), status: z.enum(["READY", "OPEN", "CLOSED"]) }),
  z.object({ action: z.literal("SET_MODE"), eventId: z.string().uuid(), mode: z.enum(["REHEARSAL", "LIVE"]) }),
  z.object({
    action: z.literal("SET_STATUS"),
    eventId: z.string().uuid(),
    status: z.enum(["SETUP", "CHECK_IN_OPEN", "VOTING_READY", "VOTING_OPEN", "VOTING_CLOSED", "JUDGING", "SCORING", "FINALIZED", "ENDED"]),
  }),
  z.object({ action: z.literal("RESET_REHEARSAL"), eventId: z.string().uuid() }),
  z.object({ action: z.literal("ACTIVATE_TEAM"), eventId: z.string().uuid(), teamId: z.string().min(1) }),
  z.object({ action: z.literal("COMPLETE_TEAM"), eventId: z.string().uuid() }),
  z.object({ action: z.literal("SET_DISPLAY"), eventId: z.string().uuid(), displayMode: z.enum(["SPOTLIGHT", "VOTE_PROGRESS", "HOLDING", "AWARD_REVEAL"]) }),
  z.object({ action: z.literal("SET_REVEAL_STEP"), eventId: z.string().uuid(), revealStep: z.number().int().min(0).max(20) }),
]);

export type EventControlInput = z.infer<typeof eventControlInputSchema>;

export class EventControlService {
  constructor(private readonly repository: EventControlRepository) {}

  getSnapshot(eventId?: string) {
    return this.repository.getSnapshot(eventId);
  }

  async execute(input: unknown) {
    const parsed = eventControlInputSchema.safeParse(input);
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "행사 제어 요청이 올바르지 않습니다.", 422);
    const value: EventControlInput = parsed.data;
    if (value.action === "SET_VOTING") {
      const current = await this.repository.getSnapshot(value.eventId);
      if (value.status === "OPEN" && !current.activeTeamId) {
        throw new DomainError("INVALID_STATE", "현재 발표팀을 먼저 시작해야 청중평가를 열 수 있습니다.", 409);
      }
      if (current.status === "ENDED") throw new DomainError("EVENT_CLOSED", "종료된 행사의 청중평가는 변경할 수 없습니다.", 409);
      return this.repository.setVotingStatus(value.eventId, value.status);
    }
    if (value.action === "SET_MODE") {
      const current = await this.repository.getSnapshot(value.eventId);
      if (current.mode === "REHEARSAL" && value.mode === "LIVE") {
        throw new DomainError("FORBIDDEN", "리허설 데이터를 LIVE로 전환할 수 없습니다. 별도 LIVE 행사 데이터셋이 필요합니다.", 409);
      }
      return this.repository.setMode(value.eventId, value.mode);
    }
    if (value.action === "SET_STATUS") {
      if (value.status === "FINALIZED") {
        throw new DomainError("EVENT_CLOSED", "공식 평가기준과 동점 처리 규정이 확정되기 전에는 결과를 확정할 수 없습니다.", 409);
      }
      const current = await this.repository.getSnapshot(value.eventId);
      if (!canTransitionEvent(current.status, value.status)) {
        throw new DomainError("INVALID_STATE", `${current.status}에서 ${value.status}(으)로 전환할 수 없습니다.`, 409);
      }
      return this.repository.setStatus(value.eventId, value.status);
    }
    if (value.action === "ACTIVATE_TEAM") return this.repository.setActiveTeam(value.eventId, value.teamId);
    if (value.action === "COMPLETE_TEAM") return this.repository.completeActiveTeam(value.eventId);
    if (value.action === "SET_DISPLAY") {
      const current = await this.repository.getSnapshot(value.eventId);
      if (value.displayMode === "AWARD_REVEAL" && current.resultStatus === "LOCKED") {
        throw new DomainError("INVALID_STATE", "결과 확정 전에는 수상 발표 화면을 열 수 없습니다.", 409);
      }
      return this.repository.setDisplayMode(value.eventId, value.displayMode);
    }
    if (value.action === "SET_REVEAL_STEP") {
      const current = await this.repository.getSnapshot(value.eventId);
      if (current.resultStatus === "LOCKED") throw new DomainError("INVALID_STATE", "결과가 잠겨 있습니다.", 409);
      return this.repository.setRevealStep(value.eventId, value.revealStep);
    }
    return this.repository.resetRehearsal(value.eventId);
  }
}
