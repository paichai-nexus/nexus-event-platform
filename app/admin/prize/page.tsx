"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import type { PrizeInventoryItem, PrizeItemDraw } from "@/types/prize-inventory";
import type { PrizeDrawStage, PrizeStageSnapshot } from "@/types/prize-stage";

const pools = ["AUDIENCE_JURY", "ALL_PARTICIPANTS"] as const;

export default function PrizePage() {
  const { state } = useEventOps();
  const [inventory, setInventory] = useState<PrizeInventoryItem[]>([]);
  const [feedback, setFeedback] = useState("");
  const [drawingItemId, setDrawingItemId] = useState<string | null>(null);
  const [winner, setWinner] = useState<PrizeItemDraw | null>(null);
  const [presentation, setPresentation] = useState(false);
  const [stages, setStages] = useState<PrizeStageSnapshot[]>([]);
  const [lockingStage, setLockingStage] = useState<PrizeDrawStage | null>(null);
  const [selectedStage, setSelectedStage] = useState<PrizeDrawStage>("SECOND");

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
    setDrawingItemId(item.id);
    setFeedback("");
    setWinner(null);
    const response = await fetch("/api/prize-inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: state.eventId, prizeItemId: item.id, stage: selectedStage }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) setFeedback(payload.error?.message ?? "경품 추첨에 실패했습니다.");
    else {
      setWinner(payload.data as PrizeItemDraw);
      setFeedback(`${item.name} ${item.drawnCount + 1}번째 당첨자가 서버에서 확정되었습니다.`);
      await loadInventory();
    }
    setDrawingItemId(null);
  };

  const togglePresentation = async () => {
    if (!presentation) await document.documentElement.requestFullscreen?.().catch(() => undefined);
    else await document.exitFullscreen?.().catch(() => undefined);
    setPresentation((current) => !current);
  };

  const lockStage = async (stage: PrizeDrawStage) => {
    if (!window.confirm(`${stage === "SECOND" ? "2차" : "3차"} 럭키드로우 대상자를 현재 참석자 기준으로 봉인할까요? 봉인 후에는 바꿀 수 없습니다.`)) return;
    setLockingStage(stage); setFeedback("");
    const response = await fetch("/api/prize-stages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId: state.eventId, stage }) });
    const payload = await response.json();
    if (!response.ok || !payload.ok) setFeedback(payload.error?.message ?? "대상자 봉인에 실패했습니다.");
    else { setFeedback(`${payload.data.label} 대상자 ${payload.data.eligibleCount}명을 봉인했습니다.`); await loadInventory(); }
    setLockingStage(null);
  };

  return <div className="admin-page">
    <SectionLabel label="PRIZE DRAW" title="경품 추첨" description="경품별 대상 풀에서 서버가 당첨자를 먼저 확정하고 전체 경품 중복 당첨을 차단합니다." />
    <OperationAlert level="INFO">청중평가단 전용 8명, 전체 참여자 대상 27명입니다. 화면 연출이나 운영자 조작은 서버가 확정한 당첨 결과를 바꾸지 않습니다.</OperationAlert>
    <OperationAlert level="WARNING">운영 순서: 3부 시작 전 2부 참석자를 대상으로 2차 럭키드로우(4·3등) → 심사평·결과 공개 → 시상식·베스트 리뷰어상(2등) → 3차 럭키드로우(1등). 등수별 상품 연결은 최종 목록 확인 후 확정합니다.</OperationAlert>

    <section className="prize-stage-locks">{stages.map((stage) => <article className="admin-card" key={stage.stage}><div><small>{stage.stage} DRAW</small><strong>{stage.label}</strong><span>{stage.stage === "SECOND" ? "3부 시작 전 · 2부 참석자" : "시상식 · 1등 추첨"}</span></div><div>{stage.locked ? <><b>{stage.eligibleCount}명</b><StatusBadge tone="success">POOL LOCKED</StatusBadge><small>{stage.lockedAt ? new Date(stage.lockedAt).toLocaleTimeString("ko-KR") : ""}</small></> : <><b>미봉인</b><button className="admin-button admin-button--danger" type="button" disabled={lockingStage !== null} onClick={() => void lockStage(stage.stage)}>{lockingStage === stage.stage ? "봉인 중…" : "현재 참석자 대상 봉인"}</button></>}</div></article>)}</section>

    <label className="admin-field prize-stage-selector">현재 추첨 차수<select value={selectedStage} onChange={(event) => setSelectedStage(event.target.value as PrizeDrawStage)}><option value="SECOND">2차 · 4·3등</option><option value="THIRD">3차 · 1등</option></select><small>봉인된 해당 차수 후보자 안에서만 서버 추첨합니다.</small></label>

    <section className="admin-stat-grid prize-summary">
      <article><small>확정 경품</small><strong>{inventory.length}<span>종</span></strong></article>
      <article><small>전체 당첨자</small><strong>{totals.winners}<span>명</span></strong></article>
      <article><small>추첨 완료</small><strong>{totals.drawn}<span>명</span></strong></article>
      <article><small>총 경품 예산</small><strong>{totals.budget.toLocaleString("ko-KR")}<span>원</span></strong></article>
    </section>

    <section className="prize-policy-grid" aria-label="확정 경품 목록">
      {pools.map((pool) => {
        const items = inventory.filter((item) => item.pool === pool);
        const totalWinners = items.reduce((sum, item) => sum + item.winnerCount, 0);
        const totalBudget = items.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0);
        return <article className="admin-card prize-pool" key={pool}>
          <PanelHeader label={pool === "AUDIENCE_JURY" ? "AUDIENCE JURY" : "ALL PARTICIPANTS"} title={pool === "AUDIENCE_JURY" ? "청중평가단 전용 경품" : "전체 참여 경품"} aside={<span className="mock-note">{totalWinners}명 · {totalBudget.toLocaleString("ko-KR")}원</span>} />
          <div className="prize-pool__items">{items.map((item) => <div className="prize-pool__item" key={item.id}>
            <div><strong>{item.name}</strong><span>{item.unitAmount.toLocaleString("ko-KR")}원 × {item.quantity}개</span></div>
            <div className="prize-pool__progress"><b>{item.drawnCount}</b><span>/ {item.winnerCount}명</span></div>
            <button className="admin-button admin-button--compact" type="button" disabled={drawingItemId !== null || item.drawnCount >= item.winnerCount || !stages.find((stage) => stage.stage === selectedStage)?.locked} onClick={() => void drawItem(item)}>{drawingItemId === item.id ? "서버 추첨 중…" : item.drawnCount >= item.winnerCount ? "추첨 완료" : `${selectedStage === "SECOND" ? "2차" : "3차"} 당첨자 1명 추첨`}</button>
          </div>)}</div>
        </article>;
      })}
    </section>

    {winner && <section className={`prize-inventory-winner ${presentation ? "prize-stage--presentation" : ""}`} role="status">
      <div className="confetti" aria-hidden="true">✦ ◆ ★ ✦ ◆ ★</div>
      <small>SERVER CONFIRMED WINNER</small>
      <strong>{winner.participantCode}</strong>
      <span>{winner.prizeName} · {winner.round}번째 당첨</span>
      <button className="admin-button admin-button--primary" type="button" onClick={() => void togglePresentation()}>{presentation ? "전체 화면 종료" : "전체 화면 발표"}</button>
    </section>}
    <p className="participant-feedback" role="status">{feedback}</p>
  </div>;
}
