import { PROGRAM_ITEMS } from "@/features/landing/data/eventData";
import { SectionHeading } from "./SectionHeading";

export function ProgramSection() {
  return (
    <section className="section" id="program" aria-labelledby="program-title">
      <div className="shell">
        <div id="program-title"><SectionHeading label="PROGRAM" title="행사 프로그램" light /></div>
        <ol className="program-list">
          {PROGRAM_ITEMS.map((item) => (
            <li key={item.id}>
              <span className="program-list__number">{item.id}</span>
              <time>{item.time}</time>
              <div>{item.category && <small>{item.category}</small>}<strong>{item.title}</strong></div>
              <span className="program-list__mark" aria-hidden="true">{item.id === "07" ? "♜" : "✦"}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
