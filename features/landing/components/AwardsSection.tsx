import { AWARDS } from "@/features/landing/data/eventData";
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
      </div>
    </section>
  );
}
