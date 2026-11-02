import "server-only";
import { randomUUID } from "node:crypto";
import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError } from "@/lib/errors/domainError";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFAULT_SCORING_POLICY_DRAFT, validateScoringPolicyDraft, validateScoringPolicyForApproval } from "@/features/scoring/lib/scoringPolicyGovernance";
import type { ScoringPolicyDraftInput, ScoringPolicyGovernance } from "@/types/scoring-policy";

const state = globalThis as typeof globalThis & { __scoringPolicyGovernance?: Map<string, ScoringPolicyGovernance> };
const mockPolicies = () => state.__scoringPolicyGovernance ??= new Map();

function emptyPolicy(eventId: string): ScoringPolicyGovernance {
  return { id: null, eventId, ...DEFAULT_SCORING_POLICY_DRAFT, status: "DRAFT", approvedAt: null, updatedAt: new Date().toISOString() };
}

function mapPolicy(row: Record<string, unknown>): ScoringPolicyGovernance {
  return {
    id: String(row.id), eventId: String(row.event_id), version: String(row.version),
    professionalWeight: Number(row.professional_weight), audienceWeight: Number(row.audience_weight),
    judgeCount: Number(row.judge_count), professionalMaxPerJudge: Number(row.professional_max_per_judge),
    audienceConversionRule: String(row.audience_conversion_rule ?? ""), tieBreakRule: String(row.tie_break_rule ?? ""),
    categoryAggregationRule: String(row.category_aggregation_rule ?? ""), status: row.status as ScoringPolicyGovernance["status"],
    approvedAt: row.approved_at ? String(row.approved_at) : null, updatedAt: String(row.updated_at),
  };
}

const columns = "id,event_id,version,professional_weight,audience_weight,judge_count,professional_max_per_judge,audience_conversion_rule,tie_break_rule,category_aggregation_rule,status,approved_at,updated_at";

export async function getScoringPolicy(eventId: string) {
  if (isMockRuntime()) return structuredClone(mockPolicies().get(eventId) ?? emptyPolicy(eventId));
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { data, error } = await client.from("scoring_policy_versions").select(columns).eq("event_id", eventId).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new DomainError("DATABASE_ERROR", "평가정책을 조회하지 못했습니다.", 503);
  return data ? mapPolicy(data) : emptyPolicy(eventId);
}

export async function saveScoringPolicyDraft(eventId: string, input: ScoringPolicyDraftInput) {
  const normalized: ScoringPolicyDraftInput = {
    version: input.version.trim(), professionalWeight: input.professionalWeight, audienceWeight: input.audienceWeight,
    judgeCount: input.judgeCount, professionalMaxPerJudge: input.professionalMaxPerJudge,
    audienceConversionRule: input.audienceConversionRule.trim(), tieBreakRule: input.tieBreakRule.trim(),
    categoryAggregationRule: input.categoryAggregationRule.trim(),
  };
  const errors = validateScoringPolicyDraft(normalized);
  if (errors.length) throw new DomainError("VALIDATION_ERROR", errors.join(" "), 422);
  if (isMockRuntime()) {
    const current = mockPolicies().get(eventId);
    if (current?.status === "APPROVED") throw new DomainError("EVENT_CLOSED", "승인된 평가정책은 수정할 수 없습니다.", 409);
    const saved: ScoringPolicyGovernance = { id: current?.id ?? randomUUID(), eventId, ...normalized, status: "DRAFT", approvedAt: null, updatedAt: new Date().toISOString() };
    mockPolicies().set(eventId, saved);
    return structuredClone(saved);
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { data: approved, error: approvedError } = await client.from("scoring_policy_versions").select("id").eq("event_id", eventId).eq("status", "APPROVED").maybeSingle();
  if (approvedError) throw new DomainError("DATABASE_ERROR", "승인된 평가정책을 확인하지 못했습니다.", 503);
  if (approved) throw new DomainError("EVENT_CLOSED", "승인된 평가정책은 수정하거나 다시 열 수 없습니다.", 409);
  const { data: current, error: findError } = await client.from("scoring_policy_versions").select("id,status").eq("event_id", eventId).eq("status", "DRAFT").maybeSingle();
  if (findError) throw new DomainError("DATABASE_ERROR", "평가정책 초안을 조회하지 못했습니다.", 503);
  const payload = { event_id: eventId, version: normalized.version, professional_weight: normalized.professionalWeight, audience_weight: normalized.audienceWeight, judge_count: normalized.judgeCount, professional_max_per_judge: normalized.professionalMaxPerJudge, audience_conversion_rule: normalized.audienceConversionRule, tie_break_rule: normalized.tieBreakRule, category_aggregation_rule: normalized.categoryAggregationRule };
  const query = current ? client.from("scoring_policy_versions").update(payload).eq("id", current.id) : client.from("scoring_policy_versions").insert(payload);
  const { data, error } = await query.select(columns).single();
  if (error || !data) throw new DomainError("DATABASE_ERROR", "평가정책 초안을 저장하지 못했습니다.", 503);
  return mapPolicy(data);
}

export async function approveScoringPolicy(eventId: string, policyId: string) {
  if (isMockRuntime()) {
    const current = mockPolicies().get(eventId);
    if (!current || current.id !== policyId) throw new DomainError("NOT_FOUND", "승인할 평가정책 초안이 없습니다.", 404);
    const errors = validateScoringPolicyForApproval(current);
    if (errors.length) throw new DomainError("VALIDATION_ERROR", errors.join(" "), 422);
    const approved = { ...current, status: "APPROVED" as const, approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    mockPolicies().set(eventId, approved);
    return structuredClone(approved);
  }
  const client = await createSupabaseServerClient();
  if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
  const { data, error } = await client.rpc("approve_scoring_policy", { p_event_id: eventId, p_policy_id: policyId });
  if (error || !data) throw new DomainError("DATABASE_ERROR", "평가정책을 승인하지 못했습니다.", 503);
  return mapPolicy(Array.isArray(data) ? data[0] : data);
}
