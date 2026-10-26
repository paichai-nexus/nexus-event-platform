import Link from "next/link";
import { SectionHeading } from "./SectionHeading";

export function AudienceVoteSection() {
  return (
    <section className="vote-section" id="vote" aria-labelledby="vote-title">
      <div className="vote-section__dots" aria-hidden="true" />
      <div className="shell vote-section__inner">
        <div id="vote-title"><SectionHeading label="AUDIENCE VOTE" title="청중평가 참여하기" /></div>
        <p className="vote-section__lead">당신의 한 표가<br /><strong>최종 결과에 반영됩니다.</strong></p>
        <div className="vote-section__graphic" aria-hidden="true"><span>▥</span><i>☝</i></div>
        <Link className="button button--cream button--wide" href="/vote">청중평가 참여하기 <span>→</span></Link>
        <ul className="vote-notes">
          <li><span>✓</span> 현장 체크인을 완료한 참가자만 참여할 수 있습니다.</li>
          <li><span>✓</span> 중복 제출은 제한됩니다.</li>
        </ul>
      </div>
    </section>
  );
}
