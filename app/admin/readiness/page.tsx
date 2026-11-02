"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import { SCORING_POLICY_READY } from "@/features/scoring/data/evaluationPolicy";
import { evaluateReadiness } from "@/lib/readiness/evaluateReadiness";
import { verifyOperationalSnapshot } from "@/lib/export/operationalExport";
import type { AudienceReservation } from "@/types/audience-reservation";
import type { PrizeStageSnapshot } from "@/types/prize-stage";
import type { ResultShowDeck } from "@/types/result-show";
import type { ScoringPolicyGovernance } from "@/types/scoring-policy";
import type { Team } from "@/types/team";

type Loaded = { backendReady: boolean; teams: Team[]; reservations: AudienceReservation[]; stages: PrizeStageSnapshot[]; resultShow: ResultShowDeck | null; scoringPolicy: ScoringPolicyGovernance | null };
const empty: Loaded = { backendReady: false, teams: [], reservations: [], stages: [], resultShow: null, scoringPolicy: null };

export default function ReadinessPage() {
  const { state } = useEventOps();
  const [data, setData] = useState<Loaded>(empty);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setFeedback("");
    const urls = ["/api/health/readiness", `/api/teams?eventId=${encodeURIComponent(state.eventId)}`, `/api/audience-reservations?eventId=${encodeURIComponent(state.eventId)}`, `/api/prize-stages?eventId=${encodeURIComponent(state.eventId)}`, `/api/result-show?eventId=${encodeURIComponent(state.eventId)}`, `/api/scoring/policy?eventId=${encodeURIComponent(state.eventId)}`];
    const responses = await Promise.allSettled(urls.map(async (url) => { const response = await fetch(url, { cache: "no-store" }); const payload = await response.json(); return { response, payload }; }));
    const value = (index: number) => responses[index]?.status === "fulfilled" ? responses[index].value : null;
    const health = value(0); const teams = value(1); const reservations = value(2); const stages = value(3); const result = value(4); const policy = value(5);
    setData({ backendReady: Boolean(health?.response.ok && health.payload.ok), teams: teams?.response.ok && teams.payload.ok ? teams.payload.data : [], reservations: reservations?.response.ok && reservations.payload.ok ? reservations.payload.data.rows : [], stages: stages?.response.ok && stages.payload.ok ? stages.payload.data : [], resultShow: result?.response.ok && result.payload.ok ? result.payload.data : null, scoringPolicy: policy?.response.ok && policy.payload.ok ? policy.payload.data : null });
    if (responses.some((item) => item.status === "rejected") || [teams, reservations, stages, result, policy].some((item) => !item?.response.ok)) setFeedback("일부 점검 API에 연결하지 못했습니다. BLOCK 항목을 확인하세요.");
    setLoading(false);
  }, [state.eventId]);
  const downloadSnapshot = async () => {
    setFeedback("");
    const response = await fetch(`/api/operations/export?eventId=${encodeURIComponent(state.eventId)}`, { cache: "no-store" });
    if (!response.ok) { const payload = await response.json().catch(() => null); setFeedback(payload?.error?.message ?? "운영 Snapshot을 생성하지 못했습니다."); return; }
    const blob = await response.blob(); const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `nexus-operational-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.json`; anchor.click(); URL.revokeObjectURL(url);
    setFeedback("개인정보가 제외된 운영 Snapshot과 SHA-256 무결성 해시를 다운로드했습니다.");
  };
  const verifySnapshot = async (file: File | undefined) => {
    if (!file) return;
    setFeedback("");
    try {
      const result = await verifyOperationalSnapshot(JSON.parse(await file.text()) as unknown);
      setFeedback(result.valid ? `검증 성공: ${result.reason}` : `검증 실패: ${result.reason}`);
    } catch { setFeedback("검증 실패: JSON Snapshot 파일을 읽을 수 없습니다."); }
  };
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const checks = useMemo(() => { const complete = data.teams.filter((team) => team.name && team.department && team.leaderName && team.advisorName && team.topic).length; const signed = data.reservations.filter((item) => item.paperSignedAt).length; return evaluateReadiness({ runtimeMode: state.runtimeMode, backendReady: data.backendReady, snapshotReady: state.snapshotReady && !state.snapshotError, teamCount: data.teams.length, completeTeamProfiles: complete, reservationCount: data.reservations.length, signedCount: signed, secondDrawLocked: Boolean(data.stages.find((item) => item.stage === "SECOND")?.locked), thirdDrawLocked: Boolean(data.stages.find((item) => item.stage === "THIRD")?.locked), resultShowApproved: data.resultShow?.status === "APPROVED", bestReviewerReady: Boolean(data.resultShow?.bestReviewer), scoringPolicyDocumentApproved: data.scoringPolicy?.status === "APPROVED", scoringPolicyReady: SCORING_POLICY_READY }); }, [data, state.runtimeMode, state.snapshotError, state.snapshotReady]);
  const counts = checks.reduce((sum, item) => ({ ...sum, [item.level]: sum[item.level] + 1 }), { PASS: 0, WARN: 0, BLOCK: 0 });
  return <div className="admin-page"><SectionLabel label="EVENT DAY READINESS" title="행사 당일 사전점검" description="운영 시작 전 데이터·권한·전광판·경품·결과 공개 준비 상태를 한 번에 확인합니다." /><OperationAlert level={counts.BLOCK ? "WARNING" : "INFO"}>{counts.BLOCK ? `현재 ${counts.BLOCK}개 차단 항목이 있어 실제 운영 시작이 불가능합니다. Mock 리허설 결과를 운영 준비 완료로 판단하지 마세요.` : "모든 필수 운영 조건이 준비되었습니다. 최종 현장 리허설 후 LIVE 시작을 승인하세요."}</OperationAlert><section className="readiness-summary"><article><small>PASS</small><strong>{counts.PASS}</strong></article><article><small>REVIEW</small><strong>{counts.WARN}</strong></article><article><small>BLOCK</small><strong>{counts.BLOCK}</strong></article><div className="readiness-actions"><button className="admin-button admin-button--primary" disabled={loading} type="button" onClick={() => void load()}>{loading ? "점검 중…" : "전체 다시 점검"}</button><button className="admin-button" type="button" onClick={() => void downloadSnapshot()}>운영 Snapshot 다운로드</button><label className="admin-button">Snapshot 검증<input accept="application/json,.json" hidden type="file" onChange={(event) => void verifySnapshot(event.target.files?.[0])} /></label></div></section><OperationAlert level="INFO">다운로드 파일에는 예약자 이름·학번·인증 토큰이 포함되지 않습니다. 이 파일은 읽기 전용 운영 증빙이며 자동 복원 파일이 아닙니다.</OperationAlert><section className="readiness-list">{checks.map((check) => <article className={`admin-card readiness-item readiness-item--${check.level.toLowerCase()}`} key={check.id}><StatusBadge tone={check.level === "PASS" ? "success" : check.level === "WARN" ? "warning" : "danger"}>{check.level}</StatusBadge><div><h2>{check.label}</h2><p>{check.detail}</p></div>{check.href && <Link className="admin-button admin-button--compact" href={check.href}>확인·수정</Link>}</article>)}</section><p className="participant-feedback" role="status">{feedback}</p></div>;
}
