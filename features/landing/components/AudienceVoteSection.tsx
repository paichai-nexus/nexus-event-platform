import Link from "next/link";
import { EVENT_EXTERNAL_FORMS } from "@/features/event/data/externalForms";
import { SectionHeading } from "./SectionHeading";

export function AudienceVoteSection() {
  return (
    <section className="vote-section" id="vote" aria-labelledby="vote-title">
      <div className="vote-section__dots" aria-hidden="true" />
      <div className="shell vote-section__inner">
        <div id="vote-title"><SectionHeading label="AUDIENCE VOTE" title="청중평가 참여하기" /></div>
        <p className="vote-section__lead">당신의 한 표가<br /><strong>최종 결과에 반영됩니다.</strong></p>
        <div className="vote-section__graphic" aria-hidden="true"><span>▥</span><i>☝</i></div>
        <a className="button button--cream button--wide" href={EVENT_EXTERNAL_FORMS.audienceJuryReservation.url} target="_blank" rel="noreferrer">청중평가단 사전예약 <span>↗</span></a>
        <Link className="button button--outline button--wide vote-section__auth-link" href="/vote">현장 인증·청중평가 <span>→</span></Link>
        <ul className="vote-notes">
          <li><span>✓</span> Google Form으로 예약 후 행사 당일 종이 참석표에 서명합니다.</li>
          <li><span>✓</span> 6개 학과별 20명, 총 120명은 현장 인증 완료 순서로 확정합니다.</li>
          <li><span>✓</span> 학번 중복 등록과 동일 발표팀 중복 투표는 제한됩니다.</li>
        </ul>
      </div>
    </section>
  );
}
