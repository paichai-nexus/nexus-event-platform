"use client";

import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import { teamDisplayName } from "@/features/event/data/teamSlots";

export default function JudgingAdminPage() {
  const { state } = useEventOps();
  const missing = state.judgeProgress.filter((judge) => judge.completed < judge.total);
  const submitted = state.judgeProgress.length - missing.length;
  const totalCompleted = state.judgeProgress.reduce((sum, judge) => sum + judge.completed, 0);
  const totalSlots = state.judgeProgress.reduce((sum, judge) => sum + judge.total, 0);
  const averageProgress = Math.round((totalCompleted / totalSlots) * 100);
  const currentTeam = state.teams.find((team) => team.status === "PRESENTING") ?? state.teams[0];
  return (
    <div className="admin-page">
      <SectionLabel label="JUDGING" title="심사 운영 현황" description="관리자 Snapshot과 동일한 서버 제출 상태를 확인합니다." />
      {missing.length > 0 && <OperationAlert level="WARNING">미제출 심사위원 {missing.length}명이 있습니다.</OperationAlert>}
      <section className="stat-grid stat-grid--4"><StatCard label="심사위원" value={state.judgeProgress.length} detail="명" icon="●" /><StatCard label="제출 완료" value={submitted} detail="명" accent icon="✓" /><StatCard label="미제출" value={missing.length} detail="명" icon="!" /><StatCard label="평균 진행률" value={`${averageProgress}%`} progress={averageProgress} icon="↗" /></section>
      <section className="judging-layout">
        <article className="admin-card">
          <PanelHeader label="JUDGE STATUS" title="심사위원 진행률" aside={<StatusBadge tone={missing.length ? "warning" : "success"}>{submitted} / {state.judgeProgress.length} 제출</StatusBadge>} />
          <div className="judge-progress-list">{state.judgeProgress.map((judge) => { const percent = Math.round((judge.completed / judge.total) * 100); return <div key={judge.id}><span className="judge-avatar">●</span><strong>{judge.id}</strong><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><b>{judge.completed} / {judge.total}</b><StatusBadge tone={judge.completed === judge.total ? "success" : judge.completed ? "warning" : "danger"}>{judge.completed === judge.total ? "완료" : judge.completed ? "진행 중" : "미제출"}</StatusBadge></div>; })}</div>
        </article>
        <aside className="admin-card current-judging-card">
          <PanelHeader label="CURRENT TEAM" title="현재 심사 대상" aside={<StatusBadge tone="blue">발표 중</StatusBadge>} />
          <div className="current-judging-card__order">{String(currentTeam.order).padStart(2, "0")}</div>
          <strong>{teamDisplayName(currentTeam)}</strong>
          <p>{currentTeam.category === "STARTUP" ? "창업 부문" : "기업분석 부문"}</p>
          <dl><div><dt>발표 순서</dt><dd>{currentTeam.order}번째</dd></div><div><dt>평가 기준</dt><dd>임시안 · 미확정</dd></div><div><dt>저장 방식</dt><dd>Server Snapshot</dd></div></dl>
          <OperationAlert level="INFO">세부 평가항목과 배점은 공식 확정 전입니다.</OperationAlert>
        </aside>
      </section>
    </div>
  );
}
