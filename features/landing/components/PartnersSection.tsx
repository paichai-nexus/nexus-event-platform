import { COLLABORATION_AREAS, PARTNERS } from "@/features/landing/data/eventData";
import { SectionHeading } from "./SectionHeading";

export function PartnersSection() {
  return (
    <section className="section partners" aria-labelledby="partners-title">
      <div className="shell">
        <div id="partners-title"><SectionHeading label="WITH" title="함께하는 주체" light /></div>
        <div className="partners-grid">
          {PARTNERS.map((partner, index) => (
            <article key={partner.name}>
              <span className="partners-grid__mark" aria-hidden="true">{index === 0 ? "P" : "N"}</span>
              <strong>{partner.name}</strong><small>{partner.englishName}</small>
            </article>
          ))}
        </div>
        <div className="collaboration-list" aria-label="협업 분야">
          {COLLABORATION_AREAS.map((area) => <span key={area}>{area}</span>)}
        </div>
      </div>
    </section>
  );
}
