"use client";

import { useCallback, useEffect, useState } from "react";
import { useEventOps } from "@/features/event/context/EventOpsProvider";

type TeamScore = {
  id: string;
  name: string;
  category: string;
  order: number;
  judgeSlots: Array<number | null>;
  submittedJudges: number;
  total: number | null;
  complete: boolean;
  rank: number | null;
};

type ScoringResult = {
  maxScore: number;
  judgeCount: number;
  audienceIncluded: boolean;
  teams: TeamScore[];
  allComplete: boolean;
  updatedAt: string;
};

const categories = [
  { key: "STARTUP", name: "창업 부문" },
  { key: "BUSINESS_ANALYSIS", name: "기업분석 부문" },
] as const;

const colors = ["#20d9b0", "#f4c84a", "#e66cac", "#8e80ff", "#40a4ff", "#ff945e"];

function errorMessage(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "message" in value) {
    return String(value.message);
  }
  return "집계 데이터를 조회하지 못했습니다.";
}

export default function ScoreCeremonyPage() {
  const { state } = useEventOps();
  const [result, setResult] = useState<ScoringResult | null>(null);
  const [error, setError] = useState("");
  const [finalOpen, setFinalOpen] = useState(false);
  const [showNames, setShowNames] = useState(true);

  const load = useCallback(async () => {
    // 행사 Snapshot과 별개로 제출·잠금 점수를 직접 조회한다.
    const eventId = state.snapshotReady
      ? state.eventId
      : "00000000-0000-4000-8000-000000000100";

    try {
      const response = await fetch(
        `/api/scoring/live?eventId=${encodeURIComponent(eventId)}`,
        { cache: "no-store", credentials: "same-origin" }
      );

      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(errorMessage(payload.error));
      }

      const data = payload.data as ScoringResult;

      if (
        data.maxScore !== 600 ||
        data.judgeCount !== 3 ||
        data.audienceIncluded !== false
      ) {
        throw new Error("집계 기준이 600점 전문가 심사와 일치하지 않습니다.");
      }

      setResult(data);
      setError("");
    } catch (cause) {
      setResult(null);
      setFinalOpen(false);
      setError(
        cause instanceof Error ? cause.message : "서버 집계 조회 오류"
      );
    }
  }, [state.eventId, state.snapshotReady]);

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [load]);

  const teams = result?.teams ?? [];
  const completeTeams = teams.filter((team) => team.complete).length;
  const allComplete = result?.allComplete === true;

  return (
    <main className="score-show">
      <style>{`
        .score-show{min-height:100vh;background:radial-gradient(ellipse at top right,#123759,#061428 55%,#020810);color:#eaf5ff;padding:34px clamp(18px,4vw,64px);font-family:inherit}
        .score-show *{box-sizing:border-box}
        .score-show__header{display:flex;justify-content:space-between;align-items:start;gap:20px;flex-wrap:wrap}
        .score-show__eyebrow{font-size:13px;color:#62cbff;font-weight:800;letter-spacing:.2em}
        .score-show h1{font-size:clamp(34px,4vw,64px);margin:12px 0 7px}
        .score-show__sub{color:#adc5d8;font-size:16px}
        .score-show__actions{display:flex;gap:9px;flex-wrap:wrap}
        .score-show button{cursor:pointer;background:#123753;color:#e9f8ff;border:1px solid #35688b;border-radius:7px;padding:13px 17px;font-weight:800}
        .score-show button:disabled{opacity:.4;cursor:not-allowed}
        .score-show button.primary{background:#067c7d;border-color:#26d1c3}
        .score-show button.gold{background:#8b6220;border-color:#e5bd60}
        .score-show__summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;margin:28px 0}
        .score-show__summary article{padding:22px;border:1px solid #285573;background:#081e33}
        .score-show__summary small{display:block;color:#8cbbd5;font-weight:700}
        .score-show__summary strong{display:block;font-size:clamp(28px,3vw,48px);margin-top:7px}
        .score-show__summary span{font-size:15px;color:#93abc0;margin-left:5px}
        .score-show__alert{padding:18px;border:1px solid #b77949;color:#ffcf9b;background:#2a1b16;margin-bottom:22px}
        .score-show__group{margin:24px 0}
        .score-show__group h2{font-size:22px;border-left:4px solid #28b9fb;padding-left:12px;margin-bottom:12px}
        .score-show__group h2 small{float:right;color:#8ab3d0;font-size:13px}
        .score-show__team{display:grid;grid-template-columns:minmax(150px,220px) 1fr 145px;align-items:center;gap:18px;margin:6px 0;padding:16px;background:#071d31;border:1px solid #19415d}
        .score-show__name strong{display:block;font-size:17px}
        .score-show__name small{color:#9cbbcc}
        .score-show__bar{height:16px;border-radius:99px;background:#24445a;overflow:hidden;display:flex;position:relative}
        .score-show__segment{height:100%;transition:width .5s}
        .score-show__marks{display:flex;justify-content:space-between;gap:6px;margin-top:7px;color:#a8d1e7;font-size:11px}
        .score-show__total{text-align:right}
        .score-show__total strong{font-size:25px}
        .score-show__total small{display:block;color:#a7bccc;font-size:12px}
        .score-show__scale{display:flex;justify-content:space-between;color:#98afc1;margin-left:240px;font-size:12px}
        .score-show__overlay{position:fixed;inset:0;background:rgba(0,7,17,.96);z-index:9999;overflow:auto;padding:5vh 5vw;display:grid;place-items:center}
        .score-show__final{width:min(1150px,100%);padding:30px;border:1px solid #367da8;background:linear-gradient(135deg,#0b2944,#061525)}
        .score-show__final h2{text-align:center;font-size:clamp(34px,5vw,60px);margin:5px 0 25px}
        .score-show__columns{display:grid;grid-template-columns:1fr 1fr;gap:18px}
        .score-show__rank{display:flex;align-items:center;gap:16px;padding:15px;border-bottom:1px solid #23506e}
        .score-show__rank b{font-size:22px;min-width:42px}
        .score-show__rank strong{flex:1}
        .score-show__rank em{font-style:normal;color:#8ee0f8}
        @media(max-width:800px){.score-show__summary{grid-template-columns:1fr}.score-show__team{grid-template-columns:1fr;gap:8px}.score-show__scale{margin-left:0}.score-show__columns{grid-template-columns:1fr}}
      `}</style>

      <header className="score-show__header">
        <div>
          <div className="score-show__eyebrow">
            PAICHAI NEXUS · LIVE JUDGE SCORING
          </div>
          <h1>심사위원 점수 집계</h1>
          <div className="score-show__sub">
            제출·잠금된 심사표만 반영 · 청중평가 0점 · 총 600점
          </div>
        </div>

        <div className="score-show__actions">
          <button type="button" onClick={() => void load()}>
            지금 새로고침
          </button>
          <button type="button" onClick={() => setShowNames(v => !v)}>
            {showNames ? "팀명 숨기기" : "팀명 보기"}
          </button>
          <button
            className="gold"
            type="button"
            disabled={!allComplete || !!error}
            onClick={() => setFinalOpen(true)}
          >
            최종 순위 공개
          </button>
          <button
            className="primary"
            type="button"
            onClick={() => void document.documentElement.requestFullscreen?.()}
          >
            전체 화면
          </button>
        </div>
      </header>

      <section className="score-show__summary">
        <article>
          <small>전문가 심사 만점</small>
          <strong>600 <span>점</span></strong>
        </article>
        <article>
          <small>집계 완료 팀</small>
          <strong>{completeTeams} <span>/ {teams.length}팀</span></strong>
        </article>
        <article>
          <small>집계 원본</small>
          <strong style={{fontSize:23}}>SUBMITTED ONLY</strong>
          <small>서버 DB · 5초 자동 갱신</small>
        </article>
      </section>

      {error && (
        <div className="score-show__alert" role="alert">
          점수 집계 실패: {error}
        </div>
      )}

      {!result && !error && (
        <div className="score-show__alert">
          서버의 제출·잠금 점수를 조회하고 있습니다.
        </div>
      )}

      {result && !allComplete && (
        <div className="score-show__alert">
          아직 모든 팀의 심사위원 3명 제출이 완료되지 않았습니다.
          미완료 팀의 총점과 순위는 확정하지 않습니다.
        </div>
      )}

      {result && categories.map((category) => {
        const rows = teams
          .filter(team => team.category === category.key)
          .sort((a,b) => a.order - b.order);

        return (
          <section className="score-show__group" key={category.key}>
            <h2>{category.name}<small>{rows.length}팀</small></h2>
            <div className="score-show__scale">
              <span>0</span><span>200</span><span>400</span><span>600</span>
            </div>

            {rows.map((team, index) => {
              const slots = team.judgeSlots;
              const visible = slots.map(value => value ?? 0);
              const partial = visible.reduce((sum,value) => sum + value,0);

              return (
                <div className="score-show__team" key={team.id}>
                  <div className="score-show__name">
                    <small>{String(team.order).padStart(2,"0")}번 팀</small>
                    <strong>
                      {showNames ? team.name : "심사 진행 중"}
                    </strong>
                  </div>
                  <div>
                    <div className="score-show__bar">
                      {visible.map((value,slot) => (
                        <div
                          key={slot}
                          className="score-show__segment"
                          style={{
                            width:`${(value/600)*100}%`,
                            background:colors[(index+slot)%colors.length],
                            opacity: slots[slot] === null ? 0 : 1
                          }}
                        />
                      ))}
                    </div>
                    <div className="score-show__marks">
                      {slots.map((value,slot) => (
                        <span key={slot}>
                          심사 {slot+1}: {value === null ? "미제출" : `${value}/200`}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="score-show__total">
                    <strong>{team.complete ? team.total : "—"}</strong>
                    <small>
                      {team.complete
                        ? `600점 만점 · ${team.rank}위`
                        : `${team.submittedJudges}/3명 제출 · 누적 ${partial}점`}
                    </small>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      {finalOpen && allComplete && result && (
        <div className="score-show__overlay" role="dialog" aria-modal="true">
          <div className="score-show__final">
            <div className="score-show__eyebrow" style={{textAlign:"center"}}>
              PROFESSIONAL JUDGES · FINAL STANDINGS
            </div>
            <h2>최종 순위 공개</h2>
            <div className="score-show__columns">
              {categories.map(category => (
                <div key={category.key}>
                  <h3 style={{textAlign:"center"}}>{category.name}</h3>
                  {teams
                    .filter(team => team.category === category.key && team.complete)
                    .sort((a,b) => (b.total ?? 0)-(a.total ?? 0))
                    .map(team => (
                      <div className="score-show__rank" key={team.id}>
                        <b>{team.rank}위</b>
                        <strong>{team.name}</strong>
                        <em>{team.total}/600</em>
                      </div>
                    ))}
                </div>
              ))}
            </div>
            <div style={{textAlign:"center",marginTop:28}}>
              <button
                type="button"
                onClick={() => setFinalOpen(false)}
              >
                집계 화면으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
