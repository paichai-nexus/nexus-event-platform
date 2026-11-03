"use client";

import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import { DataTable } from "@/components/ui/DataTable";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FINALIST_CANDIDATES } from "@/features/event/data/finalistCandidates";
import { BUSINESS_ANALYSIS_TEAM_COUNT, STARTUP_TEAM_COUNT, teamDisplayName, teamSlotCode, TOTAL_TEAM_COUNT } from "@/features/event/data/teamSlots";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import { parseTeamRosterRows, parseTeamRosterText } from "@/lib/teams/parseTeamRoster";
import type { Team } from "@/types/team";
import type { TeamRosterImportRow } from "@/types/team-roster-import";

export default function TeamsPage() {
  const { state, updateTeam, refreshOperations } = useEventOps();
  const [category, setCategory] = useState<"ALL" | "STARTUP" | "BUSINESS_ANALYSIS">("ALL");
  const [draft, setDraft] = useState<Team | null>(null);
  const [editorMode, setEditorMode] = useState<"REGISTER" | "EDIT">("EDIT");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [importRows, setImportRows] = useState<TeamRosterImportRow[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
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

  const previewRoster = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setFeedback(""); setImportRows([]); setImportErrors([]);
    try { const parsed = /\.xlsx$/i.test(file.name) ? parseTeamRosterRows(await (await import("read-excel-file/browser")).readSheet(file)) : parseTeamRosterText(await file.text()); setImportRows(parsed.rows); setImportErrors(parsed.errors); }
    catch (error) { setImportErrors([error instanceof Error ? error.message : "명단 파일을 읽지 못했습니다."]); }
  };

  const applyRoster = async () => {
    if (importErrors.length || importRows.length !== TOTAL_TEAM_COUNT || !window.confirm("미리보기의 12팀 정보로 기존 참가팀 슬롯을 일괄 갱신할까요? 한 번의 트랜잭션으로 적용됩니다.")) return;
    setSaving(true); setFeedback("");
    const response = await fetch("/api/teams/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: state.eventId, rows: importRows }) });
    const payload = await response.json();
    if (response.ok && payload.ok) { setFeedback("최종 팀 명단 12팀이 일괄 반영되었습니다."); setImportRows([]); await refreshOperations(); }
    else setFeedback(payload.error?.message ?? "최종 팀 명단을 반영하지 못했습니다.");
    setSaving(false);
  };

  return (
    <div className="admin-page">
      <SectionLabel label="TEAMS" title="본선 참가팀 관리" description="창업 6팀·기업분석 6팀의 팀 정보와 발표 상태를 관리합니다." />
      {!countsValid && <OperationAlert level="CRITICAL">본선 구성은 전체 12팀·창업 6팀·기업분석 6팀이어야 합니다. 현재 구성을 확인하세요.</OperationAlert>}
      <div className="team-registration-toolbar">
        <div><strong>본선 팀 등록</strong><span>신청서 확인 팀 {FINALIST_CANDIDATES.length}개 · 미등록 후보 {availableCandidates.length}개</span></div>
        <button className="admin-button admin-button--primary" type="button" onClick={openRegistration}>+ 본선 팀 등록</button>
      </div>
      <section className="admin-card team-roster-import"><PanelHeader label="ATOMIC ROSTER IMPORT" title="최종 팀 명단 일괄 가져오기" /><OperationAlert level="INFO">XLSX/CSV 첫 행에 발표순서, 부문, 팀명, 소속학과, 대표자, 팀원, 지도교수, 발표주제를 사용합니다. 12팀·창업 6팀·기업분석 6팀이 모두 맞아야 반영됩니다.</OperationAlert><label className="admin-button admin-button--primary audience-file-button">XLSX / CSV 미리보기<input type="file" accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values" disabled={saving} onChange={previewRoster} /></label>{importErrors.length > 0 && <ul className="team-roster-errors">{importErrors.slice(0, 8).map((error) => <li key={error}>{error}</li>)}</ul>}{importRows.length > 0 && <><div className="team-roster-preview"><strong>{importRows.length}팀 미리보기</strong><span>창업 {importRows.filter((row) => row.category === "STARTUP").length} · 기업분석 {importRows.filter((row) => row.category === "BUSINESS_ANALYSIS").length}</span></div><DataTable label="가져올 최종 팀 명단"><thead><tr><th>순서</th><th>부문</th><th>팀명</th><th>학과</th><th>대표·팀원</th><th>지도교수</th></tr></thead><tbody>{importRows.map((row) => <tr key={row.order}><td>{row.order}</td><td>{row.category === "STARTUP" ? "창업" : "기업분석"}</td><td><strong>{row.name}</strong><small className="team-topic-copy">{row.topic}</small></td><td>{row.department}</td><td>{row.leaderName}<small className="team-topic-copy">{row.memberNames.join(", ")}</small></td><td>{row.advisorName}</td></tr>)}</tbody></DataTable><button className="admin-button admin-button--danger" type="button" disabled={saving || importErrors.length > 0} onClick={() => void applyRoster()}>{saving ? "일괄 반영 중…" : "검증된 12팀 명단 일괄 반영"}</button></>}</section>
      <section className="team-count-strip" aria-label="참가팀 구성"><span><small>전체</small><strong>{state.teams.length} / {TOTAL_TEAM_COUNT}</strong></span><span><small>창업 부문</small><strong>{categoryCounts.startup} / {STARTUP_TEAM_COUNT}</strong></span><span><small>기업분석 부문</small><strong>{categoryCounts.analysis} / {BUSINESS_ANALYSIS_TEAM_COUNT}</strong></span><span><small>팀명 등록</small><strong>{state.teams.filter((team) => team.name).length} / {TOTAL_TEAM_COUNT}</strong></span></section>
      {draft && <form className="admin-card team-editor" onSubmit={save}>
        <PanelHeader label={editorMode === "REGISTER" ? "FINALIST REGISTRATION" : "TEAM EDITOR"} title={editorMode === "REGISTER" ? "본선 팀 등록" : `${String(draft.order).padStart(2, "0")}번 참가팀 수정`} aside={<button className="admin-button" type="button" onClick={() => setDraft(null)}>닫기</button>} />
        {editorMode === "REGISTER" && <label className="admin-field team-editor__candidate">신청팀 선택<select value={availableCandidates.some((candidate) => candidate.name === draft.name) ? draft.name ?? "" : ""} onChange={(event) => {
          const candidate = FINALIST_CANDIDATES.find((item) => item.name === event.target.value);
          if (candidate) setDraft({ ...draft, name: candidate.name, category: candidate.category, leaderName: candidate.leaderName ?? null, memberNames: candidate.memberNames ?? [], topic: candidate.topic, promotionEnabled: true });
        }}><option value="">신청서 명단에서 선택</option>{availableCandidates.map((candidate) => <option key={candidate.name} value={candidate.name}>{candidate.name} · {candidate.category === "STARTUP" ? "창업" : "기업분석"}</option>)}</select></label>}
        <div className="team-editor__fields">
          <label className="admin-field">팀명<input value={draft.name ?? ""} maxLength={100} placeholder="명단 확보 후 입력" onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="admin-field">소속학과<input value={draft.department ?? ""} maxLength={100} placeholder="최종 명단 확인 후 입력" onChange={(event) => setDraft({ ...draft, department: event.target.value || null })} /></label>
          <label className="admin-field">팀 대표<input value={draft.leaderName ?? ""} maxLength={100} placeholder="이름" onChange={(event) => setDraft({ ...draft, leaderName: event.target.value || null })} /></label>
          <label className="admin-field">팀원명<input value={draft.memberNames.join(", ")} placeholder="쉼표로 구분" onChange={(event) => setDraft({ ...draft, memberNames: event.target.value.split(",").map((name) => name.trim()).filter(Boolean) })} /></label>
          <label className="admin-field">지도교수님<input value={draft.advisorName ?? ""} maxLength={100} placeholder="성함만 입력" onChange={(event) => setDraft({ ...draft, advisorName: event.target.value || null })} /></label>
          <label className="admin-field">발표 주제<input value={draft.topic ?? ""} maxLength={300} placeholder="발표 주제" onChange={(event) => setDraft({ ...draft, topic: event.target.value || null })} /></label>
          <label className="admin-field">부문<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Team["category"] })}><option value="STARTUP">창업 부문</option><option value="BUSINESS_ANALYSIS">기업분석 부문</option></select></label>
          <label className="admin-field">발표 순서<input type="number" min={1} max={19} value={draft.order} onChange={(event) => setDraft({ ...draft, order: Number(event.target.value) })} /></label>
          <label className="admin-field">발표 상태<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as Team["status"] })}><option value="READY">발표 예정</option><option value="PRESENTING">발표 중</option><option value="DONE">발표 완료</option></select></label>
          <label className="admin-field">참가 상태<select value={draft.active ? "ACTIVE" : "INACTIVE"} onChange={(event) => setDraft({ ...draft, active: event.target.value === "ACTIVE" })}><option value="ACTIVE">참가</option><option value="INACTIVE">불참</option></select></label>
        </div>
        {draft.name && <div className="team-profile-preview"><div><small>소속학과</small><strong>{draft.department ?? "미등록"}</strong></div><div><small>발표 주제</small><strong>{draft.topic ?? "주제 미등록"}</strong></div><div><small>대표자</small><strong>{draft.leaderName ?? "미등록"}</strong></div><div><small>팀원</small><strong>{draft.memberNames?.length ? draft.memberNames.join(", ") : "미등록"}</strong></div><div><small>지도교수님</small><strong>{draft.advisorName ? `${draft.advisorName} 교수님` : "미등록"}</strong></div></div>}
        <button className="admin-button admin-button--primary" type="submit" disabled={saving}>{saving ? "저장 중…" : editorMode === "REGISTER" ? "본선 팀 등록 저장" : "변경사항 저장"}</button>
      </form>}
      <section className="admin-card">
        <PanelHeader label="PARTICIPATING TEAMS" title="참가팀 목록" aside={<span className="mock-note">{teams.length} TEAMS</span>} />
        <div className="filter-tabs" role="tablist" aria-label="참가 부문 필터">
          {(["ALL", "STARTUP", "BUSINESS_ANALYSIS"] as const).map((item) => <button key={item} type="button" role="tab" aria-selected={category === item} onClick={() => setCategory(item)}>{item === "ALL" ? `전체 (${state.teams.length})` : item === "STARTUP" ? `창업 부문 (${categoryCounts.startup})` : `기업분석 부문 (${categoryCounts.analysis})`}</button>)}
        </div>
        <DataTable label="참가팀 목록"><thead><tr><th>본선 코드</th><th>팀명·학과</th><th>팀 구성·지도교수</th><th>부문</th><th>발표 상태</th><th>참가 상태</th><th>관리</th></tr></thead><tbody>{teams.map((team) => <tr key={team.id}><td><b className="table-order">{teamSlotCode(team)}</b></td><td><strong className={team.name ? "" : "is-pending-copy"}>{teamDisplayName(team)}</strong><small className="team-topic-copy">{team.department ?? "학과 미등록"}</small>{team.topic && <small className="team-topic-copy">{team.topic}</small>}</td><td><div className="team-member-cell"><strong>{team.leaderName ? `대표 ${team.leaderName}` : "대표자 미등록"}</strong><small>{team.memberNames?.length ? `팀원 ${team.memberNames.join(", ")}` : "팀원 미등록"}</small><small>{team.advisorName ? `지도교수 ${team.advisorName}` : "지도교수 미등록"}</small></div></td><td>{team.category === "STARTUP" ? "창업 부문" : "기업분석 부문"}</td><td><StatusBadge tone={team.status === "PRESENTING" ? "blue" : team.status === "DONE" ? "success" : "neutral"}>{team.status === "PRESENTING" ? "발표 중" : team.status === "DONE" ? "발표 완료" : "발표 예정"}</StatusBadge></td><td><StatusBadge tone={team.active ? "success" : "danger"}>{team.active ? "참가" : "불참"}</StatusBadge></td><td><button className="admin-button admin-button--compact" type="button" onClick={() => { setEditorMode("EDIT"); setDraft({ ...team }); setFeedback(""); }}>수정</button></td></tr>)}</tbody></DataTable>
        <p className="participant-feedback" role="status">{feedback}</p>
      </section>
    </div>
  );
}
