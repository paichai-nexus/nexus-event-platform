import { AWARDS } from "@/features/landing/data/eventData";
import Link from "next/link";
import { SectionHeading } from "./SectionHeading";

export function AwardsSection() {
  return (
    <section className="section" id="awards" aria-labelledby="awards-title">
      <div className="shell">
        <div id="awards-title"><SectionHeading label="AWARDS" title="시상 안내" light /></div>
        <div className="awards-grid">
          {AWARDS.map((award) => (
            <article key={award.title} className="award-card">
              <span aria-hidden="true">{award.icon}</span>
              <div><strong>{award.title}</strong>{award.prize && <b>{award.prize}</b>}<small>{award.count}</small></div>
            </article>
          ))}
        </div>
        <div className="landing-guide-actions">
          <Link href="/awards-prizes">시상금·경품 전체 안내</Link>
          <Link href="/evaluation-guide">채점 시스템·평가 기준</Link>
        </div>
      </div>
    </section>
  );
}
