import { EVENT_INFO } from "@/features/landing/data/eventData";
import { SectionHeading } from "./SectionHeading";

export function EventInfo() {
  return (
    <section className="section section--paper" id="info" aria-labelledby="info-title">
      <div className="paper-tape" aria-hidden="true" />
      <div className="shell section__inner">
        <div id="info-title"><SectionHeading label="INFO" title="학술제 안내" /></div>
        <div className="info-layout">
          <dl className="info-list">
            <div><dt>DATE</dt><dd>{EVENT_INFO.date}</dd></div>
            <div><dt>TIME</dt><dd>{EVENT_INFO.time}</dd></div>
            <div><dt>VENUE</dt><dd>{EVENT_INFO.venue}</dd></div>
          </dl>
          <div className="info-program">
            <p>PROGRAM</p>
            {EVENT_INFO.phases.map(([phase, description]) => (
              <div key={phase}><strong>{phase}</strong><span>{description}</span></div>
            ))}
          </div>
        </div>
        {EVENT_INFO.mapUrl ? (
          <a className="button button--dark button--wide" href={EVENT_INFO.mapUrl} target="_blank" rel="noreferrer">지도에서 길찾기 <span>↗</span></a>
        ) : (
          <button className="button button--dark button--wide" type="button" disabled>지도 정보 준비 중 <span>↗</span></button>
        )}
      </div>
    </section>
  );
}
