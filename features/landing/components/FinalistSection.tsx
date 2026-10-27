"use client";

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
              <div className="finalist-card__avatar" aria-hidden="true">N</div>
              <div className="finalist-card__copy">
                <strong>{team.name}</strong><small>{team.category}</small><p>{team.description}</p>
              </div>
              <span className="finalist-card__status">준비 중</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
