"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import type { PrizeInventoryItem, PrizeItemDraw } from "@/types/prize-inventory";
import type { PrizeDrawStage, PrizeStageSnapshot } from "@/types/prize-stage";

const stageMeta: Record<PrizeDrawStage, { label: string; title: string; detail: string }> = {
  FIRST: { label: "PART 1 FINALE", title: "1부 종료 추첨", detail: "1부 출석자 · 커피 쿠폰 15명" },
  SECOND: { label: "PART 3 OPENING", title: "3부 시작 추첨", detail: "2부 출석자 · 올리브영 2만원 6명" },
  THIRD: { label: "GRAND FINALE", title: "피날레 추첨", detail: "2부 출석자 · 올리브영 3만원 6명 · 에어팟 1명 / 청중평가단 커피 5명" },
};

const luckyCss = `
.nexus-lucky-show-overlay{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;overflow:hidden;background:radial-gradient(ellipse at 50% 44%,#153f70 0%,#061429 46%,#01050f 100%);color:white;text-align:center;font-family:inherit}
.nexus-lucky-show-rays{position:absolute;inset:-100%;background:repeating-conic-gradient(from 0deg at 50% 50%,transparent 0deg 12deg,rgba(79,165,255,.075) 13deg 18deg,transparent 19deg 30deg);animation:nexus-lucky-spin 28s linear infinite;pointer-events:none}
.nexus-lucky-show-content{position:relative;z-index:2;width:min(940px,94vw);padding:clamp(18px,4vw,48px);border:1px solid #3286c4;border-radius:24px;background:linear-gradient(140deg,rgba(12,31,56,.85),rgba(5,15,32,.91));box-shadow:0 0 100px rgba(17,148,255,.3),inset 0 0 70px rgba(40,120,255,.08)}
.nexus-lucky-show-tag{color:#70d5ff;letter-spacing:.35em;font-size:clamp(12px,1.3vw,18px);font-weight:900}
.nexus-lucky-show-congrats{font-weight:950;letter-spacing:.15em;color:#fce78b;font-size:clamp(18px,3vw,42px);margin:22px 0 10px;text-shadow:0 0 34px #ffb800;animation:nexus-lucky-pop .65s both}
.nexus-lucky-show-content h2{font-size:clamp(70px,13vw,180px);line-height:1.1;margin:15px 0;color:#fff;text-shadow:0 0 35px #4fc3ff,0 0 90px #2879ff;animation:nexus-lucky-pop .65s both}
.nexus-lucky-show-detail{font-size:clamp(22px,4vw,42px);font-weight:800;letter-spacing:.03em}
.nexus-lucky-show-code{display:inline-block;margin-top:18px;padding:9px 22px;border:1px solid #68b7fa;border-radius:999px;color:#8ed8ff;font-weight:850;font-size:clamp(20px,2.6vw,34px)}
.nexus-lucky-show-prize{margin-top:24px;color:#ffe69b;font-size:clamp(24px,3.5vw,46px);font-weight:900}
.nexus-lucky-show-loading{margin-top:54px;font-size:clamp(34px,6vw,75px);font-weight:900;animation:nexus-lucky-pulse .65s ease-in-out infinite alternate}
.nexus-lucky-show-spinner{font-size:clamp(50px,10vw,115px);letter-spacing:.18em;color:#9edeff;margin:25px 0;filter:drop-shadow(0 0 20px #38bdf8);animation:nexus-lucky-pulse .25s ease-in-out infinite alternate}
.nexus-lucky-show-hint{color:#b7ccdd;font-size:18px}
.nexus-lucky-show-progress{margin-top:28px;color:#c6d9ef;font-size:clamp(16px,1.8vw,24px);font-weight:700}
.nexus-lucky-show-close{margin-top:32px;padding:15px 35px;border:2px solid #8ccfff;border-radius:999px;background:#1177c1;color:#fff;font-size:clamp(16px,2vw,24px);font-weight:900;cursor:pointer}
.nexus-lucky-show-confetti{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:3}
.nexus-lucky-show-confetti i{position:absolute;top:-6vh;width:10px;height:20px;animation:nexus-lucky-fall 3s linear infinite}
@keyframes nexus-lucky-pop{from{opacity:0;transform:scale(.6)}70%{transform:scale(1.08)}to{opacity:1;transform:scale(1)}}
@keyframes nexus-lucky-pulse{from{opacity:.4;transform:scale(.92)}to{opacity:1;transform:scale(1.04)}}
@keyframes nexus-lucky-fall{to{transform:translate3d(15vw,115vh,0) rotate(720deg)}}
@keyframes nexus-lucky-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){.nexus-lucky-show-overlay *{animation:none!important}}
`;

