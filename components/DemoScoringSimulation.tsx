"use client";

import { useEffect, useRef, useState } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  calculateDemoScoring,
  DEMO_AUDIENCE_ELIGIBLE_COUNT,
  DEMO_SCORING_INPUTS,
  type DemoScoringRow,
} from "@/features/scoring/lib/demoScoringSimulation";

export function DemoScoringSimulation() {
  const [rows, setRows] = useState<DemoScoringRow[] | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const highestVoteCount = Math.max(...DEMO_SCORING_INPUTS.map((input) => input.audienceVotes));

  useEffect(() => {
    if (window.sessionStorage.getItem("rehearsal-demo-scoring") === "complete") {
      const timer = window.setTimeout(() => setRows(calculateDemoScoring(DEMO_SCORING_INPUTS)), 0);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const runSimulation = () => {
    const calculated = calculateDemoScoring(DEMO_SCORING_INPUTS);
    setRows(calculated);
    window.sessionStorage.setItem("rehearsal-demo-scoring", "complete");
    window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const resetSimulation = () => {
    setRows(null);
    window.sessionStorage.removeItem("rehearsal-demo-scoring");
  };

  return (
    <section className="admin-card demo-scoring" aria-label="교수님 검증용 점수 시뮬레이션">
      <PanelHeader label="TRACEABLE DEMO" title="교수님 검증용 점수 연산 시뮬레이션" aside={<StatusBadge tone="warning">공식 결과 아님</StatusBadge>} />
      <OperationAlert level="WARNING">청중점수 환산식과 최종 반영률은 승인 전입니다. 아래 결과는 입력과 계산 과정을 검증하기 위한 메모리 내 시뮬레이션이며 DB·순위·결과 Snapshot에 저장되지 않습니다.</OperationAlert>
      <div className="demo-scoring__formula">
        <div><small>STEP 1 · 전문심사</small><strong>심사위원 3명 합계 ÷ 3 ÷ 200 × 100</strong><span>각 심사위원 원점수 최대 200점</span></div>
        <div><small>STEP 2 · 청중평가</small><strong>팀 유효표 ÷ 최고 득표수 {highestVoteCount} × 100</strong><span>시연 가정식 · 공식 환산식 아님</span></div>
        <div><small>STEP 3 · 비교 계산</small><strong>전문×80% + 청중×20%</strong><span>기존 시스템안</span></div>
        <div><small>STEP 4 · 문서 후보</small><strong>전문×70% + 청중×30%</strong><span>교수진 승인 전 후보안</span></div>
      </div>
      <DataTable label="시뮬레이션 원본 입력"><thead><tr><th>팀</th><th>심사위원 1</th><th>심사위원 2</th><th>심사위원 3</th><th>청중 유효표</th><th>청중 자격 인원</th></tr></thead><tbody>{DEMO_SCORING_INPUTS.map((input) => <tr key={input.teamId}><td><strong>{input.teamName}</strong></td>{input.judgeScores.map((score, index) => <td key={`${input.teamId}-${index}`}>{score} / 200</td>)}<td>{input.audienceVotes}표</td><td>{DEMO_AUDIENCE_ELIGIBLE_COUNT}명</td></tr>)}</tbody></DataTable>
      <div className="demo-scoring__actions"><button className="admin-button admin-button--primary" type="button" onClick={runSimulation}>{rows ? "데모 연산 다시 실행" : "데모 연산 실행"}</button><button className="admin-button admin-button--ghost" type="button" disabled={!rows} onClick={resetSimulation}>연산 결과 초기화</button></div>
      {rows && <>
        <div className="demo-scoring__audit" role="status" ref={resultsRef} tabIndex={-1}><strong>연산 완료 · {rows.length}개 팀</strong><span>원본 입력 → 전문점수 환산 → 청중점수 시연 환산 → 정책별 가중합</span><b>officialScoresAvailable: false</b></div>
        <DataTable label="점수 연산 결과"><thead><tr><th>팀</th><th>전문 합계</th><th>전문 평균</th><th>전문 100점 환산</th><th>청중 100점 환산</th><th>80:20</th><th>70:30 후보</th></tr></thead><tbody>{rows.map((row) => <tr key={row.teamId}><td><strong>{row.teamName}</strong></td><td>{row.judgeTotal} / 600</td><td>{row.judgeAverage} / 200</td><td>{row.professionalScore100}</td><td>{row.audienceScore100}</td><td className="score-total">{row.score8020}</td><td className="score-total score-total--candidate">{row.score7030}</td></tr>)}</tbody></DataTable>
        <div className="demo-scoring__trace">{rows.map((row) => <article key={row.teamId}><strong>{row.teamName}</strong><code>전문: ({row.judgeScores.join(" + ")}) ÷ 3 ÷ 200 × 100 = {row.professionalScore100}</code><code>청중: {row.audienceVotes} ÷ {highestVoteCount} × 100 = {row.audienceScore100}</code><code>80:20 = {row.professionalScore100} × 0.8 + {row.audienceScore100} × 0.2 = {row.score8020}</code><code>70:30 = {row.professionalScore100} × 0.7 + {row.audienceScore100} × 0.3 = {row.score7030}</code></article>)}</div>
      </>}
    </section>
  );
}
