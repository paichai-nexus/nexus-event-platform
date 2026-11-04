"use client";

import { useMemo, useState } from "react";
import { useEventOps } from "@/features/event/context/EventOpsProvider";
import { DEMO_SCORING_INPUTS } from "@/features/scoring/lib/demoScoringSimulation";
import { SCORING_POLICY_READY } from "@/features/scoring/data/evaluationPolicy";
import { ScoringDiagnosticsPanel } from "@/components/ScoringDiagnosticsPanel";
import { ScoringPolicyControl } from "@/components/ScoringPolicyControl";
import styles from "./scoringCeremony.module.css";

type Category = "STARTUP" | "BUSINESS_ANALYSIS";
type BoardRow = {
  id: string;
  name: string;
  category: Category;
  order: number;
  values: [number, number, number, number] | null;
  total: number | null;
  rank: number | null;
  tied: boolean;
};

const MAX_SCORE = 840;
const STAGES = ["청중평가", "1차 전문심사", "2차 전문심사", "3차 전문심사"] as const;
const CATEGORIES: { id: Category; label: string }[] = [
  { id: "STARTUP", label: "창업 부문" },
  { id: "BUSINESS_ANALYSIS", label: "기업분석 부문" },
];
const AXIS = [0, 240, 440, 640, 840];
const COLORS = ["#1dcaa8", "#ffd345", "#ff4f86", "#997bfa", "#249eff", "#ff914d"];

function clamp(value: number, max: number) {
  return Math.max(0, Math.min(max, Number.isFinite(value) ? value : 0));
}

function toPercent(value: number) {
  return `${(clamp(value, MAX_SCORE) / MAX_SCORE) * 100}%`;
}

function award(rank: number) {
  return rank === 1 ? "대상" : rank === 2 ? "최우수상" : rank <= 4 ? "우수상" : "챌린지상";
}

function renderValue(row: BoardRow, revealStage: number) {
  return row.values && revealStage > 0 ? row.values[revealStage - 1] : null;
}

/**
 * Rehearsal-only projection. The actual scoring policy remains unapproved.
 * Audience votes are scaled to a 240 point rehearsal axis relative to the
 * highest sample vote count. Individual judge scores are genuine values from
 * the pre-existing demo fixture, not fabricated by this page.
 */
function buildRehearsalRows(teams: { id: string; name: string | null; category: Category; order: number; active: boolean }[]): BoardRow[] {
  const maxVotes = Math.max(1, ...DEMO_SCORING_INPUTS.map((input) => input.audienceVotes));
  const roster = teams.filter((team) => team.active && team.name);
  const source = roster.length > 0
    ? roster.map((team) => ({ id: team.id, name: team.name!, category: team.category, order: team.order }))
    : DEMO_SCORING_INPUTS.map((input, index) => ({ id: input.teamId, name: input.teamName, category: "STARTUP" as Category, order: index + 1 }));
  const mapped = source.map((team) => {
    const sample = DEMO_SCORING_INPUTS.find((input) => input.teamId === team.id || input.teamName === team.name);
    if (!sample) return { ...team, values: null, total: null, rank: null, tied: false } as BoardRow;
    const audience = Math.round((sample.audienceVotes / maxVotes) * 240);
    const j1 = clamp(sample.judgeScores[0], 200);
    const j2 = clamp(sample.judgeScores[1], 200);
    const j3 = clamp(sample.judgeScores[2], 200);
    const values: [number, number, number, number] = [audience, audience + j1, audience + j1 + j2, audience + j1 + j2 + j3];
    return { ...team, values, total: values[3], rank: null, tied: false } as BoardRow;
  });
  return CATEGORIES.flatMap(({ id }) => {
    const categoryRows = mapped.filter((row) => row.category === id).sort((a, b) => (b.total ?? -1) - (a.total ?? -1) || a.order - b.order);
    return categoryRows.map((row) => {
      if (row.total === null) return row;
      const rank = categoryRows.findIndex((other) => other.total === row.total) + 1;
      return { ...row, rank, tied: categoryRows.filter((other) => other.total === row.total).length > 1 };
    });
  });
}

function ScoreBar({ row, position, revealStage }: { row: BoardRow; position: number; revealStage: number }) {
  const current = renderValue(row, revealStage);
  return (
    <div className={styles.scoreRow}>
      <div className={styles.teamCell}>
        <span className={styles.teamOrder}>{String(row.order).padStart(2, "0")}</span>
        <span className={styles.teamName}>{row.name}</span>
      </div>
      <div className={styles.trackArea}>
        <div className={styles.track}>
          <div className={styles.fill} style={{ width: current === null ? "0%" : toPercent(current), background: COLORS[position % COLORS.length] }} />
          {row.values?.map((value, index) => index < revealStage ? (
            <span key={index} className={styles.marker} style={{ left: toPercent(value) }} title={`${STAGES[index]} 누적 ${value}점`} />
          ) : null)}
        </div>
        <div className={styles.trackCaption}>{row.values && revealStage > 0
          ? `${STAGES[revealStage - 1]} · 누적 ${current}점`
          : "점수 비공개 · 집계 대기"}</div>
      </div>
      <div className={styles.scoreCell}>
        <strong>{current === null ? "—" : current}</strong>
        <small> / {MAX_SCORE}점</small>
      </div>
    </div>
  );
}

