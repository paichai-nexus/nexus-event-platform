import "server-only";

import { DomainError } from "@/lib/errors/domainError";
import type { JudgeRepository } from "@/lib/repositories/judgeRepository";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { JudgeProgress, JudgeWorkspace, JudgeWorkspaceScore } from "@/types/judging";

export class SupabaseJudgeRepository implements JudgeRepository {
  private async client() {
    const client = await createSupabaseServerClient();
    if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
    return client;
  }

  async getWorkspace(eventId: string, activeTeamId: string | null, judgeUserId: string): Promise<JudgeWorkspace> {
    const supabase = await this.client();
    const [assignmentsResult, criteriaResult, submissionsResult] = await Promise.all([
      supabase.from("judge_assignments").select("team_id").eq("event_id", eventId).eq("judge_user_id", judgeUserId).eq("active", true),
      supabase.from("evaluation_criteria").select("id, name, max_score, order_index").eq("event_id", eventId).eq("scope", "JUDGE").eq("active", true).order("order_index"),
      supabase.from("judge_submissions").select("id, team_id, status, submitted_at").eq("event_id", eventId).eq("judge_user_id", judgeUserId),
    ]);
    if (assignmentsResult.error || criteriaResult.error || submissionsResult.error) {
      throw new DomainError("DATABASE_ERROR", "심사 작업공간을 불러오지 못했습니다.", 500);
    }
    const submission = submissionsResult.data?.find((row) => row.team_id === activeTeamId) ?? null;
    let scores: JudgeWorkspaceScore[] = [];
    if (submission) {
      const scoreResult = await supabase.from("judge_scores").select("criterion_id, score").eq("submission_id", submission.id);
      if (scoreResult.error) throw new DomainError("DATABASE_ERROR", "심사 점수를 불러오지 못했습니다.", 500);
      scores = (scoreResult.data ?? []).map((row) => ({ criterionId: row.criterion_id, score: Number(row.score) }));
    }
    return {
      eventId,
      activeTeamId,
      assignedTeamIds: (assignmentsResult.data ?? []).map((row) => row.team_id),
      criteria: (criteriaResult.data ?? []).map((row) => ({ id: row.id, name: row.name, maxScore: Number(row.max_score), order: row.order_index })),
      submissionId: submission?.id ?? null,
      status: submission?.status ?? "NOT_STARTED",
      scores,
      submittedAt: submission?.submitted_at ?? null,
    };
  }

  async saveDraft(eventId: string, teamId: string, scores: JudgeWorkspaceScore[]) {
    const supabase = await this.client();
    const { error } = await supabase.rpc("save_judge_scores", {
      p_event_id: eventId,
      p_team_id: teamId,
      p_scores: scores.map((score) => ({ criterionId: score.criterionId, score: score.score })),
    });
    if (error) throw new DomainError("DATABASE_ERROR", "심사 점수를 저장하지 못했습니다.", 500);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new DomainError("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    return this.getWorkspace(eventId, teamId, userData.user.id);
  }

  async submit(eventId: string, teamId: string) {
    const supabase = await this.client();
    const { error } = await supabase.rpc("submit_judge_scores", { p_event_id: eventId, p_team_id: teamId });
    if (error) throw new DomainError("DATABASE_ERROR", "심사 점수를 제출하지 못했습니다.", 500);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new DomainError("UNAUTHORIZED", "로그인이 필요합니다.", 401);
    return this.getWorkspace(eventId, teamId, userData.user.id);
  }

  async getProgress(eventId: string): Promise<JudgeProgress[]> {
    const supabase = await this.client();
    const [assignmentsResult, submissionsResult] = await Promise.all([
      supabase.from("judge_assignments").select("judge_user_id, team_id").eq("event_id", eventId).eq("active", true),
      supabase.from("judge_submissions").select("judge_user_id, team_id, status").eq("event_id", eventId),
    ]);
    if (assignmentsResult.error || submissionsResult.error) throw new DomainError("DATABASE_ERROR", "심사 진행률을 불러오지 못했습니다.", 500);
    const progress = new Map<string, JudgeProgress>();
    for (const assignment of assignmentsResult.data ?? []) {
      const current = progress.get(assignment.judge_user_id) ?? { id: assignment.judge_user_id, completed: 0, total: 0 };
      current.total += 1;
      progress.set(assignment.judge_user_id, current);
    }
    for (const submission of submissionsResult.data ?? []) {
      if (submission.status !== "SUBMITTED") continue;
      const current = progress.get(submission.judge_user_id);
      if (current) current.completed += 1;
    }
    return [...progress.values()];
  }
}
