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
  const MAX_TOTAL_SCORE = 840;
  const JUDGE_STEP_SCORE = 200;
  const judgeMarkers = [
    { label: "1번 심사 종료", score: 200 },
    { label: "2번 심사 종료", score: 400 },
    { label: "3번 심사 종료", score: 600 },
    { label: "최대 840점", score: 840 },
  ];
  const toPercent = (score: number) => Math.max(0, Math.min(100, (score / MAX_TOTAL_SCORE) * 100));
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
          <section className="admin-card score-chart">
            <PanelHeader label="COMPARISON" title="점수 비교" />
            <div className="score-chart-scale" aria-hidden="true">
              {judgeMarkers.map((marker) => (
                <div
                  key={marker.label}
                  className="score-chart-scale__marker"
                  style={{ left: `${toPercent(marker.score)}%` }}
                >
                  <strong>{marker.label}</strong>
                  <small>{marker.score}점</small>
                </div>
              ))}
            </div>
            {rows.map((row) => {
              const professional = Number(row.professional);
              const audience = Number(row.audience);
              const finalScore = Number(row.finalScore);
              const professionalPercent = toPercent(professional);
              const judge1Percent = toPercent(Math.min(professional, JUDGE_STEP_SCORE));
              const judge2Percent = toPercent(Math.min(professional, JUDGE_STEP_SCORE * 2));
              const judge3Percent = toPercent(Math.min(professional, JUDGE_STEP_SCORE * 3));
              const finalPercent = toPercent(finalScore);

              return (
                <div key={row.teamId} className="score-chart-row">
                  <div className="score-chart-row__header">
                    <span>{row.teamName}</span>
                    <b className="score-chart-row__score">{finalScore.toFixed(1)} / {MAX_TOTAL_SCORE}</b>
                  </div>
                  <div className="score-chart-track">
                    <i className="score-chart-track__professional" style={{ width: `${professionalPercent}%` }} />
                    <i className="score-chart-track__final" style={{ width: `${finalPercent}%` }} />
                    {professional >= JUDGE_STEP_SCORE && (
                      <mark className="score-chart-track__judge score-chart-track__judge--1" style={{ left: `${judge1Percent}%` }}>1번 심사</mark>
                    )}
                    {professional >= JUDGE_STEP_SCORE * 2 && (
                      <mark className="score-chart-track__judge score-chart-track__judge--2" style={{ left: `${judge2Percent}%` }}>2번 심사</mark>
                    )}
                    {professional >= JUDGE_STEP_SCORE * 3 && (
                      <mark className="score-chart-track__judge score-chart-track__judge--3" style={{ left: `${judge3Percent}%` }}>3번 심사</mark>
                    )}
                  </div>
                  <div className="score-chart-row__meta">
                    <small>전문심사 {professional.toFixed(1)}점</small>
                    <small>청중평가 {audience.toFixed(1)}점</small>
                  </div>
                </div>
              );
            })}
          </section>
        </aside>
      </section>
      <section className="admin-card policy-matrix"><PanelHeader label="EVALUATION GOVERNANCE" title="평가 기준 점검표" aside={<StatusBadge tone="warning">결정 대기 포함</StatusBadge>} /><DataTable label="평가 기준 점검표"><thead><tr><th>항목</th><th>상태</th><th>현재 기준</th><th>추가 결정</th></tr></thead><tbody>{EVALUATION_POLICY.map((policy) => <tr key={policy.item}><td><strong>{policy.item}</strong></td><td><StatusBadge tone={policy.status === "CONFIRMED" ? "success" : policy.status === "PARTIAL" ? "warning" : "danger"}>{policy.status === "CONFIRMED" ? "확인됨" : policy.status === "PARTIAL" ? "일부 구현" : "결정 대기"}</StatusBadge></td><td>{policy.rule}</td><td>{policy.note}</td></tr>)}</tbody></DataTable></section>
    </div>
  );
}
