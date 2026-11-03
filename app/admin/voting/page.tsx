"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import { teamDisplayName } from "@/features/event/data/teamSlots";
import type { AudienceBallotAggregate } from "@/types/audience-ballot-aggregate";
import { OperationAlert } from "@/components/ui/OperationAlert";

export default function VotingAdminPage() {
  const { state } = useEventOps();
  type Category = "BUSINESS_ANALYSIS" | "STARTUP";
  type SessionAction = { category: Category; status: "OPEN" | "CLOSED" };
  const [pending, setPending] = useState<SessionAction | null>(null);
  const [session, setSession] = useState<{ category: Category | null; votingStatus: "READY" | "OPEN" | "CLOSED" }>({ category: null, votingStatus: "READY" });
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionFeedback, setSessionFeedback] = useState("");
  const [rankAggregate, setRankAggregate] = useState<AudienceBallotAggregate | null>(null);
  const [aggregateError, setAggregateError] = useState("");
  const loadRankAggregate = useCallback(async () => {
    if (document.hidden || !navigator.onLine) return;
    const response = await fetch(`/api/audience-ballot/aggregate?eventId=${encodeURIComponent(state.eventId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok && payload.ok) { setRankAggregate(payload.data as AudienceBallotAggregate); setAggregateError(""); }
    else setAggregateError(payload.error?.message ?? "청중평가 원표 집계를 조회하지 못했습니다.");
  }, [state.eventId]);
  const loadSession = useCallback(async () => {
    const response = await fetch(`/api/audience-ballot/session?eventId=${encodeURIComponent(state.eventId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (response.ok && payload.ok) setSession({ category: payload.data.category, votingStatus: payload.data.votingStatus });
    else setSessionFeedback(payload.error?.message ?? "투표 세션을 조회하지 못했습니다.");
  }, [state.eventId]);
  useEffect(() => {
    const initial = window.setTimeout(() => { void loadRankAggregate(); void loadSession(); }, 0);
    const interval = window.setInterval(() => { void loadRankAggregate(); void loadSession(); }, 3000);
    const resume = () => { void loadRankAggregate(); void loadSession(); };
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); window.removeEventListener("online", resume); document.removeEventListener("visibilitychange", resume); };
  }, [loadRankAggregate, loadSession]);
  const changeSession = async (action: SessionAction) => {
    setSessionBusy(true); setSessionFeedback("");
    const response = await fetch("/api/audience-ballot/session", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: state.eventId, ...action }) });
    const payload = await response.json();
    if (response.ok && payload.ok) {
      setSession({ category: payload.data.category, votingStatus: payload.data.votingStatus });
      setSessionFeedback(`${action.category === "BUSINESS_ANALYSIS" ? "기업분석" : "창업경진"} 부문 투표를 ${action.status === "OPEN" ? "시작" : "마감"}했습니다.`);
      await loadRankAggregate();
    } else setSessionFeedback(payload.error?.message ?? "투표 세션 상태를 변경하지 못했습니다.");
    setSessionBusy(false); setPending(null);
  };
  const voteByTeam = new Map(state.voteByTeam.map((team) => [team.teamId, team]));
  const totalSubmitted = rankAggregate?.categories.reduce((sum, category) => sum + category.submittedBallots, 0) ?? 0;
  return (
    <div className="admin-page">
      <div className="admin-page__top"><SectionLabel label="AUDIENCE VOTE" title="청중평가 시작·마감" description="기업분석과 창업경진을 각각 한 번씩 열고 닫습니다." /><StatusBadge tone={session.votingStatus === "OPEN" ? "success" : "warning"}>{session.votingStatus === "OPEN" ? "투표 진행 중" : "투표 닫힘"}</StatusBadge></div>
      <section className={`ops-status-strip ops-status-strip--${session.votingStatus.toLowerCase()}`}><div><small>CURRENT SESSION</small><strong>{session.votingStatus === "OPEN" ? `${session.category === "BUSINESS_ANALYSIS" ? "기업분석" : "창업경진"} 투표 진행 중` : "현재 열린 투표 없음"}</strong></div><div><span><small>선택 방식</small><b>예상 1위 후보 2팀</b></span><span><small>우선순위</small><b>없음 · 동등 2표</b></span></div></section>
      <section className="stat-grid stat-grid--4"><StatCard label="PCU 발급 인원" value={rankAggregate?.acceptedJuryCount ?? 0} detail="/ 120명" icon="#" /><StatCard label="부문별 제출 합계" value={totalSubmitted} detail="건" accent icon="◎" /><StatCard label="기업분석 제출" value={rankAggregate?.categories.find((item) => item.category === "BUSINESS_ANALYSIS")?.submittedBallots ?? 0} detail="명" icon="B" /><StatCard label="창업경진 제출" value={rankAggregate?.categories.find((item) => item.category === "STARTUP")?.submittedBallots ?? 0} detail="명" icon="S" /></section>
      <section className="category-vote-controls">
        {(["BUSINESS_ANALYSIS", "STARTUP"] as const).map((category, index) => { const isOpen = session.votingStatus === "OPEN" && session.category === category; const submitted = rankAggregate?.categories.find((item) => item.category === category)?.submittedBallots ?? 0; return <article className={`admin-card category-vote-control ${isOpen ? "is-open" : ""}`} key={category}>
          <header><span>SESSION {index + 1}</span><StatusBadge tone={isOpen ? "success" : "neutral"}>{isOpen ? "OPEN" : "CLOSED"}</StatusBadge></header>
          <h2>{category === "BUSINESS_ANALYSIS" ? "기업분석 부문" : "창업경진 부문"}</h2><p>{category === "BUSINESS_ANALYSIS" ? "15:00~16:00 · 기업분석 6팀" : "16:00~17:00 · 창업경진 6팀"}</p>
          <strong>{submitted}명 제출</strong><small>서로 다른 예상 1위 후보 2팀 선택</small>
          <div><button className="admin-button admin-button--primary" type="button" disabled={sessionBusy || session.votingStatus === "OPEN"} onClick={() => setPending({ category, status: "OPEN" })}>{category === "BUSINESS_ANALYSIS" ? "세션 1 투표 시작" : "세션 2 투표 시작"}</button><button className="admin-button admin-button--danger" type="button" disabled={sessionBusy || !isOpen} onClick={() => setPending({ category, status: "CLOSED" })}>이 부문 투표 마감</button></div>
        </article>; })}
      </section>
      <p className="participant-feedback" role="status">{sessionFeedback}</p>
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
      <ConfirmModal open={pending !== null} title={pending?.status === "OPEN" ? `${pending.category === "BUSINESS_ANALYSIS" ? "기업분석" : "창업경진"} 투표를 시작할까요?` : "현재 부문 투표를 마감할까요?"} description={pending?.status === "OPEN" ? "PCU 인증을 마친 청중평가단이 이 부문의 서로 다른 후보 2팀을 제출할 수 있습니다." : "마감 즉시 추가 제출이 차단되며 이미 제출된 원표는 보존됩니다."} confirmLabel={pending?.status === "OPEN" ? "투표 시작" : "투표 마감"} danger={pending?.status === "CLOSED"} onCancel={() => setPending(null)} onConfirm={() => { if (pending) void changeSession(pending); }} />
    </div>
  );
}
