"use client";

import { DataTable } from "@/components/ui/DataTable";
import { ScoringDiagnosticsPanel } from "@/components/ScoringDiagnosticsPanel";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import { AUDIENCE_WEIGHT, calculateScoreRows, calculateScoringResult, PROFESSIONAL_WEIGHT } from "@/features/scoring/lib/calculateScores";
import { EVALUATION_POLICY, SCORING_POLICY_READY } from "@/features/scoring/data/evaluationPolicy";

export default function ScoringPage() {
  const { state } = useEventOps();
  const rows = state.runtimeMode === "mock" ? calculateScoreRows(state.scoreInputs) : [];
  const productionResult = calculateScoringResult(state.scoreInputs, SCORING_POLICY_READY);
  const hasTie = rows.some((row) => row.tied);
  const tieCount = rows.filter((row) => row.tied).length;
  const submittedJudges = state.judgeProgress.filter((judge) => judge.completed === judge.total).length;
  const judgeRate = state.judgeProgress.length ? Math.round((submittedJudges / state.judgeProgress.length) * 100) : 0;
  return (
    <div className="admin-page">
      <SectionLabel label="SCORING" title="최종 점수 집계" description="전문심사 80% · 청중평가 20% · 읽기 전용 계산" />
      {state.runtimeMode !== "mock" && <ScoringDiagnosticsPanel eventId={state.eventId} />}
      <section className="scoring-rule"><div><small>SCORING RULE</small><strong>전문심사 <b>{PROFESSIONAL_WEIGHT * 100}%</b></strong><strong>청중평가 <b>{AUDIENCE_WEIGHT * 100}%</b></strong></div><p>운영 화면에서 비율을 변경할 수 없습니다.</p></section>
      {productionResult.status === "SCORING_BLOCKED" && <OperationAlert level="WARNING">{productionResult.reason} 아래 값은 UI 검증용 Mock Preview이며 결과를 확정할 수 없습니다.</OperationAlert>}
      {hasTie && <OperationAlert level="CRITICAL">동점 팀이 존재합니다. 공식 동점 처리 규정을 확인하세요.</OperationAlert>}
      <section className="scoring-layout">
        <article className="admin-card">
          <PanelHeader label="SCORE TABLE" title="최종 점수 미리보기" aside={<span className="mock-note">MOCK SCORE</span>} />
          <DataTable label="점수 집계표"><thead><tr><th>순위</th><th>팀</th><th>전문심사</th><th>청중평가</th><th>최종점수</th><th>상태</th></tr></thead><tbody>{rows.map((row) => <tr key={row.teamId}><td>{row.tied ? `공동 ${row.rank}위` : `${row.rank}위`}</td><td><strong>{row.teamName}</strong></td><td>{row.professional}</td><td>{row.audience}</td><td className="score-total">{row.finalScore}</td><td><StatusBadge tone={row.tied ? "warning" : "success"}>{row.tied ? "TIE" : "CALCULATED"}</StatusBadge></td></tr>)}</tbody></DataTable>
        </article>
        <aside className="scoring-side">
          <section className="admin-card scoring-summary"><PanelHeader label="AGGREGATION" title="집계 현황" /><dl><div><dt>집계 완료 팀</dt><dd>{rows.length} / {state.teams.length}</dd></div><div><dt>동점 팀</dt><dd className={tieCount ? "is-warning" : ""}>{tieCount}</dd></div><div><dt>심사 반영률</dt><dd>{judgeRate}%</dd></div><div><dt>결과 상태</dt><dd>미확정</dd></div></dl></section>
          <section className="admin-card score-chart"><PanelHeader label="COMPARISON" title="점수 비교" />{rows.map((row) => <div key={row.teamId}><span>{row.teamName}</span><div><i style={{ width: `${row.finalScore}%` }} /></div><b>{row.finalScore}</b></div>)}</section>
        </aside>
      </section>
      <section className="admin-card policy-matrix"><PanelHeader label="EVALUATION GOVERNANCE" title="평가 기준 점검표" aside={<StatusBadge tone="warning">결정 대기 포함</StatusBadge>} /><DataTable label="평가 기준 점검표"><thead><tr><th>항목</th><th>상태</th><th>현재 기준</th><th>추가 결정</th></tr></thead><tbody>{EVALUATION_POLICY.map((policy) => <tr key={policy.item}><td><strong>{policy.item}</strong></td><td><StatusBadge tone={policy.status === "CONFIRMED" ? "success" : policy.status === "PARTIAL" ? "warning" : "danger"}>{policy.status === "CONFIRMED" ? "확인됨" : policy.status === "PARTIAL" ? "일부 구현" : "결정 대기"}</StatusBadge></td><td>{policy.rule}</td><td>{policy.note}</td></tr>)}</tbody></DataTable></section>
    </div>
  );
}
