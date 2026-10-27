"use client";

import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { ProgressCard } from "@/components/ui/ProgressCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useState } from "react";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import { calculateScoreRows } from "@/features/scoring/lib/calculateScores";
import { DISPLAY_MODE_LABELS, EVENT_STATUS_LABELS, type DisplayMode, type EventStatus } from "@/types/event";
import { teamDisplayName } from "@/features/event/data/teamSlots";

export default function DashboardPage() {
  const { state, activateTeam, completeActiveTeam, setDisplayMode, setEventStatus, setVotingStatus } = useEventOps();
  const submittedJudges = state.judgeProgress.filter((judge) => judge.completed === judge.total).length;
  const scoreRows = calculateScoreRows(state.scoreInputs);
  const hasTie = scoreRows.some((row) => row.tied);
  const incompleteJudges = state.judgeProgress.length - submittedJudges;
  const alertCount = incompleteJudges + (state.votingStatus !== "CLOSED" ? 1 : 0) + (hasTie ? 1 : 0) + (state.networkOverride === "OFFLINE" ? 1 : 0);
  const currentTeam = state.teams.find((team) => team.status === "PRESENTING");
  const registeredTeams = state.teams.filter((team) => team.name);
  const promotedTeams = registeredTeams.filter((team) => team.promotionEnabled !== false);
  const [promotionIndex, setPromotionIndex] = useState(0);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [controlBusy, setControlBusy] = useState(false);
  const [controlFeedback, setControlFeedback] = useState("");
  const promotedTeam = promotedTeams[promotionIndex % Math.max(promotedTeams.length, 1)];
  const activeVote = state.activeTeamId ? state.voteByTeam.find((team) => team.teamId === state.activeTeamId) : undefined;
  const checkInPercent = state.registeredCount ? Math.round((state.checkInCount / state.registeredCount) * 100) : 0;
  const votePercent = activeVote?.eligibilityCount ? Math.round((activeVote.voteCount / activeVote.eligibilityCount) * 100) : 0;
  const judgePercent = state.judgeProgress.length ? Math.round((submittedJudges / state.judgeProgress.length) * 100) : 0;
  const runControl = async (action: () => Promise<boolean>, success: string) => {
    setControlBusy(true);
    setControlFeedback("");
    const accepted = await action();
    setControlFeedback(accepted ? success : "상태 조건 또는 권한을 확인해주세요.");
    setControlBusy(false);
  };
  const nextStatus: Partial<Record<EventStatus, { status: EventStatus; label: string }>> = {
    SETUP: { status: "CHECK_IN_OPEN", label: "행사 시작" },
    CHECK_IN_OPEN: { status: "VOTING_READY", label: "발표 운영 준비" },
    VOTING_CLOSED: { status: "JUDGING", label: "심사 시작" },
    JUDGING: { status: "SCORING", label: "점수 집계 시작" },
    FINALIZED: { status: "ENDED", label: "행사 종료" },
  };
  const next = nextStatus[state.status];

  return (
    <div className="admin-page">
      <div className="admin-page__top admin-page__top--hero">
        <SectionLabel label="ACADEMIC FESTIVAL" title="행사 운영 현황" description="2026. 11. 04. WED · 배재대학교 21세기관" />
        <div><StatusBadge tone="blue" className="dashboard-event-status">{EVENT_STATUS_LABELS[state.status]}</StatusBadge></div>
      </div>

      <section className="mode-banner">
        <div className="mode-banner__primary"><small>EVENT STATUS</small><strong>{EVENT_STATUS_LABELS[state.status]}</strong></div>
        <div className="mode-banner__meta"><span><small>현재 진행</small><b>{currentTeam?.name ?? "대기"}</b></span><span><small>다음 단계</small><b>{state.votingStatus === "OPEN" ? "투표 마감" : "점수 집계"}</b></span></div>
      </section>

      <section className="admin-card mission-control" aria-label="행사 통합 제어">
        <PanelHeader label="MISSION CONTROL" title="행사 통합 제어" aside={<span className="snapshot-version">SNAPSHOT v{state.snapshotVersion}</span>} />
        <div className="mission-control__grid">
          <div className="mission-control__group">
            <small>EVENT</small>
            <strong>{EVENT_STATUS_LABELS[state.status]}</strong>
            {next ? <button className="admin-button admin-button--primary" type="button" disabled={controlBusy} onClick={() => void runControl(() => setEventStatus(next.status), next.label)}>{next.label}</button> : <span className="control-lock">수동 전환 없음</span>}
          </div>
          <div className="mission-control__group mission-control__group--wide">
            <small>PRESENTATION</small>
            <select aria-label="발표팀 선택" value={selectedTeamId || state.activeTeamId || ""} disabled={controlBusy || Boolean(state.activeTeamId)} onChange={(event) => setSelectedTeamId(event.target.value)}>
              <option value="">발표팀 선택</option>
              {registeredTeams.filter((team) => team.status !== "DONE").map((team) => <option key={team.id} value={team.id}>{String(team.order).padStart(2, "0")} · {team.name}</option>)}
            </select>
            {state.activeTeamId
              ? <button className="admin-button admin-button--danger" type="button" disabled={controlBusy} onClick={() => void runControl(completeActiveTeam, "발표를 완료하고 투표를 마감했습니다.")}>발표 완료</button>
              : <button className="admin-button admin-button--primary" type="button" disabled={controlBusy || !selectedTeamId} onClick={() => void runControl(() => activateTeam(selectedTeamId), "발표팀을 시작했습니다.")}>발표 시작</button>}
          </div>
          <div className="mission-control__group">
            <small>AUDIENCE VOTE</small>
            <strong>{state.votingStatus}</strong>
            <div className="mission-control__buttons">
              <button className="admin-button" type="button" disabled={controlBusy || !state.activeTeamId} onClick={() => void runControl(() => setVotingStatus("OPEN"), "청중평가를 열었습니다.")}>열기</button>
              <button className="admin-button" type="button" disabled={controlBusy || state.votingStatus !== "OPEN"} onClick={() => void runControl(() => setVotingStatus("CLOSED"), "청중평가를 마감했습니다.")}>마감</button>
            </div>
          </div>
          <div className="mission-control__group mission-control__group--display">
            <small>DISPLAY</small>
            <strong>{DISPLAY_MODE_LABELS[state.displayMode]}</strong>
            <div className="mission-control__buttons">
              {(["SPOTLIGHT", "VOTE_PROGRESS", "HOLDING"] as DisplayMode[]).map((mode) => <button key={mode} className={`admin-button ${state.displayMode === mode ? "admin-button--primary" : ""}`} type="button" disabled={controlBusy || (mode === "SPOTLIGHT" && !state.activeTeamId)} onClick={() => void runControl(() => setDisplayMode(mode), `${DISPLAY_MODE_LABELS[mode]} 화면으로 전환했습니다.`)}>{DISPLAY_MODE_LABELS[mode]}</button>)}
            </div>
          </div>
        </div>
        <p className="mission-control__feedback" role="status">{controlFeedback || `서버 시각 ${state.serverTime ? new Date(state.serverTime).toLocaleTimeString("ko-KR") : "동기화 중"}`}</p>
      </section>

      <section className="stat-grid stat-grid--6" aria-label="핵심 운영 수치">
        <StatCard label="전체 등록" value={state.registeredCount} detail="명" icon="✦" />
        <StatCard label="입장 완료" value={state.checkInCount} detail={`/ ${state.registeredCount} · ${checkInPercent}%`} accent icon="↳" progress={checkInPercent} />
        <StatCard label="현재 팀 청중평가" value={activeVote?.voteCount ?? 0} detail={`/ ${activeVote?.eligibilityCount ?? 0} · ${votePercent}%`} icon="◎" progress={votePercent} />
        <StatCard label="심사 제출" value={`${submittedJudges} / ${state.judgeProgress.length}`} detail={`${judgePercent}% 완료`} icon="✎" progress={judgePercent} />
        <StatCard label="본선 팀" value={registeredTeams.length} detail={`/ ${state.teams.length} 슬롯`} icon="◫" />
        <StatCard label="운영 알림" value={alertCount} detail="건 확인 필요" icon="!" />
      </section>

      <section className="admin-grid admin-grid--3">
        <ProgressCard label="CHECK-IN" value={state.checkInCount} total={state.registeredCount} />
        <ProgressCard label="AUDIENCE VOTE" value={activeVote?.voteCount ?? 0} total={activeVote?.eligibilityCount ?? 0} />
        <ProgressCard label="JUDGE STATUS" value={submittedJudges} total={state.judgeProgress.length} />
      </section>

      <section className="admin-card team-promotion-card">
        <PanelHeader label="TEAM PROMOTION" title="본선 팀 홍보" aside={<span className="mock-note">{promotedTeams.length} TEAMS</span>} />
        {promotedTeam ? <div className="team-promotion-card__body">
          <div className="team-promotion-card__order"><span>{String(promotedTeam.order).padStart(2, "0")}</span><small>{promotedTeam.category === "STARTUP" ? "창업 부문" : "기업분석 부문"}</small></div>
          <div className="team-promotion-card__content"><strong>{promotedTeam.name}</strong><p>{promotedTeam.topic ?? "발표 주제 준비 중"}</p><dl><div><dt>대표자</dt><dd>{promotedTeam.leaderName ?? "미등록"}</dd></div><div><dt>팀원</dt><dd>{promotedTeam.memberNames?.join(", ") || "미등록"}</dd></div></dl></div>
          <div className="team-promotion-card__controls"><button className="admin-button" type="button" onClick={() => setPromotionIndex((index) => (index - 1 + promotedTeams.length) % promotedTeams.length)}>이전 팀</button><b>{promotionIndex % promotedTeams.length + 1} / {promotedTeams.length}</b><button className="admin-button admin-button--primary" type="button" onClick={() => setPromotionIndex((index) => (index + 1) % promotedTeams.length)}>다음 팀</button></div>
        </div> : <p className="muted-copy">홍보 가능한 등록 팀이 없습니다.</p>}
      </section>

      <section className="dashboard-bottom-grid">
        <article className="admin-card">
          <PanelHeader label="CURRENT SESSION" title="본선 팀 진행" aside={<StatusBadge tone="blue">{currentTeam?.name ?? "대기"}</StatusBadge>} />
          {currentTeam && <div className="current-team-card"><small>현재 발표 중</small><strong>{teamDisplayName(currentTeam)}</strong><span>{currentTeam.category === "STARTUP" ? "창업 부문" : "기업분석 부문"}</span></div>}
          <div className="team-timeline">
            {registeredTeams.map((team) => <div key={team.id} className={`team-timeline__item team-timeline__item--${team.status.toLowerCase()}`}><span>{String(team.order).padStart(2, "0")}</span><strong>{teamDisplayName(team)}</strong><small>{team.status === "DONE" ? "완료" : team.status === "PRESENTING" ? "발표 중" : "대기"}</small></div>)}
          </div>
        </article>
        <article className="admin-card">
          <PanelHeader label="OPERATION ALERT" title="운영 알림" aside={<span className="panel-count">{alertCount}</span>} />
          <div className="alert-list">
            {incompleteJudges > 0 && <OperationAlert level="WARNING">심사위원 {incompleteJudges}명 미제출</OperationAlert>}
            {state.votingStatus !== "CLOSED" && <OperationAlert level="WARNING">청중평가가 아직 마감되지 않았습니다.</OperationAlert>}
            {hasTie && <OperationAlert level="CRITICAL">동점 팀이 존재합니다. 공식 처리 규정을 확인하세요.</OperationAlert>}
            {state.networkOverride === "OFFLINE" && <OperationAlert level="CRITICAL">네트워크가 Offline 상태입니다.</OperationAlert>}
          </div>
        </article>
        <article className="admin-card recent-activity">
          <PanelHeader label="RECENT ACTIVITY" title="최근 활동" aside={<span className="mock-note">MOCK</span>} />
          <ol>{state.activities.slice(0, 6).map((item) => <li key={item.id}><time>{item.time}</time><span /><div><small>{item.category}</small><p>{item.message}</p></div></li>)}</ol>
        </article>
      </section>
    </div>
  );
}
