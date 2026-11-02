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

export const MOCK_JUDGE_IDS = [
  "00000000-0000-4000-8000-000000000001",
  "00000000-0000-4000-8000-000000000002",
  "00000000-0000-4000-8000-000000000003",
] as const;

export function resetMockJudgeWorkspaces() {
  globalForJudging.__mockJudgeWorkspaces = new Map();
}

export class MockJudgeRepository implements JudgeRepository {
  async getWorkspace(eventId: string, activeTeamId: string | null, judgeUserId: string) {
    const key = `${eventId}:${judgeUserId}:${activeTeamId ?? "none"}`;
    const existing = workspaces().get(key);
    if (existing) return structuredClone(existing);
    return { eventId, activeTeamId, assignedTeamIds: activeTeamId ? [activeTeamId] : [], criteria: MOCK_CRITERIA, submissionId: null, status: "NOT_STARTED" as const, scores: [], submittedAt: null };
  }

  private async update(eventId: string, teamId: string, scores: JudgeWorkspaceScore[] | null, status: "DRAFT" | "SUBMITTED", judgeUserId: string) {
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

  saveDraft(eventId: string, teamId: string, scores: JudgeWorkspaceScore[], judgeUserId: string) {
    return this.update(eventId, teamId, scores, "DRAFT", judgeUserId);
  }

  submit(eventId: string, teamId: string, judgeUserId: string) {
    return this.update(eventId, teamId, null, "SUBMITTED", judgeUserId);
  }

  async getProgress() {
    return MOCK_JUDGE_IDS.map((judgeUserId, index) => ({
      id: `Judge ${String(index + 1).padStart(2, "0")}`,
      completed: [...workspaces().entries()].filter(([key, item]) => key.includes(`:${judgeUserId}:`) && item.status === "SUBMITTED").length,
      total: 1,
    }));
  }

  async unlock() {
    throw new DomainError("NOT_FOUND", "서버 Mock에는 실제 심사 제출 데이터가 없습니다.", 404);
  }
}
