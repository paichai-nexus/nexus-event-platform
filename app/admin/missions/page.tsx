"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/States";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import type { CheerMission, MissionParticipation } from "@/types/mission";

const EMPTY_MISSION: Omit<CheerMission, "id"> = { title: "", description: "", type: "DEPARTMENT_INTRO", points: 0, status: "DRAFT", experimental: false };

export default function MissionsPage() {
  const { state } = useEventOps();
  const [missions, setMissions] = useState<CheerMission[]>([]);
  const [participations, setParticipations] = useState<MissionParticipation[]>([]);
  const [draft, setDraft] = useState<CheerMission | Omit<CheerMission, "id"> | null>(null);
  const [feedback, setFeedback] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/missions?eventId=${state.eventId}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    setMissions(payload.data.missions);
    setParticipations(payload.data.participations);
  }, [state.eventId]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const editing = "id" in draft;
    const response = await fetch("/api/missions", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...draft, eventId: state.eventId }) });
    setFeedback(response.ok ? "응원 미션이 저장되었습니다." : "미션을 저장하지 못했습니다.");
    if (response.ok) { setDraft(null); await refresh(); }
  };

  const review = async (participationId: string, reviewStatus: "APPROVED" | "REJECTED") => {
    const response = await fetch("/api/missions", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId: state.eventId, participationId, reviewStatus }) });
    if (response.ok) await refresh();
  };

  return <div className="admin-page">
    <SectionLabel label="CHEER MISSIONS" title="응원점수 미션 관리" description="현장 참여 미션을 만들고 참여 승인과 점수를 관리합니다." />
    <OperationAlert level="INFO">응원점수는 공식 전문심사·청중평가 점수와 완전히 분리됩니다. 박수 이벤트는 실험 기능으로만 등록할 수 있습니다.</OperationAlert>
    <button className="admin-button admin-button--primary" type="button" onClick={() => setDraft({ ...EMPTY_MISSION })}>새 미션 만들기</button>
    {draft && <form className="admin-card mission-editor" onSubmit={save}><PanelHeader label="MISSION EDITOR" title={"id" in draft ? "미션 수정" : "새 미션"} aside={<button className="admin-button" type="button" onClick={() => setDraft(null)}>닫기</button>} /><div className="mission-editor__fields">
      <label className="admin-field">미션명<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="admin-field">유형<select value={draft.type} onChange={(event) => { const type = event.target.value as CheerMission["type"]; setDraft({ ...draft, type, experimental: type === "APPLAUSE_EXPERIMENT" || draft.experimental }); }}><option value="DEPARTMENT_INTRO">본인 학과 소개</option><option value="TEAM_SUPPORT">참가팀 응원</option><option value="BUSINESS_QUIZ">경영학 상식 퀴즈</option><option value="OX_QUIZ">OX 퀴즈</option><option value="APPLAUSE_EXPERIMENT">박수 이벤트(실험)</option></select></label>
      <label className="admin-field">점수<input type="number" min="0" max="10000" value={draft.points} onChange={(event) => setDraft({ ...draft, points: Number(event.target.value) })} /></label>
      <label className="admin-field">상태<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as CheerMission["status"] })}><option value="DRAFT">초안</option><option value="ACTIVE">진행</option><option value="CLOSED">종료</option></select></label>
      <label className="admin-field mission-editor__description">설명<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
    </div><button className="admin-button admin-button--primary" type="submit">저장</button></form>}
    <section className="admin-card"><PanelHeader label="MISSION LIST" title="미션 목록" aside={<span className="mock-note">{missions.length} MISSIONS</span>} />{missions.length ? <DataTable label="응원 미션 목록"><thead><tr><th>미션</th><th>유형</th><th>점수</th><th>상태</th><th>구분</th><th>관리</th></tr></thead><tbody>{missions.map((mission) => <tr key={mission.id}><td><strong>{mission.title}</strong></td><td>{mission.type}</td><td>{mission.points}</td><td><StatusBadge tone={mission.status === "ACTIVE" ? "success" : mission.status === "CLOSED" ? "danger" : "warning"}>{mission.status}</StatusBadge></td><td>{mission.experimental ? "실험" : "일반"}</td><td><button className="admin-button admin-button--compact" type="button" onClick={() => setDraft({ ...mission })}>수정</button></td></tr>)}</tbody></DataTable> : <EmptyState message="등록된 응원 미션이 없습니다." />}</section>
    <section className="admin-card"><PanelHeader label="PARTICIPATION HISTORY" title="참여 승인 및 이력" aside={<span className="mock-note">{participations.length} RECORDS</span>} />{participations.length ? <DataTable label="미션 참여 이력"><thead><tr><th>참여자</th><th>미션</th><th>신청 시각</th><th>상태</th><th>점수</th><th>승인</th></tr></thead><tbody>{participations.map((item) => <tr key={item.id}><td>{item.participantId}</td><td>{missions.find((mission) => mission.id === item.missionId)?.title ?? "삭제된 미션"}</td><td>{item.createdAt}</td><td>{item.status}</td><td>{item.awardedPoints}</td><td><button className="admin-button admin-button--compact" type="button" onClick={() => void review(item.id, "APPROVED")}>승인</button><button className="admin-button admin-button--compact" type="button" onClick={() => void review(item.id, "REJECTED")}>거절</button></td></tr>)}</tbody></DataTable> : <EmptyState message="아직 미션 참여 이력이 없습니다." />}</section>
    <p className="participant-feedback" role="status">{feedback}</p>
  </div>;
}