export default function ScoringPage() {
  const { state } = useEventOps();
  const mockMode = state.runtimeMode === "mock";
  const [revealStage, setRevealStage] = useState(0);
  const [showRanks, setShowRanks] = useState(false);
  const [showFinal, setShowFinal] = useState(false);
  const [showOperations, setShowOperations] = useState(false);
  const rows = useMemo(() => mockMode ? buildRehearsalRows(state.teams) : [], [mockMode, state.teams]);
  const knownRows = rows.filter((row) => row.total !== null);
  const finished = mockMode && revealStage === 4 && knownRows.length > 0;
  const ties = rows.some((row) => row.tied);
  const officialBlocked = !SCORING_POLICY_READY || state.resultStatus !== "FINALIZED";
  const canRevealFinal = finished && !ties;

  const reset = () => { setRevealStage(0); setShowRanks(false); setShowFinal(false); };

  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <div>
          <small>LIVE REHEARSAL · SCORING CEREMONY</small>
          <h1>평가 단계별 집계</h1>
          <p>청중평가 240점 + 전문심사위원 3명 × 200점 = 840점 · <b>시각화용 상한, 공식 환산식 미승인</b></p>
        </div>
        <div className={styles.actions}>
          {mockMode && <>
            <button type="button" onClick={reset}>처음부터</button>
            <button type="button" disabled={revealStage === 4} onClick={() => { setRevealStage((value) => Math.min(4, value + 1)); setShowRanks(false); setShowFinal(false); }}>다음 단계 공개</button>
            <button type="button" disabled={!finished || ties} onClick={() => setShowRanks(true)}>1~6위 순위 공개</button>
            <button type="button" disabled={!canRevealFinal || !showRanks} className={styles.primaryAction} onClick={() => setShowFinal(true)}>최종 순위 확대</button>
          </>}
          <button type="button" onClick={() => setShowOperations((value) => !value)}>{showOperations ? "관리 정보 닫기" : "관리 정보 보기"}</button>
        </div>
      </div>

      <div className={styles.warning} role="status">
        <b>{mockMode ? "MOCK · 리허설 전용" : "운영 데이터 · 공식 순위 공개 잠금"}</b>
        <span>{mockMode
          ? "표시된 점수는 기존 시연 입력 중 일치하는 팀만 사용합니다. DB에 점수를 저장하거나 공식 결과를 확정하지 않습니다."
          : "현재 집계 데이터에는 심사위원별 원점수 3개와 청중 240점 환산 결과가 제공되지 않습니다. 임의 점수를 만들지 않고 공개를 차단했습니다."}</span>
      </div>

      <section className={styles.summary} aria-label="집계 현황">
        <article><small>PART 1 · 청중평가</small><strong>{revealStage > 0 && mockMode ? "공개" : "대기"}</strong><p>240점 상한 · 시연용 환산</p></article>
        <article><small>PART 2–4 · 전문심사</small><strong>{mockMode ? `${Math.max(0, revealStage - 1)} / 3명 공개` : "미연결"}</strong><p>심사위원별 200점 상한</p></article>
        <article><small>현재 집계 단계</small><strong>{mockMode ? (revealStage === 0 ? "공개 대기" : STAGES[revealStage - 1]) : "공식 데이터 대기"}</strong><p>{officialBlocked ? "공식 확정 잠금 유지" : "확정 데이터 확인 필요"}</p></article>
      </section>

      <div className={styles.ribbon}>AUDIENCE + PROFESSIONAL JUDGES <span>단계별 누적 점수 · 표시 전용</span></div>
      <div className={styles.axis} aria-hidden="true"><span />{AXIS.map((value) => <i key={value} style={{ left: toPercent(value) }}>{value}</i>)}<span /></div>
      {CATEGORIES.map((category) => {
        const group = rows.filter((row) => row.category === category.id);
        return (
          <section className={styles.category} key={category.id}>
            <div className={styles.categoryTitle}><strong>{category.label}</strong><small>{group.length}개 팀</small></div>
            {group.length ? group.map((row, index) => (
              <div key={row.id} className={styles.item}>
                {showRanks && finished && row.rank !== null && !row.tied && <span className={styles.rank}>{row.rank}위</span>}
                <ScoreBar row={row} position={index} revealStage={revealStage} />
              </div>
            )) : <p className={styles.empty}>현재 화면에 연결된 팀별 집계 데이터가 없습니다.</p>}
          </section>
        );
      })}

      {showOperations && <section className={styles.operations}>
        <h2>운영 검증 · 기존 기능 유지</h2>
        <p>실제 점수 입력·승인 및 수기 심사표 확인은 기존 운영 화면에서 수행합니다. 이 시각화는 점수를 작성하거나 수정하지 않습니다.</p>
        {!mockMode && <ScoringDiagnosticsPanel eventId={state.eventId} />}
        <ScoringPolicyControl eventId={state.eventId} />
      </section>}

      {showFinal && canRevealFinal && <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="리허설 최종 순위 공개">
        <div className={styles.modal}>
          <small>REHEARSAL · FINAL STANDINGS · NOT OFFICIAL</small>
          <h2>최종 순위 공개</h2>
          <p className={styles.modalSub}>리허설 데이터만 표시됩니다. 실제 시상에 사용하지 마세요.</p>
          <div className={styles.finalColumns}>{CATEGORIES.map((category) => (
            <section key={category.id}>
              <h3>{category.label}</h3>
              {rows.filter((row) => row.category === category.id && row.total !== null).map((row) => (
                <div className={styles.finalRow} key={row.id}>
                  <span>{row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `${row.rank}위`}</span>
                  <div><strong>{row.rank}위 · {row.name}</strong><small>{award(row.rank!)} · {row.total} / {MAX_SCORE}점 · 리허설</small></div>
                </div>
              ))}
              {!rows.some((row) => row.category === category.id && row.total !== null) && <p className={styles.empty}>시연 점수 없음</p>}
            </section>
          ))}</div>
          <button type="button" onClick={() => setShowFinal(false)}>집계 화면으로 돌아가기</button>
        </div>
      </div>}
    </main>
  );
}
