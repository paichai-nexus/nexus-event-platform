"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import type { CeremonyControlState, CeremonyPhase } from "@/types/ceremony-control";

const steps: Array<{ phase: CeremonyPhase; order: string; title: string; detail: string; href?: string }> = [
  { phase: "AUDIENCE_CANDIDATES", order: "12", title: "청중평가", detail: "각 부문 1위 후보 2팀 선정", href: "/admin/voting" },
  { phase: "SECOND_DRAW", order: "14", title: "2차 럭키드로우", detail: "3부 시작 전 · 2부 참석자 · 4·3등", href: "/admin/prize" },
  { phase: "JUDGE_REVIEW", order: "15-1", title: "심사평 SHOW", detail: "ADMIN 승인 심사평 전광판 공개", href: "/admin/results" },
  { phase: "RESULTS", order: "15-2", title: "심사결과 SHOW", detail: "승인된 수상 결과 공개", href: "/admin/results" },
  { phase: "BEST_REVIEWER", order: "16-1", title: "베스트 리뷰어 시상", detail: "승인된 수상자와 리뷰 공개", href: "/admin/results" },
  { phase: "THIRD_DRAW", order: "16-2", title: "3차 럭키드로우", detail: "시상식 · 1등 경품", href: "/admin/prize" },
  { phase: "COMPLETE", order: "END", title: "행사 종료", detail: "전광판 대기 화면 전환" },
];

export default function CeremonyPage() {
  const { state, setDisplayMode } = useEventOps();
  const [control, setControl] = useState<CeremonyControlState | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const load = useCallback(async () => { const response = await fetch(`/api/ceremony-control?eventId=${encodeURIComponent(state.eventId)}`, { cache: "no-store" }); const payload = await response.json(); if (response.ok && payload.ok) setControl(payload.data); else setFeedback(payload.error?.message ?? "진행 상태를 불러오지 못했습니다."); }, [state.eventId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const advance = async (phase: CeremonyPhase) => { if (!window.confirm(`${steps.find((step) => step.phase === phase)?.title} 단계로 확정 진행할까요? 이전 단계로 되돌릴 수 없습니다.`)) return; setBusy(true); setFeedback(""); const response = await fetch("/api/ceremony-control", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: state.eventId, phase }) }); const payload = await response.json(); if (response.ok && payload.ok) { setControl(payload.data); setFeedback("행사 진행 단계가 서버에 저장되었습니다."); } else setFeedback(payload.error?.message ?? "진행 단계 저장에 실패했습니다."); setBusy(false); };
  const show = async (phase: CeremonyPhase) => { setBusy(true); setFeedback(""); try { if (phase === "AUDIENCE_CANDIDATES") await setDisplayMode("VOTE_PROGRESS"); else if (phase === "COMPLETE") await setDisplayMode("HOLDING"); else if (["JUDGE_REVIEW", "RESULTS", "BEST_REVIEWER"].includes(phase)) { const scene = phase === "JUDGE_REVIEW" ? "REVIEW" : phase === "RESULTS" ? "RESULT" : "BEST_REVIEWER"; const response = await fetch("/api/result-show", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SET_SCENE", eventId: state.eventId, scene }) }); const payload = await response.json(); if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "승인된 SHOW 자료가 필요합니다."); await setDisplayMode("RESULT_SHOW"); } setFeedback("전광판 신호를 전송했습니다."); } catch (error) { setFeedback(error instanceof Error ? error.message : "전광판 전환에 실패했습니다."); } finally { setBusy(false); } };
  const currentIndex = control?.phaseIndex ?? 0;
  return <div className="admin-page"><SectionLabel label="CEREMONY CONTROL" title="행사 진행 콘솔" description="확정된 12→14→15→16 순서를 한 단계씩 진행하고 전광판 신호를 제어합니다." /><OperationAlert level="WARNING">단계 변경은 감사 가능한 서버 상태로 저장되며 되돌릴 수 없습니다. 결과 자료와 경품 대상자 풀을 먼저 승인·봉인한 뒤 진행하세요.</OperationAlert><section className="ceremony-timeline">{steps.map((step, index) => { const active = index === currentIndex; const done = index < currentIndex; const next = index === currentIndex + 1; return <article className={`admin-card ceremony-step ${active ? "is-active" : ""} ${done ? "is-done" : ""}`} key={step.phase}><div className="ceremony-step__order">{step.order}</div><div><small>{step.phase}</small><h2>{step.title}</h2><p>{step.detail}</p></div><div className="ceremony-step__actions">{done ? <StatusBadge tone="success">완료</StatusBadge> : active ? <StatusBadge tone="warning">현재 단계</StatusBadge> : <StatusBadge tone="neutral">대기</StatusBadge>}{step.href && <Link className="admin-button admin-button--compact" href={step.href}>관리 화면</Link>}{active && ["AUDIENCE_CANDIDATES", "JUDGE_REVIEW", "RESULTS", "BEST_REVIEWER", "COMPLETE"].includes(step.phase) && <button className="admin-button admin-button--primary admin-button--compact" disabled={busy} type="button" onClick={() => void show(step.phase)}>전광판 SHOW</button>}{(next || (!control?.updatedAt && index === 0)) && <button className="admin-button admin-button--danger admin-button--compact" disabled={busy} type="button" onClick={() => void advance(step.phase)}>{index === 0 ? "진행 시작" : "이 단계로 진행"}</button>}</div></article>; })}</section><p className="participant-feedback" role="status">{feedback}</p></div>;
}
