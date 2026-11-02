"use client";

import { useCallback, useEffect, useState } from "react";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DEFAULT_SCORING_POLICY_DRAFT, validateScoringPolicyForApproval } from "@/features/scoring/lib/scoringPolicyGovernance";
import type { ScoringPolicyDraftInput, ScoringPolicyGovernance } from "@/types/scoring-policy";

type ApiResponse = { ok: boolean; data?: ScoringPolicyGovernance; error?: { message?: string } };

export function ScoringPolicyControl({ eventId }: { eventId: string }) {
  const [policy, setPolicy] = useState<ScoringPolicyGovernance | null>(null);
  const [draft, setDraft] = useState<ScoringPolicyDraftInput>(DEFAULT_SCORING_POLICY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/scoring/policy?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" });
    const body = await response.json() as ApiResponse;
    if (!response.ok || !body.data) throw new Error(body.error?.message ?? "평가정책을 불러오지 못했습니다.");
    setPolicy(body.data);
    setDraft(body.data);
  }, [eventId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "평가정책을 불러오지 못했습니다.")), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const update = (key: keyof ScoringPolicyDraftInput, value: string | number) => setDraft((current) => ({ ...current, [key]: value }));

  async function submit(action: "SAVE" | "APPROVE") {
    if (action === "APPROVE" && !policy?.id) return setMessage("먼저 정책 초안을 저장해주세요.");
    setBusy(true); setMessage("");
    try {
      const payload = action === "SAVE" ? { action, eventId, ...draft } : { action, eventId, policyId: policy?.id };
      const response = await fetch("/api/scoring/policy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as ApiResponse;
      if (!response.ok || !body.data) throw new Error(body.error?.message ?? "평가정책 처리에 실패했습니다.");
      setPolicy(body.data); setDraft(body.data);
      setMessage(action === "SAVE" ? "정책 초안을 저장했습니다." : "정책 문서를 승인했습니다. 공식 산식 적용 잠금은 계속 유지됩니다.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "평가정책 처리에 실패했습니다."); }
    finally { setBusy(false); }
  }

  const approvalErrors = validateScoringPolicyForApproval(draft);
  const locked = policy?.status === "APPROVED";
  return <section className="admin-card scoring-policy-control">
    <PanelHeader label="POLICY GOVERNANCE" title="평가정책 입력 · 검토 · 승인" aside={<StatusBadge tone={locked ? "success" : "warning"}>{locked ? "문서 승인" : "초안"}</StatusBadge>} />
    <OperationAlert level="WARNING">정책 문서 승인은 공식 점수 계산·순위 확정·결과 공개를 활성화하지 않습니다. 산식 코드 적용은 별도 검증 후에만 가능합니다.</OperationAlert>
    <div className="policy-control-grid">
      <label><span>정책 버전</span><input value={draft.version} disabled={locked} onChange={(event) => update("version", event.target.value)} /></label>
      <label><span>전문심사 비율 (%)</span><input type="number" min="0" max="100" value={draft.professionalWeight} disabled={locked} onChange={(event) => update("professionalWeight", Number(event.target.value))} /></label>
      <label><span>청중평가 비율 (%)</span><input type="number" min="0" max="100" value={draft.audienceWeight} disabled={locked} onChange={(event) => update("audienceWeight", Number(event.target.value))} /></label>
      <label><span>심사위원 수</span><input type="number" min="1" value={draft.judgeCount} disabled={locked} onChange={(event) => update("judgeCount", Number(event.target.value))} /></label>
      <label><span>심사위원 1인당 만점</span><input type="number" min="1" value={draft.professionalMaxPerJudge} disabled={locked} onChange={(event) => update("professionalMaxPerJudge", Number(event.target.value))} /></label>
      <label className="policy-control-wide"><span>청중평가 환산식</span><textarea value={draft.audienceConversionRule} disabled={locked} placeholder="예: 득표를 몇 점으로 어떻게 환산하는지 승인 문구 입력" onChange={(event) => update("audienceConversionRule", event.target.value)} /></label>
      <label className="policy-control-wide"><span>동점 처리 규칙</span><textarea value={draft.tieBreakRule} disabled={locked} placeholder="동점 시 우선순위와 최종 승인 절차 입력" onChange={(event) => update("tieBreakRule", event.target.value)} /></label>
      <label className="policy-control-wide"><span>부문별 집계 규칙</span><textarea value={draft.categoryAggregationRule} disabled={locked} placeholder="창업·기업분석 부문을 분리 집계하는 승인 규칙 입력" onChange={(event) => update("categoryAggregationRule", event.target.value)} /></label>
    </div>
    {!locked && approvalErrors.length > 0 && <div className="policy-control-errors"><strong>승인 전 확인</strong><ul>{approvalErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
    {message && <p className="policy-control-message">{message}</p>}
    <div className="policy-control-actions"><button type="button" disabled={busy || locked} onClick={() => submit("SAVE")}>초안 저장</button><button type="button" disabled={busy || locked || !policy?.id || approvalErrors.length > 0} onClick={() => submit("APPROVE")}>관리자 승인</button></div>
  </section>;
}