export default function PrizePage() {
  const { state } = useEventOps();
  const [inventory, setInventory] = useState<PrizeInventoryItem[]>([]);
  const [feedback, setFeedback] = useState("");
  const [drawingItemId, setDrawingItemId] = useState<string | null>(null);
  const [winner, setWinner] = useState<PrizeItemDraw | null>(null);
  const [presentation, setPresentation] = useState(false);
  const [showWinnerOverlay, setShowWinnerOverlay] = useState(false);
  const [winnerRevealed, setWinnerRevealed] = useState(false);
  const [stages, setStages] = useState<PrizeStageSnapshot[]>([]);
  const [lockingStage, setLockingStage] = useState<PrizeDrawStage | null>(null);
  const [selectedStage, setSelectedStage] = useState<PrizeDrawStage>("FIRST");

  const loadInventory = useCallback(async () => {
    const [response, stageResponse] = await Promise.all([fetch(`/api/prize-inventory?eventId=${encodeURIComponent(state.eventId)}`, { cache: "no-store" }), fetch(`/api/prize-stages?eventId=${encodeURIComponent(state.eventId)}`, { cache: "no-store" })]);
    const [payload, stagePayload] = await Promise.all([response.json(), stageResponse.json()]);
    if (response.ok && payload.ok) setInventory(payload.data as PrizeInventoryItem[]); else setFeedback(payload.error?.message ?? "경품 목록을 불러오지 못했습니다.");
    if (stageResponse.ok && stagePayload.ok) setStages(stagePayload.data as PrizeStageSnapshot[]); else setFeedback(stagePayload.error?.message ?? "추첨 대상자 Snapshot을 불러오지 못했습니다.");
  }, [state.eventId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadInventory(), 0);
    return () => window.clearTimeout(timer);
  }, [loadInventory]);

  const totals = useMemo(() => ({
    winners: inventory.reduce((sum, item) => sum + item.winnerCount, 0),
    drawn: inventory.reduce((sum, item) => sum + item.drawnCount, 0),
    budget: inventory.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0),
  }), [inventory]);

  const drawItem = async (item: PrizeInventoryItem) => {
    const stage = item.drawStage;
    if (!stage) return;

    const snapshot = stages.find((candidate) => candidate.stage === stage);
    if (!snapshot?.locked || item.drawnCount >= item.winnerCount) return;

    if (!window.confirm(
      `${stageMeta[stage].title}: ${item.name} 당첨자 1명을 확정할까요?\\n확정된 당첨은 취소 없이 기록됩니다.`
    )) return;

    setSelectedStage(stage);
    setDrawingItemId(item.id);
    setFeedback("");
    setWinner(null);
    const response = await fetch("/api/prize-inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: state.eventId, prizeItemId: item.id, stage }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) setFeedback(payload.error?.message ?? "경품 추첨에 실패했습니다.");
    else {
      const confirmed = payload.data as PrizeItemDraw;
      setWinner(confirmed);
      setWinnerRevealed(false);
      setShowWinnerOverlay(true);
      setFeedback(`${item.name} ${item.drawnCount + 1}번째 당첨자가 서버에서 확정되었습니다.`);
      await loadInventory();
    }
    setDrawingItemId(null);
  };

  useEffect(() => {
    if (!showWinnerOverlay || winnerRevealed) return;
    const timer = window.setTimeout(() => setWinnerRevealed(true), 2500);
    return () => window.clearTimeout(timer);
  }, [showWinnerOverlay, winnerRevealed]);

  const togglePresentation = async () => {
    if (!presentation) await document.documentElement.requestFullscreen?.().catch(() => undefined);
    else await document.exitFullscreen?.().catch(() => undefined);
    setPresentation((current) => !current);
  };

  const lockStage = async (stage: PrizeDrawStage) => {
    if (!window.confirm(`${stageMeta[stage].title} 대상자를 현재 출석 기준으로 봉인할까요? 봉인 후에는 바꿀 수 없습니다.`)) return;
    setLockingStage(stage); setFeedback("");
    const response = await fetch("/api/prize-stages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: state.eventId, stage }) });
    const payload = await response.json();
    if (!response.ok || !payload.ok) setFeedback(payload.error?.message ?? "대상자 봉인에 실패했습니다.");
    else { setFeedback(`${payload.data.label} 대상자 ${payload.data.eligibleCount}명을 봉인했습니다.`); await loadInventory(); }
    setLockingStage(null);
  };

  return <div className="admin-page">
    <SectionLabel label="PRIZE DRAW" title="경품 추첨" description="경품별 대상 풀에서 서버가 당첨자를 먼저 확정하고 전체 경품 중복 당첨을 차단합니다." />
    <OperationAlert level="INFO">각 추첨은 해당 부 출석자 Snapshot을 먼저 봉인한 뒤 서버에서 확정합니다. 화면 연출이나 운영자 조작은 당첨 결과를 바꾸지 않습니다.</OperationAlert>
    <OperationAlert level="WARNING">운영 순서: 1부 QR 출석자 커피 1만원 15명 → 3부 시작 올리브영 2만원 6명 → 청중평가단 베스트 리뷰어상 아웃백 10만원 2명(별도 선정) → 피날레 2부 출석자 올리브영 3만원 6명·에어팟 1명 / 청중평가단 PCU 대상 커피 1만원 5명.</OperationAlert>
    <div className="admin-inline-actions"><Link className="admin-button admin-button--primary" href="/admin/prize/finale" target="_blank" rel="noopener noreferrer">행사장 전광판 열기 (새 탭)</Link></div>

    <section className="prize-stage-locks">{stages.map((stage) => <article className="admin-card" key={stage.stage}><div><small>{stageMeta[stage.stage].label}</small><strong>{stageMeta[stage.stage].title}</strong><span>{stageMeta[stage.stage].detail}</span></div><div>{stage.locked ? <><b>{stage.eligibleCount}명</b><StatusBadge tone="success">POOL LOCKED</StatusBadge><small>{stage.lockedAt ? new Date(stage.lockedAt).toLocaleTimeString("ko-KR") : ""}</small></> : <><b>미봉인</b><button className="admin-button admin-button--danger" type="button" disabled={lockingStage !== null} onClick={() => void lockStage(stage.stage)}>{lockingStage === stage.stage ? "봉인 중…" : `${stage.stage === "FIRST" ? "1부" : "2부"} 출석자 봉인`}</button></>}</div></article>)}</section>

    <label className="admin-field prize-stage-selector">현재 추첨 순서<select value={selectedStage} onChange={(event) => setSelectedStage(event.target.value as PrizeDrawStage)}><option value="FIRST">1부 종료 · 커피 15명</option><option value="SECOND">3부 시작 · 올리브영 2만원 6명</option><option value="THIRD">피날레 · 올리브영 3만원 6명·에어팟 1명·평가단 커피 5명</option></select><small>봉인된 해당 순서의 출석자 안에서만 서버 추첨합니다.</small></label>

    <section className="admin-stat-grid prize-summary">
      <article><small>확정 경품</small><strong>{inventory.length}<span>종</span></strong></article>
      <article><small>전체 당첨자</small><strong>{totals.winners}<span>명</span></strong></article>
      <article><small>추첨 완료</small><strong>{totals.drawn}<span>명</span></strong></article>
      <article><small>총 경품 예산</small><strong>{totals.budget.toLocaleString("ko-KR")}<span>원</span></strong></article>
    </section>

    <section className="prize-policy-grid" aria-label="확정 경품 목록">
      {(["FIRST", "SECOND", "THIRD"] as const).map((stage) => {
        const items = inventory.filter((item) => item.drawStage === stage);
        const totalWinners = items.reduce((sum, item) => sum + item.winnerCount, 0);
        const totalBudget = items.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
        return <article className={`admin-card prize-pool ${selectedStage === stage ? "is-selected" : ""}`} key={stage}>
          <PanelHeader label={stageMeta[stage].label} title={stageMeta[stage].title} aside={<span className="mock-note">{totalWinners}명 · {totalBudget.toLocaleString("ko-KR")}원</span>} />
          <div className="prize-pool__items">{items.map((item) => <div className="prize-pool__item" key={item.id}>
            <div><strong>{item.name}{item.pool === "AUDIENCE_JURY" ? " · 청중평가단 전용" : " · 전체 참여자"}</strong><span>{item.unitAmount.toLocaleString("ko-KR")}원 × {item.quantity}개</span></div>
            <div className="prize-pool__progress"><b>{item.drawnCount}</b><span>/ {item.winnerCount}명</span></div>
            <button className="admin-button admin-button--compact" type="button" disabled={drawingItemId !== null || item.drawnCount >= item.winnerCount || !stages.find((candidate) => candidate.stage === stage)?.locked} onClick={() => void drawItem(item)}>{drawingItemId === item.id ? "서버 추첨 중…" : item.drawnCount >= item.winnerCount ? "추첨 완료" : !stages.find((candidate) => candidate.stage === stage)?.locked ? "대상자 미봉인" : "당첨자 1명 추첨"}</button>
          </div>)}</div>
        </article>;
      })}
      {inventory.filter((item) => item.awardOnly && item.status === "CONFIRMED").map((item) => <article className="admin-card prize-pool prize-pool--award" key={item.id}><PanelHeader label="AUDIENCE JURY AWARD" title="청중평가단 · 베스트 리뷰어상 · 추첨 아님" aside={<span className="mock-note">{item.winnerCount}명 · {item.unitAmount.toLocaleString("ko-KR")}원</span>} /><div className="prize-pool__items"><div className="prize-pool__item"><div><strong>{item.name}</strong><span>승인된 리뷰어 2명에게 시상 · 서버 무작위 추첨 제외</span></div><StatusBadge tone="warning">AWARD ONLY</StatusBadge></div></div></article>)}
    </section>

    {winner && <section className={`prize-inventory-winner ${presentation ? "prize-stage--presentation" : ""}`} role="status">
      <div className="confetti" aria-hidden="true">✦ ◆ ★ ✦ ◆ ★</div>
      <small>SERVER CONFIRMED WINNER</small>
      <strong>{winner.participantCode}</strong>
      <span>{winner.prizeName} · {winner.round}번째 당첨</span>
      <button className="admin-button admin-button--primary" type="button" onClick={() => void togglePresentation()}>{presentation ? "전체 화면 종료" : "전체 화면 발표"}</button>
    </section>}
    {showWinnerOverlay && winner && <div className="nexus-lucky-show-overlay" role="dialog" aria-modal="true" aria-label="럭키드로우 당첨 발표">
      <div className="nexus-lucky-show-rays" aria-hidden="true" />
      {winnerRevealed && <div className="nexus-lucky-show-confetti" aria-hidden="true">{Array.from({ length: 48 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 13) * -0.19}s`, animationDuration: `${2 + (i % 7) * .2}s`, background: ['#ffd75e','#38bdf8','#f472b6','#86efac'][i % 4] }} />)}</div>}
      <div className="nexus-lucky-show-content">
        <div className="nexus-lucky-show-tag">PAICHAI NEXUS · LUCKY DRAW</div>
        {winnerRevealed ? <>
          <div className="nexus-lucky-show-congrats">✦ CONGRATULATIONS ✦</div>
          <h2>{winner.maskedName}</h2>
          <div className="nexus-lucky-show-detail">{winner.department} · {winner.maskedStudentNumber}</div>
          <div className="nexus-lucky-show-code">{winner.participantCode}</div>
          <div className="nexus-lucky-show-prize">🎁 {winner.prizeName}</div>
        </> : <>
          <div className="nexus-lucky-show-loading">운명의 주인공은?</div>
          <div className="nexus-lucky-show-spinner" aria-label="당첨 결과 공개 준비 중">✦ ◇ ✧ ◈ ✦</div>
          <div className="nexus-lucky-show-hint">서버 당첨 확정 · 공개 연출 중</div>
        </>}
        <div className="nexus-lucky-show-progress">{winner.prizeName} · {winner.round}번째 확정</div>
        {winnerRevealed && <button className="nexus-lucky-show-close" type="button" onClick={() => setShowWinnerOverlay(false)}>당첨자 확인 · 다음 추첨</button>}
      </div>
    </div>}
    <style>{luckyCss}</style>
    <p className="participant-feedback" role="status">{feedback}</p>
  </div>;
}
