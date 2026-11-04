"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import type { PrizeInventoryItem, PrizeItemDraw } from "@/types/prize-inventory";

const stageCopy = {
  FIRST: { step: "01", eyebrow: "1부 종료 · 전체 참여 경품", title: "커피 쿠폰 1만원", detail: "1부 QR 출석자 · 15명", accent: "blue" },
  SECOND: { step: "02", eyebrow: "3부 시작", title: "잔여 경품", detail: "1·2부 출석자", accent: "green" },
  THIRD: { step: "04", eyebrow: "GRAND FINALE", title: "마지막 럭키드로우", detail: "1·2부 출석자", accent: "gold" },
} as const;

export default function PrizeFinalePage() {
  const { state } = useEventOps();
  const [items, setItems] = useState<PrizeInventoryItem[]>([]);
  const [draws, setDraws] = useState<PrizeItemDraw[]>([]);
  const [spotlight, setSpotlight] = useState<PrizeItemDraw | null>(null);
  const [revealed, setRevealed] = useState(false);
  const initializedRef = useRef(false);
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
      if (!initializedRef.current) {
        // Do not replay yesterday's/earlier winners on initial projector load.
        initializedRef.current = true;
        lastSeenDraw.current = newest?.drawId ?? null;
      } else if (newest && newest.drawId !== lastSeenDraw.current) {
        lastSeenDraw.current = newest.drawId;
        setRevealed(false);
        setSpotlight(newest);
        // The API already confirmed the winner. Animation only delays revealing identity.
        window.setTimeout(() => setRevealed(true), 2500);
        window.setTimeout(() => setSpotlight((current) => current?.drawId === newest.drawId ? null : current), 10_500);
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
    <style>{`
.nexus-lucky-projector-rolling{display:grid;place-items:center;gap:24px;align-content:center;min-height:70vh;text-align:center;color:#fff}
.nexus-lucky-projector-rolling small{font-size:clamp(26px,4vw,55px);color:#fce68b;letter-spacing:.16em;text-shadow:0 0 40px #ffb300}
.nexus-lucky-projector-rolling p{font-size:clamp(34px,6vw,80px);font-weight:950}
.nexus-lucky-projector-rolling b{font-size:clamp(50px,10vw,130px);letter-spacing:.12em;color:#9de5ff;animation:nexus-projector-flicker .25s ease-in-out infinite alternate;text-shadow:0 0 50px #38bdf8}
.nexus-lucky-projector-rolling em{font-size:clamp(16px,2vw,30px);font-style:normal;color:#ccdeef}
@keyframes nexus-projector-flicker{from{opacity:.5;transform:scale(.94)}to{opacity:1;transform:scale(1.05)}}
@media(prefers-reduced-motion:reduce){.nexus-lucky-projector-rolling b{animation:none}}
`}</style>
    <header className="prize-finale__header"><div><small>PAEJAE UNIVERSITY · 2026</small><strong>제24회 경영대학 학술제</strong></div><div><span className={online ? "is-online" : ""}>{online ? "LIVE" : "OFFLINE"}</span><button type="button" onClick={enterFullscreen}>전체 화면</button><Link href="/admin/prize">운영 화면</Link></div></header>
    <section className="prize-finale__intro"><small>PAICHAI 2026 · LUCKY DRAW</small><h1>1부 럭키드로우<br /><em>커피 쿠폰 15명</em></h1><p>1부 QR 출석자 대상 · 1만원 커피 쿠폰 · 서버 무작위 추첨</p></section>
    <section className="prize-finale__credits">
      {(["FIRST", "SECOND"] as const).map((stage) => { const meta = stageCopy[stage]; const stageItems = items.filter((item) => item.drawStage === stage); return <article className={`prize-credit prize-credit--${meta.accent}`} key={stage}><b>{meta.step}</b><div><small>{meta.eyebrow}</small><h2>{meta.title}</h2><p>{meta.detail}</p></div><strong>{stageItems.reduce((sum, item) => sum + item.winnerCount, 0)}명</strong></article>; })}
      
      <article className="prize-credit prize-credit--gold prize-credit--final"><b>04</b><div><small>GRAND FINALE · 2부 출석자</small><h2>마지막 럭키드로우</h2><div className="prize-finale__items">{items.filter((item) => item.drawStage === "THIRD").map((item) => <span key={item.id}><strong>{item.name}{item.pool === "AUDIENCE_JURY" ? " · 청중평가단 전용" : ""}</strong><i>{item.winnerCount}명</i></span>)}</div></div><strong>{items.filter((item) => item.drawStage === "THIRD").reduce((sum, item) => sum + item.winnerCount, 0)}명</strong></article>
    </section>
    {draws.length > 0 && <section className="prize-finale__winners" aria-label="최근 당첨자"><small>RECENT WINNERS</small><div>{draws.slice(0, 6).map((draw) => <article key={draw.drawId}><b>{draw.maskedName}</b><span>{draw.department} · {draw.maskedStudentNumber}</span><em>{draw.prizeName}</em></article>)}</div></section>}
    <footer className="prize-finale__footer"><div><small>DRAW PROGRESS</small><strong>{drawn}<span>/ {total}</span></strong></div><p>중복 당첨 차단 · 서버 확정 · 개인정보 마스킹 · 감사 기록 보존</p><b>THANK YOU</b></footer>
    {spotlight && <section className="prize-winner-spotlight" role="status" aria-live="assertive"><div className="prize-winner-spotlight__rays" /><div className="prize-winner-spotlight__confetti" aria-hidden="true">✦ ◆ ★ ✦ ● ★ ◆ ✦ ★ ●</div>{revealed ? <><small>CONGRATULATIONS</small><p>{spotlight.prizeName}</p><h2>{spotlight.maskedName}</h2><h3>{spotlight.department} <i>·</i> {spotlight.maskedStudentNumber}</h3><strong>{spotlight.participantCode}</strong><span>당첨을 축하합니다!</span></> : <div className="nexus-lucky-projector-rolling"><small>LUCKY DRAW</small><p>운명의 주인공을 공개합니다</p><b>✦ ◈ ✧ ◇ ✦</b><em>서버 당첨 확정 · 결과 공개 준비</em></div>}</section>}
  </main>;
}
