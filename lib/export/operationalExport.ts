import type { AudienceReservation } from "@/types/audience-reservation";
import type { ScoringPolicyGovernance } from "@/types/scoring-policy";

export function summarizeReservations(reservations: AudienceReservation[]) {
  const departments = new Map<string, { reserved: number; signed: number; checkedIn: number; accepted: number }>();
  for (const item of reservations) {
    const current = departments.get(item.department) ?? { reserved: 0, signed: 0, checkedIn: 0, accepted: 0 };
    current.reserved += 1;
    if (item.paperSignedAt) current.signed += 1;
    if (item.qrCheckedInAt) current.checkedIn += 1;
    if (item.pcuCode) current.accepted += 1;
    departments.set(item.department, current);
  }
  return { total: reservations.length, signed: reservations.filter((item) => item.paperSignedAt).length, checkedIn: reservations.filter((item) => item.qrCheckedInAt).length, accepted: reservations.filter((item) => item.pcuCode).length, departments: Object.fromEntries([...departments.entries()].sort(([left], [right]) => left.localeCompare(right, "ko"))) };
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

export function summarizeScoringPolicy(policy: ScoringPolicyGovernance, officialScoresAvailable: boolean) {
  return {
    id: policy.id,
    version: policy.version,
    status: policy.status,
    professionalWeight: policy.professionalWeight,
    audienceWeight: policy.audienceWeight,
    judgeCount: policy.judgeCount,
    professionalMaxPerJudge: policy.professionalMaxPerJudge,
    audienceConversionRule: policy.audienceConversionRule,
    tieBreakRule: policy.tieBreakRule,
    categoryAggregationRule: policy.categoryAggregationRule,
    approvedAt: policy.approvedAt,
    officialScoresAvailable,
    officialResultLock: officialScoresAvailable ? "READY" : "POLICY_APPROVAL_REQUIRED",
  };
}

export async function verifyOperationalSnapshot(value: unknown) {
  if (!value || typeof value !== "object") return { valid: false, reason: "Snapshot 형식이 아닙니다." } as const;
  const snapshot = value as Record<string, unknown>;
  const integrity = snapshot.integrity as Record<string, unknown> | undefined;
  if (snapshot.exportType !== "REDACTED_OPERATIONAL_SNAPSHOT" || !snapshot.data || integrity?.algorithm !== "SHA-256" || typeof integrity.digest !== "string") {
    return { valid: false, reason: "Snapshot 필수 메타데이터가 없습니다." } as const;
  }
  const bytes = new TextEncoder().encode(canonicalJson(snapshot.data));
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return digest === integrity.digest
    ? { valid: true, reason: "SHA-256 무결성 검증을 통과했습니다." } as const
    : { valid: false, reason: "내용이 변경되었거나 손상된 Snapshot입니다." } as const;
}
