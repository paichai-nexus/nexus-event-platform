"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { ProgressCard } from "@/components/ui/ProgressCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import type { VotingStatus } from "@/types/voting";
import { teamDisplayName } from "@/features/event/data/teamSlots";
import type { AudienceBallotAggregate } from "@/types/audience-ballot-aggregate";
import { OperationAlert } from "@/components/ui/OperationAlert";

export default function VotingAdminPage() {
  const { state, setVotingStatus } = useEventOps();
  const [pending, setPending] = useState<VotingStatus | null>(null);
  const [rankAggregate, setRankAggregate] = useState<AudienceBallotAggregate | null>(null);
  const [aggregateError, setAggregateError] = useState("");
  const loadRankAggregate = useCallback(async () => {
    if (document.hidden || !navigator.onLine) return;
    const response = await fetch(`/api/audience-ballot/aggregate?eventId=${encodeURIComponent(state.eventId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok && payload.ok) { setRankAggregate(payload.data as AudienceBallotAggregate); setAggregateError(""); }
    else setAggregateError(payload.error?.message ?? "청중평가 원표 집계를 조회하지 못했습니다.");
  }, [state.eventId]);
  useEffect(() => {
    const initial = window.setTimeout(() => void loadRankAggregate(), 0);
    const interval = window.setInterval(() => void loadRankAggregate(), 3000);
    const resume = () => void loadRankAggregate();
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("online", resume); document.removeEventListener("visibilitychange", resume); };
  }, [loadRankAggregate]);
  const voteByTeam = new Map(state.voteByTeam.map((team) => [team.teamId, team]));
  const activeVote = state.activeTeamId ? voteByTeam.get(state.activeTeamId) : undefined;
  const participation = activeVote?.eligibilityCount
    ? Math.round((activeVote.voteCount / activeVote.eligibilityCount) * 100)
    : 0;
  return (
    <div className="admin-page">
      <div className="admin-page__top"><SectionLabel label="AUDIENCE VOTE" title="청중평가 운영" description="참여 현황과 투표 상태를 서버 기준으로 제어합니다." /><StatusBadge tone={state.votingStatus === "OPEN" ? "success" : state.votingStatus === "CLOSED" ? "danger" : "warning"}>VOTING {state.votingStatus}</StatusBadge></div>
      <section className={`ops-status-strip ops-status-strip--${state.votingStatus.toLowerCase()}`}><div><small>CURRENT STATUS</small><strong>청중평가 {state.votingStatus === "OPEN" ? "진행 중" : state.votingStatus === "CLOSED" ? "마감" : "준비"}</strong></div><div><span><small>다음 단계</small><b>{state.votingStatus === "OPEN" ? "투표 마감" : "점수 집계"}</b></span><span><small>데이터</small><b>SERVER SOURCE</b></span></div></section>
      <section className="stat-grid stat-grid--4"><StatCard label="체크인 인원" value={state.checkInCount} detail="명" icon="↳" /><StatCard label="투표 제출" value={state.voteCount} detail="건" accent icon="◎" /><StatCard label="참여율" value={`${participation}%`} progress={participation} icon="↗" /><StatCard label="중복 제출 차단" value="활성" detail="팀별 1회" icon="⊘" /></section>
      <section className="voting-control-grid">
        <div className="admin-card"><PanelHeader label="VOTING CONTROL" title="투표 상태 제어" aside={<StatusBadge tone={state.votingStatus === "OPEN" ? "success" : "warning"}>{state.votingStatus}</StatusBadge>} /><div className="voting-state-steps"><span className={state.votingStatus === "READY" ? "is-active" : ""}>01 READY</span><span className={state.votingStatus === "OPEN" ? "is-active" : ""}>02 OPEN</span><span className={state.votingStatus === "CLOSED" ? "is-active" : ""}>03 CLOSED</span></div><div className="control-panel"><p>상태 변경은 서버 저장 성공 후 화면에 반영됩니다.</p><button className="admin-button admin-button--primary" type="button" onClick={() => setPending("OPEN")} disabled={state.votingStatus === "OPEN"}>투표 시작</button><button className="admin-button admin-button--danger" type="button" onClick={() => setPending("CLOSED")} disabled={state.votingStatus === "CLOSED"}>투표 마감</button></div></div>
        <ProgressCard label="CURRENT TEAM PARTICIPATION" value={activeVote?.voteCount ?? 0} total={activeVote?.eligibilityCount ?? state.checkInCount} completeLabel="제출" remainingLabel="미제출" />
      </section>
      <section className="admin-card"><PanelHeader label="TEAM SUBMISSIONS" title="팀별 제출 현황" aside={<span className="mock-note">{state.runtimeMode === "mock" ? "EXPLICIT MOCK" : "DATABASE"}</span>} /><div className="team-submission-list">{state.teams.map((team) => { const count = voteByTeam.get(team.id); const value = count?.voteCount ?? 0; const eligible = count?.eligibilityCount ?? 0; const percent = eligible ? Math.round((value / eligible) * 100) : 0; return <div key={team.id}><span>{String(team.order).padStart(2, "0")}</span><strong>{teamDisplayName(team)}</strong><small>{value} / {eligible}</small><div className="progress-track"><i style={{ width: `${percent}%` }} /></div><b>{percent}%</b></div>; })}</div></section>
      <OperationAlert level="INFO">아래 표는 청중이 선정한 1위 후보 2팀의 동등 선택 집계입니다. A/B 선택에는 우선순위가 없으며, 공식 청중점수 환산식 승인 전에는 점수·순위로 변환하지 않습니다.</OperationAlert>
      <section className="audience-rank-aggregate">
        {rankAggregate?.categories.map((category) => {
          const maximum = Math.max(1, ...category.teams.map((team) => team.firstVotes + team.secondVotes));
          return <article className="admin-card" key={category.category}>
            <PanelHeader label={category.category === "STARTUP" ? "STARTUP" : "BUSINESS ANALYSIS"} title={category.category === "STARTUP" ? "창업 부문 선택 현황" : "기업분석 부문 선택 현황"} aside={<span className="mock-note">{category.submittedBallots}명 제출</span>} />
            <div className="rank-vote-list">{category.teams.map((team) => <div key={team.teamId}>
              <span>{String(team.order).padStart(2, "0")}</span><strong>{team.teamName}</strong>
              <div className="rank-vote-bars"><i style={{ width: `${((team.firstVotes + team.secondVotes) / maximum) * 100}%` }} /></div>
              <small>1위 후보 선택 <b>{team.firstVotes + team.secondVotes}</b>표</small>
            </div>)}</div>
          </article>;
        })}
      </section>
      <p className="participant-feedback" role="status">{aggregateError || (rankAggregate ? `청중평가단 ${rankAggregate.acceptedJuryCount}명 · ${new Date(rankAggregate.updatedAt).toLocaleTimeString("ko-KR")} 동기화` : "원표 집계 연결 중…")}</p>
      <ConfirmModal open={pending !== null} title={pending === "OPEN" ? "청중평가를 시작할까요?" : "청중평가를 마감할까요?"} description={pending === "OPEN" ? "참가자 화면에서 평가 제출이 가능해집니다." : "마감 후에는 참가자가 더 이상 제출할 수 없습니다."} confirmLabel={pending === "OPEN" ? "투표 시작" : "투표 마감"} danger={pending === "CLOSED"} onCancel={() => setPending(null)} onConfirm={() => { if (pending) setVotingStatus(pending); setPending(null); }} />
    </div>
  );
}
