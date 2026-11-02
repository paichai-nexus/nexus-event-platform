import "server-only";

import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError } from "@/lib/errors/domainError";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PaperJudgeScore, PaperJudgeScoreInput } from "@/types/paper-judging";

const mockScores = globalThis as typeof globalThis & { __paperJudgeScores?: Map<string, PaperJudgeScore> };
const scores = () => mockScores.__paperJudgeScores ??= new Map<string, PaperJudgeScore>();
const keyOf = (input: Pick<PaperJudgeScoreInput, "eventId" | "teamId" | "judgeSlot">) => `${input.eventId}:${input.teamId}:${input.judgeSlot}`;

function validate(input: PaperJudgeScoreInput) {
  if (!Number.isInteger(input.documentScore) || input.documentScore < 0 || input.documentScore > 50) throw new DomainError("VALIDATION_ERROR", "서류평가는 0~50점 정수로 입력해주세요.", 422);
  if (!Number.isInteger(input.presentationScore) || input.presentationScore < 0 || input.presentationScore > 100) throw new DomainError("VALIDATION_ERROR", "발표평가는 0~100점 정수로 입력해주세요.", 422);
  if (!Number.isInteger(input.qnaScore) || input.qnaScore < 0 || input.qnaScore > 50) throw new DomainError("VALIDATION_ERROR", "질의응답은 0~50점 정수로 입력해주세요.", 422);
}

export async function getPaperJudgeScores(eventId: string): Promise<PaperJudgeScore[]> {
  if (isMockRuntime()) return [...scores().values()].filter((item) => item.eventId === eventId).map((item) => structuredClone(item));
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { data, error } = await client.from("paper_judge_scores")
    .select("id,event_id,team_id,judge_slot,document_score,presentation_score,qna_score,total_score,status,updated_at,submitted_at")
    .eq("event_id", eventId).order("team_id").order("judge_slot");
  if (error) throw new DomainError("DATABASE_ERROR", "종이 심사표 입력값을 조회하지 못했습니다.", 503);
  return (data ?? []).map((row) => ({ id: row.id, eventId: row.event_id, teamId: row.team_id, judgeSlot: row.judge_slot, documentScore: Number(row.document_score), presentationScore: Number(row.presentation_score), qnaScore: Number(row.qna_score), totalScore: Number(row.total_score), status: row.status, updatedAt: row.updated_at, submittedAt: row.submitted_at })) as PaperJudgeScore[];
}

export async function savePaperJudgeScore(input: PaperJudgeScoreInput): Promise<PaperJudgeScore> {
  validate(input);
  if (isMockRuntime()) {
    const key = keyOf(input);
    const previous = scores().get(key);
    if (previous?.status === "SUBMITTED") throw new DomainError("EVENT_CLOSED", "제출 완료된 종이 심사표는 수정할 수 없습니다.", 409);
    const now = new Date().toISOString();
    const record: PaperJudgeScore = { id: previous?.id ?? crypto.randomUUID(), ...input, totalScore: input.documentScore + input.presentationScore + input.qnaScore, updatedAt: now, submittedAt: input.status === "SUBMITTED" ? now : null };
    scores().set(key, record);
    return structuredClone(record);
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { data, error } = await client.rpc("record_paper_judge_score", {
    p_event_id: input.eventId, p_team_id: input.teamId, p_judge_slot: input.judgeSlot,
    p_document_score: input.documentScore, p_presentation_score: input.presentationScore,
    p_qna_score: input.qnaScore, p_submit: input.status === "SUBMITTED",
  });
  if (error || !data) {
    if (error?.message?.includes("PAPER_SUBMISSION_LOCKED")) throw new DomainError("EVENT_CLOSED", "제출 완료된 종이 심사표는 수정할 수 없습니다.", 409);
    throw new DomainError("DATABASE_ERROR", "종이 심사표 입력값을 저장하지 못했습니다.", 503);
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { id: row.id, eventId: row.event_id, teamId: row.team_id, judgeSlot: row.judge_slot, documentScore: Number(row.document_score), presentationScore: Number(row.presentation_score), qnaScore: Number(row.qna_score), totalScore: Number(row.total_score), status: row.status, updatedAt: row.updated_at, submittedAt: row.submitted_at } as PaperJudgeScore;
}
