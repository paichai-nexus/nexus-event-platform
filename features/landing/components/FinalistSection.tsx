"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { FINALISTS } from "@/features/landing/data/eventData";
import type { FinalistCategory } from "@/features/landing/types/landing";
import { SectionHeading } from "./SectionHeading";

const filters: FinalistCategory[] = ["전체", "창업 부문", "기업분석 부문"];

export function FinalistSection() {
  const [filter, setFilter] = useState<FinalistCategory>("전체");
  const finalists = useMemo(
    () => (filter === "전체" ? FINALISTS : FINALISTS.filter((team) => team.category === filter)),
    [filter],
  );

  return (
    <section className="section finalists" id="finalists" aria-labelledby="finalists-title">
      <div className="shell">
        <div id="finalists-title"><SectionHeading label="FINALIST" title="본선 참가팀" light /></div>
        <div className="filters" role="group" aria-label="참가 부문 필터">
          {filters.map((item) => (
            <button key={item} type="button" aria-pressed={filter === item} onClick={() => setFilter(item)}>{item}</button>
          ))}
        </div>
        <div className="finalist-list" aria-live="polite">
          {finalists.map((team) => (
            <article key={team.id} className="finalist-card">
              <span className="finalist-card__number">{team.id}</span>
              <div className="finalist-card__cover">
                <Image src={team.coverImage} alt={`${team.name} 발표자료 표지`} fill sizes="(min-width: 960px) 220px, 38vw" />
              </div>
              <div className="finalist-card__copy">
                <strong>{team.name}</strong>
                <small>{team.department} · {team.category}</small>
                <p>{team.description}</p>
                {team.members.length > 0 && <span>팀원 {team.members.join(", ")}</span>}
                {team.advisors.length > 0 && <span>지도교수 {team.advisors.map((name) => `${name} 교수님`).join(", ")}</span>}
              </div>
              <a className="finalist-card__material" href={team.materialUrl} target="_blank" rel="noreferrer">
                발표자료 {team.materialFormat === "PDF" ? "열기" : "다운로드"} <b>{team.materialFormat}</b>
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
