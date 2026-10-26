import { PROJECT_TEAM } from "@/features/landing/data/eventData";
import { SectionHeading } from "./SectionHeading";

export function ProjectTeamSection() {
  return (
    <section className="section project-team" aria-labelledby="team-title">
      <div className="shell">
        <div id="team-title"><SectionHeading label="PROJECT TEAM" title="프로젝트 운영진" light /></div>
        <div className="team-grid">
          {PROJECT_TEAM.map((member) => (
            <article key={member.role}><small>{member.role}</small><strong>{member.name}</strong></article>
          ))}
        </div>
      </div>
    </section>
  );
}
