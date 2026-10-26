import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import type { JudgeRepository } from "@/lib/repositories/judgeRepository";
import type { JudgeWorkspace, JudgeWorkspaceScore } from "@/types/judging";

const MOCK_CRITERIA = [
  { id: "00000000-0000-4000-8000-000000000701", name: "테스트용 평가항목 A", maxScore: 10, order: 1 },
  { id: "00000000-0000-4000-8000-000000000702", name: "테스트용 평가항목 B", maxScore: 10, order: 2 },
  { id: "00000000-0000-4000-8000-000000000703", name: "테스트용 평가항목 C", maxScore: 10, order: 3 },
];
const globalForJudging = globalThis as typeof globalThis & { __mockJudgeWorkspaces?: Map<string, JudgeWorkspace> };

function workspaces() {
  globalForJudging.__mockJudgeWorkspaces ??= new Map();
  return globalForJudging.__mockJudgeWorkspaces;
}

export class MockJudgeRepository implements JudgeRepository {
  async getWorkspace(eventId: string, activeTeamId: string | null, judgeUserId: string) {
    const key = `${eventId}:${judgeUserId}:${activeTeamId ?? "none"}`;
    const existing = workspaces().get(key);
    if (existing) return structuredClone(existing);
    return { eventId, activeTeamId, assignedTeamIds: activeTeamId ? [activeTeamId] : [], criteria: MOCK_CRITERIA, submissionId: null, status: "NOT_STARTED" as const, scores: [], submittedAt: null };
  }

  private async update(eventId: string, teamId: string, scores: JudgeWorkspaceScore[] | null, status: "DRAFT" | "SUBMITTED") {
    const judgeUserId = "00000000-0000-4000-8000-000000000001";
    const key = `${eventId}:${judgeUserId}:${teamId}`;
    const current = await this.getWorkspace(eventId, teamId, judgeUserId);
    if (current.status === "SUBMITTED" && status === "DRAFT") {
      throw new DomainError("EVENT_CLOSED", "제출된 심사는 잠금 해제 전까지 수정할 수 없습니다.", 409);
    }
    const next: JudgeWorkspace = {
      ...current,
      submissionId: current.submissionId ?? crypto.randomUUID(),
      status,
      scores: scores ?? current.scores,
      submittedAt: status === "SUBMITTED" ? new Date().toISOString() : null,
    };
    workspaces().set(key, next);
    return structuredClone(next);
  }

  saveDraft(eventId: string, teamId: string, scores: JudgeWorkspaceScore[]) {
    return this.update(eventId, teamId, scores, "DRAFT");
  }

  submit(eventId: string, teamId: string) {
    return this.update(eventId, teamId, null, "SUBMITTED");
  }

  async getProgress() {
    return [{ id: "Judge 01", completed: [...workspaces().values()].filter((item) => item.status === "SUBMITTED").length, total: 1 }];
  }
}
