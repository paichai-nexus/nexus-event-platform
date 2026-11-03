"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import type { CeremonyControlState, CeremonyPhase } from "@/types/ceremony-control";

const steps: Array<{ phase: CeremonyPhase; order: string; title: string; detail: string; href?: string }> = [
  { phase: "FIRST_DRAW", order: "1부 END", title: "1차 럭키드로우", detail: "1부 출석자 · 커피 쿠폰 15명", href: "/admin/prize" },
  { phase: "AUDIENCE_CANDIDATES", order: "12", title: "청중평가", detail: "각 부문 1위 후보 2팀 선정", href: "/admin/voting" },
  { phase: "SECOND_DRAW", order: "3부 START", title: "2차 럭키드로우", detail: "2부 출석자 · 올리브영 2만원 6명", href: "/admin/prize" },
  { phase: "JUDGE_REVIEW", order: "15-1", title: "심사평 SHOW", detail: "ADMIN 승인 심사평 전광판 공개", href: "/admin/results" },
  { phase: "RESULTS", order: "15-2", title: "심사결과 SHOW", detail: "승인된 수상 결과 공개", href: "/admin/results" },
  { phase: "BEST_REVIEWER", order: "16-1", title: "베스트 리뷰어 시상", detail: "2명 · 아웃백 상품권 · 추첨 아님", href: "/admin/results" },
  { phase: "THIRD_DRAW", order: "16-2", title: "피날레 럭키드로우", detail: "올리브영 3만원 6명 · 에어팟 1명 · 커피 5명", href: "/admin/prize" },
  { phase: "COMPLETE", order: "END", title: "엔딩 크레딧", detail: "전체 경품 운영 결과 한 화면", href: "/admin/prize/finale" },
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
  return <div className="admin-page"><SectionLabel label="CEREMONY CONTROL" title="행사 진행 콘솔" description="1부 종료 추첨부터 피날레 엔딩 크레딧까지 한 단계씩 진행합니다." /><OperationAlert level="WARNING">단계 변경은 감사 가능한 서버 상태로 저장되며 되돌릴 수 없습니다. 결과 자료와 경품 대상자 풀을 먼저 승인·봉인한 뒤 진행하세요.</OperationAlert><section className="ceremony-timeline">{steps.map((step, index) => { const active = index === currentIndex; const done = index < currentIndex; const next = index === currentIndex + 1; return <article className={`admin-card ceremony-step ${active ? "is-active" : ""} ${done ? "is-done" : ""}`} key={step.phase}><div className="ceremony-step__order">{step.order}</div><div><small>{step.phase}</small><h2>{step.title}</h2><p>{step.detail}</p></div><div className="ceremony-step__actions">{done ? <StatusBadge tone="success">완료</StatusBadge> : active ? <StatusBadge tone="warning">현재 단계</StatusBadge> : <StatusBadge tone="neutral">대기</StatusBadge>}{step.href && <Link className="admin-button admin-button--compact" href={step.href}>{step.phase === "COMPLETE" ? "엔딩 화면" : "관리 화면"}</Link>}{active && ["AUDIENCE_CANDIDATES", "JUDGE_REVIEW", "RESULTS", "BEST_REVIEWER"].includes(step.phase) && <button className="admin-button admin-button--primary admin-button--compact" disabled={busy} type="button" onClick={() => void show(step.phase)}>전광판 SHOW</button>}{(next || (!control?.updatedAt && index === 0)) && <button className="admin-button admin-button--danger admin-button--compact" disabled={busy} type="button" onClick={() => void advance(step.phase)}>{index === 0 ? "진행 시작" : "이 단계로 진행"}</button>}</div></article>; })}</section><p className="participant-feedback" role="status">{feedback}</p></div>;
}
