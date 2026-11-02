import Link from "next/link";
import { BEST_REVIEWER_POLICY, CEREMONY_RUN_OF_SHOW, FINALIST_AWARDS, LUCKY_DRAW_PRIZES } from "@/features/event/data/eventGuide";

const won = (amount: number | null) => amount === null ? "금액 최종 확인 예정" : `${amount.toLocaleString("ko-KR")}원`;

export default function AwardsPrizesPage() {
  return <main className="guide-page">
    <header className="guide-page__header"><Link href="/">← 행사 안내</Link><span>AWARDS & PRIZES</span></header>
    <section className="guide-hero"><small>제24회 경영대학 학술제</small><h1>시상금·경품 안내</h1><p>현재 확인된 운영안을 기준으로 정리했습니다. 최종 명단과 미확정 상품은 확인 후 갱신됩니다.</p></section>
    <section className="guide-section"><div className="guide-heading"><span>01</span><div><small>FINALIST AWARDS</small><h2>본선진출팀 시상</h2></div></div>
      <div className="guide-card-grid">{FINALIST_AWARDS.map((item) => <article className="guide-card" key={item.title}><small>{item.count}팀</small><h3>{item.title}</h3><strong>{won(item.amount)}</strong></article>)}</div>
    </section>
    <section className="guide-section"><div className="guide-heading"><span>02</span><div><small>LUCKY DRAW</small><h2>럭키드로우 경품</h2></div></div>
      <div className="prize-guide-table">{LUCKY_DRAW_PRIZES.map((item, index) => <article key={`${item.pool}-${item.name}-${item.amount}`}><b>{String(index + 1).padStart(2, "0")}</b><span>{item.pool}</span><div><h3>{item.name}</h3><small>{won(item.amount)}</small></div><strong>{item.count}명</strong></article>)}</div>
    </section>
    <section className="guide-section"><div className="guide-heading"><span>03</span><div><small>BEST REVIEWER</small><h2>베스트 리뷰어상</h2></div></div>
      <article className="guide-policy-card"><div><small>선정 기준</small><strong>{BEST_REVIEWER_POLICY.eligibility}</strong></div><div><small>전용 상품</small><strong>{BEST_REVIEWER_POLICY.prize}</strong></div><p>공식 1위 결과 확정 전에는 당첨자를 선정하거나 공개하지 않습니다.</p></article>
    </section>
    <section className="guide-section"><div className="guide-heading"><span>04</span><div><small>RUN OF SHOW</small><h2>청중평가·추첨·시상 진행 순서</h2></div></div>
      <ol className="ceremony-flow">{CEREMONY_RUN_OF_SHOW.map((item) => <li key={item.order}><b>{item.order}</b><div><small>{item.title}</small><strong>{item.detail}</strong><span>{item.status}</span></div></li>)}</ol>
    </section>
    <footer className="guide-footer"><Link href="/evaluation-guide">채점 시스템·평가 기준 보기 →</Link></footer>
  </main>;
}
