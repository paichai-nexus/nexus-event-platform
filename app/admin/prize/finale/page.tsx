"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import type { PrizeInventoryItem, PrizeItemDraw } from "@/types/prize-inventory";

const stageCopy = {
  FIRST: { step: "01", eyebrow: "1부 종료", title: "커피 쿠폰", detail: "1부 출석자", accent: "blue" },
  SECOND: { step: "02", eyebrow: "3부 시작", title: "올리브영 2만원", detail: "2부 출석자", accent: "green" },
  THIRD: { step: "04", eyebrow: "GRAND FINALE", title: "마지막 럭키드로우", detail: "2부 출석자", accent: "gold" },
} as const;

export default function PrizeFinalePage() {
  const { state } = useEventOps();
  const [items, setItems] = useState<PrizeInventoryItem[]>([]);
  const [draws, setDraws] = useState<PrizeItemDraw[]>([]);
  const [spotlight, setSpotlight] = useState<PrizeItemDraw | null>(null);
  const [online, setOnline] = useState(false);
  const lastSeenDraw = useRef<string | null>(null);
  const load = useCallback(async () => {
    try {
      const [inventoryResponse, drawResponse] = await Promise.all([
        fetch(`/api/prize-inventory?eventId=${encodeURIComponent(state.eventId)}`, { cache: "no-store" }),
        fetch(`/api/prize-draws?eventId=${encodeURIComponent(state.eventId)}`, { cache: "no-store" }),
      ]);
      const [inventoryPayload, drawPayload] = await Promise.all([inventoryResponse.json(), drawResponse.json()]);
      if (!inventoryResponse.ok || !inventoryPayload.ok || !drawResponse.ok || !drawPayload.ok) throw new Error("load failed");
      const nextDraws = drawPayload.data as PrizeItemDraw[];
      setItems(inventoryPayload.data as PrizeInventoryItem[]);
      setDraws(nextDraws);
      const newest = nextDraws[0];
      if (newest && newest.drawId !== lastSeenDraw.current) {
        lastSeenDraw.current = newest.drawId;
        setSpotlight(newest);
        window.setTimeout(() => setSpotlight((current) => current?.drawId === newest.drawId ? null : current), 8_000);
      }
      setOnline(true);
    } catch { setOnline(false); }
  }, [state.eventId]);
  useEffect(() => { const initial = window.setTimeout(() => void load(), 0); const timer = window.setInterval(() => void load(), 1_500); return () => { window.clearTimeout(initial); window.clearInterval(timer); }; }, [load]);
  const randomItems = useMemo(() => items.filter((item) => item.status === "CONFIRMED" && !item.awardOnly), [items]);
  const total = randomItems.reduce((sum, item) => sum + item.winnerCount, 0);
  const drawn = randomItems.reduce((sum, item) => sum + item.drawnCount, 0);
  const enterFullscreen = () => document.documentElement.requestFullscreen?.();

  return <main className="prize-finale">
    <header className="prize-finale__header"><div><small>PAEJAE UNIVERSITY · 2026</small><strong>제24회 경영대학 학술제</strong></div><div><span className={online ? "is-online" : ""}>{online ? "LIVE" : "OFFLINE"}</span><button type="button" onClick={enterFullscreen}>전체 화면</button><Link href="/admin/prize">운영 화면</Link></div></header>
    <section className="prize-finale__intro"><small>LUCKY DRAW · ENDING CREDITS</small><h1>오늘의 행운,<br /><em>끝까지 이어집니다.</em></h1><p>출석 단계별로 봉인된 대상자 안에서 서버가 무작위 당첨자를 확정합니다.</p></section>
    <section className="prize-finale__credits">
      {(["FIRST", "SECOND"] as const).map((stage) => { const meta = stageCopy[stage]; const stageItems = items.filter((item) => item.drawStage === stage); return <article className={`prize-credit prize-credit--${meta.accent}`} key={stage}><b>{meta.step}</b><div><small>{meta.eyebrow}</small><h2>{meta.title}</h2><p>{meta.detail}</p></div><strong>{stageItems.reduce((sum, item) => sum + item.winnerCount, 0)}명</strong></article>; })}
      <article className="prize-credit prize-credit--red"><b>03</b><div><small>BEST REVIEWER AWARD</small><h2>아웃백 상품권 8만원</h2><p>승인된 베스트 리뷰어 · 추첨 아님</p></div><strong>2명</strong></article>
      <article className="prize-credit prize-credit--gold prize-credit--final"><b>04</b><div><small>GRAND FINALE · 2부 출석자</small><h2>마지막 럭키드로우</h2><div className="prize-finale__items">{items.filter((item) => item.drawStage === "THIRD").map((item) => <span key={item.id}><strong>{item.name}</strong><i>{item.winnerCount}명</i></span>)}</div></div><strong>{items.filter((item) => item.drawStage === "THIRD").reduce((sum, item) => sum + item.winnerCount, 0)}명</strong></article>
    </section>
    {draws.length > 0 && <section className="prize-finale__winners" aria-label="최근 당첨자"><small>RECENT WINNERS</small><div>{draws.slice(0, 6).map((draw) => <article key={draw.drawId}><b>{draw.maskedName}</b><span>{draw.department} · {draw.maskedStudentNumber}</span><em>{draw.prizeName}</em></article>)}</div></section>}
    <footer className="prize-finale__footer"><div><small>DRAW PROGRESS</small><strong>{drawn}<span>/ {total}</span></strong></div><p>중복 당첨 차단 · 서버 확정 · 개인정보 마스킹 · 감사 기록 보존</p><b>THANK YOU</b></footer>
    {spotlight && <section className="prize-winner-spotlight" role="status" aria-live="assertive"><div className="prize-winner-spotlight__rays" /><div className="prize-winner-spotlight__confetti" aria-hidden="true">✦ ◆ ★ ✦ ● ★ ◆ ✦ ★ ●</div><small>CONGRATULATIONS</small><p>{spotlight.prizeName}</p><h2>{spotlight.maskedName}</h2><h3>{spotlight.department} <i>·</i> {spotlight.maskedStudentNumber}</h3><strong>{spotlight.participantCode}</strong><span>당첨을 축하합니다!</span></section>}
  </main>;
}
