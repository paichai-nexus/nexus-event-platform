"use client";
import { useCallback, useEffect, useState } from "react";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import type { BestReviewer, ResultShowAward, ResultShowDeck, ResultShowScene } from "@/types/result-show";

const toText = (awards: ResultShowAward[]) => awards.map((award) => `${award.title} | ${award.teamName} | ${award.detail}`).join("\n");
function parseAwards(value: string) { return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [title = "", teamName = "", ...detail] = line.split("|").map((part) => part.trim()); return { title, teamName, detail: detail.join(" | ") }; }).filter((item) => item.title && item.teamName); }

export function ResultShowControl() {
  const { state, setDisplayMode } = useEventOps();
  const [deck, setDeck] = useState<ResultShowDeck | null>(null);
  const [comment, setComment] = useState("");
  const [awardsText, setAwardsText] = useState("");
  const [bestReviewer, setBestReviewer] = useState<BestReviewer>({ participantCode: "", name: "", department: "", reviewExcerpt: "" });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const load = useCallback(async () => { const response = await fetch(`/api/result-show?eventId=${encodeURIComponent(state.eventId)}`, { cache: "no-store" }); const payload = await response.json(); if (!response.ok || !payload.ok) { setFeedback(payload.error?.message ?? "SHOW 자료를 조회하지 못했습니다."); return; } const next = payload.data as ResultShowDeck; setDeck(next); setComment(next.judgeComment); setAwardsText(toText(next.awards)); setBestReviewer(next.bestReviewer ?? { participantCode: "", name: "", department: "", reviewExcerpt: "" }); }, [state.eventId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const request = async (body: Record<string, unknown>) => { setBusy(true); setFeedback(""); try { const response = await fetch("/api/result-show", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "SHOW 제어에 실패했습니다."); setDeck(payload.data as ResultShowDeck); setFeedback("서버에 반영되었습니다."); return true; } catch (error) { setFeedback(error instanceof Error ? error.message : "SHOW 제어에 실패했습니다."); return false; } finally { setBusy(false); } };
  const reviewerValue = Object.values(bestReviewer).some((value) => value.trim()) ? bestReviewer : null;
  const reviewerComplete = reviewerValue === null || Object.values(bestReviewer).every((value) => value.trim());
  const save = () => request({ action: "SAVE", eventId: state.eventId, judgeComment: comment, awards: parseAwards(awardsText), bestReviewer: reviewerValue });
  const approve = async () => { if (!window.confirm("입력한 심사평과 수상 결과를 전광판 공개 가능 상태로 승인할까요? 승인 후 수정할 수 없습니다.")) return; await request({ action: "APPROVE", eventId: state.eventId }); };
  const scene = async (value: ResultShowScene) => { const ok = await request({ action: "SET_SCENE", eventId: state.eventId, scene: value }); if (ok) await setDisplayMode("RESULT_SHOW"); };
  const approved = deck?.status === "APPROVED";
  return <section className="admin-card result-show-control">
    <PanelHeader label="RESULT SHOW CONTROL" title="심사평·심사결과 전광판" aside={<StatusBadge tone={approved ? "success" : "warning"}>{approved ? "APPROVED" : "DRAFT"}</StatusBadge>} />
    <OperationAlert level="WARNING">점수 계산 결과를 자동으로 가져오지 않습니다. 교수진이 확인한 문구와 수상 결과만 입력하고 ADMIN이 승인해야 공개됩니다.</OperationAlert>
    <label className="admin-field">승인된 심사평<textarea rows={5} maxLength={2000} disabled={approved || busy} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="전광판에 공개할 최종 심사평" /></label>
    <label className="admin-field">수상 결과 <small>한 줄에 `상명 | 팀명 | 설명` 형식</small><textarea rows={7} disabled={approved || busy} value={awardsText} onChange={(event) => setAwardsText(event.target.value)} placeholder={"대상 | 팀명 | 창업 부문\n최우수상 | 팀명 | 기업분석 부문"} /></label>
    <fieldset className="best-reviewer-form" disabled={approved || busy}><legend>베스트 리뷰어상 · 운영진 승인 입력</legend><p>자동 선정하지 않습니다. 최종 확인된 수상자 정보만 입력하며, 참가코드나 학번 전체를 전광판에 공개하지 않습니다.</p><div><label className="admin-field">참가코드<input value={bestReviewer.participantCode} maxLength={30} onChange={(event) => setBestReviewer((current) => ({ ...current, participantCode: event.target.value }))} placeholder="PCU101" /></label><label className="admin-field">이름<input value={bestReviewer.name} maxLength={100} onChange={(event) => setBestReviewer((current) => ({ ...current, name: event.target.value }))} /></label><label className="admin-field">학과<input value={bestReviewer.department} maxLength={100} onChange={(event) => setBestReviewer((current) => ({ ...current, department: event.target.value }))} /></label></div><label className="admin-field">선정 리뷰 문구<textarea rows={3} maxLength={500} value={bestReviewer.reviewExcerpt} onChange={(event) => setBestReviewer((current) => ({ ...current, reviewExcerpt: event.target.value }))} /></label>{!reviewerComplete && <small className="field-error">베스트 리뷰어 정보를 입력하려면 네 항목을 모두 작성해주세요.</small>}</fieldset>
    <div className="result-show-control__actions">{!approved ? <><button className="admin-button" disabled={busy || !reviewerComplete} type="button" onClick={() => void save()}>초안 저장</button><button className="admin-button admin-button--danger" disabled={busy || !comment.trim() || !parseAwards(awardsText).length || !reviewerComplete} type="button" onClick={() => void approve()}>ADMIN 최종 승인</button></> : <><button className={`admin-button ${deck.currentScene === "REVIEW" && state.displayMode === "RESULT_SHOW" ? "admin-button--primary" : ""}`} disabled={busy} type="button" onClick={() => void scene("REVIEW")}>① 심사평 SHOW</button><button className={`admin-button ${deck.currentScene === "RESULT" && state.displayMode === "RESULT_SHOW" ? "admin-button--primary" : ""}`} disabled={busy} type="button" onClick={() => void scene("RESULT")}>② 심사결과 SHOW</button><button className={`admin-button ${deck.currentScene === "BEST_REVIEWER" && state.displayMode === "RESULT_SHOW" ? "admin-button--primary" : ""}`} disabled={busy || !deck.bestReviewer} type="button" onClick={() => void scene("BEST_REVIEWER")}>③ 베스트 리뷰어 SHOW</button><button className="admin-button" disabled={busy} type="button" onClick={() => void setDisplayMode("HOLDING")}>전광판 대기 전환</button></>}</div>
    <p className="participant-feedback" role="status">{feedback}</p>
  </section>;
}
