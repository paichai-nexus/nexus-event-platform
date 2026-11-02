import Link from "next/link";
import { DOCUMENT_CRITERIA, PRESENTATION_CRITERIA, QNA_CRITERIA, SCORE_BANDS, SCORING_SUMMARY, type EvaluationCriterion } from "@/features/scoring/data/evaluationGuide";

function Criteria({ items }: { items: EvaluationCriterion[] }) {
  return <ol className="criteria-list">{items.map((item) => <li key={item.name}><span>{item.name}</span><strong>{item.points}점</strong></li>)}</ol>;
}

export default function EvaluationGuidePage() {
  return <main className="guide-page">
    <header className="guide-page__header"><Link href="/">← 행사 안내</Link><span>EVALUATION GUIDE</span></header>
    <section className="guide-hero"><small>공정한 평가를 위한 운영 기준</small><h1>채점 시스템·평가 기준</h1><p>제공된 심사평가기준표를 화면 설명용으로 재구성했습니다. 승인되지 않은 환산식은 적용하지 않습니다.</p></section>
    <section className="guide-section"><div className="guide-heading"><span>01</span><div><small>SCORING FLOW</small><h2>전체 채점 구조</h2></div></div>
      <div className="score-flow"><article><small>전문심사위원</small><strong>{SCORING_SUMMARY.judgeCount}명 × {SCORING_SUMMARY.pointsPerJudge}점</strong><b>{SCORING_SUMMARY.judgeRawMaximum}점</b></article><i>+</i><article><small>청중평가단</small><strong>{SCORING_SUMMARY.audienceCount}명 × {SCORING_SUMMARY.audiencePointsPerPerson}점</strong><b>{SCORING_SUMMARY.audienceRawMaximum}표</b></article><i>=</i><article><small>문서 기재 원점수</small><strong>{SCORING_SUMMARY.statedWeight}</strong><b>{SCORING_SUMMARY.statedRawTotal}</b></article></div>
      <div className="policy-warning"><strong>공식 환산식 승인 필요</strong><p>전문심사 600점과 청중 240표는 단위가 다르며, 원수치 비율도 문서의 70:30과 정확히 일치하지 않습니다. 공식 환산식·동점 규칙 승인 전까지 순위 확정과 결과 공개는 잠금 상태입니다.</p><code>{SCORING_SUMMARY.policyStatus}</code></div>
    </section>
    <section className="guide-section"><div className="guide-heading"><span>02</span><div><small>JUDGE · 200 POINTS</small><h2>전문심사위원 1인 기준</h2></div></div>
      <div className="criteria-columns"><article><header><span>1차</span><div><h3>서류평가</h3><small>50점 · 25%</small></div></header><Criteria items={DOCUMENT_CRITERIA} /></article><article><header><span>2차</span><div><h3>발표평가</h3><small>100점 · 50%</small></div></header><div className="criteria-split"><section><b>창업 부문</b><Criteria items={PRESENTATION_CRITERIA.STARTUP} /></section><section><b>기업분석 부문</b><Criteria items={PRESENTATION_CRITERIA.BUSINESS_ANALYSIS} /></section></div></article><article><header><span>3차</span><div><h3>질의응답</h3><small>50점 · 25%</small></div></header><Criteria items={QNA_CRITERIA} /></article></div>
    </section>
    <section className="guide-section"><div className="guide-heading"><span>03</span><div><small>RUBRIC</small><h2>공통 점수 구간</h2></div></div><div className="rubric-grid">{SCORE_BANDS.map((band) => <article key={band.maximum}><strong>{band.maximum}점 항목</strong>{band.bands.map((text) => <span key={text}>{text}</span>)}</article>)}</div>
      <ul className="judge-principles"><li>발표 기술만으로 점수를 부여하지 않습니다.</li><li>자료의 양과 분석의 질을 구분합니다.</li><li>서류·발표·질의응답 단계에서 같은 내용을 중복 평가하지 않습니다.</li></ul>
    </section>
    <footer className="guide-footer"><Link href="/awards-prizes">시상금·경품 안내 보기 →</Link></footer>
  </main>;
}
