"use client";

import { FormEvent, useMemo, useState } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FINALIST_CANDIDATES } from "@/features/event/data/finalistCandidates";
import { BUSINESS_ANALYSIS_TEAM_COUNT, STARTUP_TEAM_COUNT, teamDisplayName, TOTAL_TEAM_COUNT } from "@/features/event/data/teamSlots";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import type { Team } from "@/types/team";

export default function TeamsPage() {
  const { state, updateTeam } = useEventOps();
  const [category, setCategory] = useState<"ALL" | "STARTUP" | "BUSINESS_ANALYSIS">("ALL");
  const [draft, setDraft] = useState<Team | null>(null);
  const [editorMode, setEditorMode] = useState<"REGISTER" | "EDIT">("EDIT");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const teams = state.teams.filter((team) => category === "ALL" || team.category === category);
  const categoryCounts = useMemo(() => ({
    startup: state.teams.filter((team) => team.category === "STARTUP").length,
    analysis: state.teams.filter((team) => team.category === "BUSINESS_ANALYSIS").length,
  }), [state.teams]);
  const countsValid = state.teams.length === TOTAL_TEAM_COUNT && categoryCounts.startup === STARTUP_TEAM_COUNT && categoryCounts.analysis === BUSINESS_ANALYSIS_TEAM_COUNT;
  const availableCandidates = FINALIST_CANDIDATES.filter((candidate) => !state.teams.some((team) => team.name?.trim() === candidate.name));

  const openRegistration = () => {
    const emptySlot = state.teams.find((team) => !team.name?.trim());
    if (!emptySlot) {
      setFeedback("빈 참가팀 슬롯이 없습니다. 기존 팀을 수정해주세요.");
      return;
    }
    setEditorMode("REGISTER");
    setDraft({ ...emptySlot });
    setFeedback("");
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    const accepted = await updateTeam({ ...draft, name: draft.name?.trim() || null });
    setFeedback(accepted ? (editorMode === "REGISTER" ? "본선 팀이 등록되었습니다." : "참가팀 정보가 저장되었습니다.") : "저장하지 못했습니다. 발표 순서 중복과 행사 상태를 확인해주세요.");
    if (accepted) setDraft(null);
    setSaving(false);
  };

  return (
    <div className="admin-page">
      <SectionLabel label="TEAMS" title="참가팀 관리" description="19개 참가 슬롯의 팀명·부문·발표 순서·참가 상태를 관리합니다." />
      {!countsValid && <OperationAlert level="CRITICAL">참가 구성은 전체 19팀·창업 10팀·기업분석 9팀이어야 합니다. 현재 구성을 확인하세요.</OperationAlert>}
      <div className="team-registration-toolbar">
        <div><strong>본선 팀 등록</strong><span>신청서 확인 팀 {FINALIST_CANDIDATES.length}개 · 미등록 후보 {availableCandidates.length}개</span></div>
        <button className="admin-button admin-button--primary" type="button" onClick={openRegistration}>+ 본선 팀 등록</button>
      </div>
      <section className="team-count-strip" aria-label="참가팀 구성"><span><small>전체</small><strong>{state.teams.length} / 19</strong></span><span><small>창업 부문</small><strong>{categoryCounts.startup} / 10</strong></span><span><small>기업분석 부문</small><strong>{categoryCounts.analysis} / 9</strong></span><span><small>팀명 등록</small><strong>{state.teams.filter((team) => team.name).length} / 19</strong></span></section>
      {draft && <form className="admin-card team-editor" onSubmit={save}>
        <PanelHeader label={editorMode === "REGISTER" ? "FINALIST REGISTRATION" : "TEAM EDITOR"} title={editorMode === "REGISTER" ? "본선 팀 등록" : `${String(draft.order).padStart(2, "0")}번 참가팀 수정`} aside={<button className="admin-button" type="button" onClick={() => setDraft(null)}>닫기</button>} />
        {editorMode === "REGISTER" && <label className="admin-field team-editor__candidate">신청팀 선택<select value={availableCandidates.some((candidate) => candidate.name === draft.name) ? draft.name ?? "" : ""} onChange={(event) => {
          const candidate = FINALIST_CANDIDATES.find((item) => item.name === event.target.value);
          if (candidate) setDraft({ ...draft, name: candidate.name, category: candidate.category, leaderName: candidate.leaderName ?? null, memberNames: candidate.memberNames ?? [], topic: candidate.topic, promotionEnabled: true });
        }}><option value="">신청서 명단에서 선택</option>{availableCandidates.map((candidate) => <option key={candidate.name} value={candidate.name}>{candidate.name} · {candidate.category === "STARTUP" ? "창업" : "기업분석"}</option>)}</select></label>}
        <div className="team-editor__fields">
          <label className="admin-field">팀명<input value={draft.name ?? ""} maxLength={100} placeholder="명단 확보 후 입력" onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="admin-field">부문<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Team["category"] })}><option value="STARTUP">창업 부문</option><option value="BUSINESS_ANALYSIS">기업분석 부문</option></select></label>
          <label className="admin-field">발표 순서<input type="number" min={1} max={19} value={draft.order} onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) })} /></label>
          <label className="admin-field">발표 상태<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Team["status"] })}><option value="READY">발표 예정</option><option value="PRESENTING">발표 중</option><option value="DONE">발표 완료</option></select></label>
          <label className="admin-field">참가 상태<select value={draft.active ? "ACTIVE" : "INACTIVE"} onChange={(event) => setDraft({ ...draft, active: event.target.value === "ACTIVE" })}><option value="ACTIVE">참가</option><option value="INACTIVE">불참</option></select></label>
        </div>
        {draft.name && <div className="team-profile-preview"><div><small>발표 주제</small><strong>{draft.topic ?? "주제 미등록"}</strong></div><div><small>대표자</small><strong>{draft.leaderName ?? "미등록"}</strong></div><div><small>팀원</small><strong>{draft.memberNames?.length ? draft.memberNames.join(", ") : "미등록"}</strong></div></div>}
        <button className="admin-button admin-button--primary" type="submit" disabled={saving}>{saving ? "저장 중…" : editorMode === "REGISTER" ? "본선 팀 등록 저장" : "변경사항 저장"}</button>
      </form>}
      <section className="admin-card">
        <PanelHeader label="PARTICIPATING TEAMS" title="참가팀 목록" aside={<span className="mock-note">{teams.length} TEAMS</span>} />
        <div className="filter-tabs" role="tablist" aria-label="참가 부문 필터">
          {(["ALL", "STARTUP", "BUSINESS_ANALYSIS"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={category === item} onClick={() => setCategory(item)}>{item === "ALL" ? `전체 (${state.teams.length})` : item === "STARTUP" ? `창업 부문 (${categoryCounts.startup})` : `기업분석 부문 (${categoryCounts.analysis})`}</button>)}
        </div>
        <DataTable label="참가팀 목록"><thead><tr><th>발표 순서</th><th>팀명</th><th>팀 구성</th><th>부문</th><th>발표 상태</th><th>참가 상태</th><th>관리</th></tr></thead><tbody>{teams.map((team) => <tr key={team.id}><td><b className="table-order">{String(team.order).padStart(2, "0")}</b></td><td><strong className={team.name ? "" : "is-pending-copy"}>{teamDisplayName(team)}</strong>{team.topic && <small className="team-topic-copy">{team.topic}</small>}</td><td><div className="team-member-cell"><strong>{team.leaderName ? `대표 ${team.leaderName}` : "이름 미등록"}</strong><small>{team.memberNames?.length ? team.memberNames.join(", ") : "—"}</small></div></td><td>{team.category === "STARTUP" ? "창업 부문" : "기업분석 부문"}</td><td><StatusBadge tone={team.status === "PRESENTING" ? "blue" : team.status === "DONE" ? "success" : "neutral"}>{team.status === "PRESENTING" ? "발표 중" : team.status === "DONE" ? "발표 완료" : "발표 예정"}</StatusBadge></td><td><StatusBadge tone={team.active ? "success" : "danger"}>{team.active ? "참가" : "불참"}</StatusBadge></td><td><button className="admin-button admin-button--compact" type="button" onClick={() => { setEditorMode("EDIT"); setDraft({ ...team }); setFeedback(""); }}>수정</button></td></tr>)}</tbody></DataTable>
        <p className="participant-feedback" role="status">{feedback}</p>
      </section>
    </div>
  );
}
