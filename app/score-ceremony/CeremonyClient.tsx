"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ceremony.module.css";
import { SCORE_LIMIT, scoreAtStep, scorePercent, type CeremonyTeam } from "./scoreMath";
import { categoryFinalRanking } from "./awards";

const HOLD_MS = 7000;
const JUDGE_STEPS = [
  "PART 1 · 청중평가 공개",
  "PART 2 · 심사위원 1 공개",
  "PART 3 · 심사위원 2 공개",
  "PART 4 · 심사위원 3 공개 · 집계 완료",
];
// Four cumulative limits on one 840-point graph.
const TICKS = [0, 240, 440, 640, 840];
const STEP_LIMITS = [240, 440, 640, 840];
function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function TeamRow({ team, step, index, rank, hasResults }: { team: CeremonyTeam; step: number; index: number; rank: number | null; hasResults: boolean }) {
  const current = scoreAtStep(team, step);
  const professional = team.judges.slice(0, step).reduce((sum, score) => sum + score, 0);
  const markers = (hasResults ? team.judges.slice(0, step) : []).map((_, n) => ({
    label: `${n + 1}번 심사`,
    score: scoreAtStep(team, n + 1),
  }));
  return (
    <div className={styles.teamRow}>
      <span className={styles.teamIndex}>{String(index + 1).padStart(2, "0")}</span>
      <div className={styles.rankPosition}>{hasResults && rank !== null && rank <= 6 ? <span className={styles.rankBadge} data-rank={rank}>{rank}등</span> : <span className={styles.rankPending}>{hasResults ? "" : "대기"}</span>}</div>
      <div className={styles.teamName}><small>{team.id} · {team.category === "STARTUP" ? "창업" : "기업분석"}</small><strong>{team.name}</strong></div>
      <div className={styles.graphField}>
        <div className={styles.rail} aria-label={`${team.name}: 총 ${current}점 / 840점`}>
          {TICKS.slice(1, -1).map((tick) => <span key={tick} className={styles.guide} style={{ left: `${scorePercent(tick)}%` }} />)}
          <span className={styles.audienceFill} style={{ width: `${scorePercent(team.audience)}%` }} />
          <span className={styles.totalFill} style={{ width: `${scorePercent(current)}%`, background: team.color }} />
          {hasResults && <span className={styles.headDot} style={{ left: `${scorePercent(current)}%`, background: team.color }} />}
          {hasResults && <span className={`${styles.marker} ${styles.audienceMarker}`} style={{ left: `${scorePercent(team.audience)}%` }} title={`청중평가: ${team.audience} / 240점`}>
            <span className={styles.markerDot} /><span className={styles.markerLabel}>청중평가 · {team.audience}</span>
          </span>}
          {markers.map((marker) => <span key={marker.label} className={styles.marker} style={{ left: `${scorePercent(marker.score)}%` }} title={`${marker.label}: 누적 ${marker.score}점`}><span className={styles.markerDot} /><span className={styles.markerLabel}>{marker.label} · {marker.score}</span></span>)}
        </div>
      </div>
      <div className={styles.totalScore}><strong>{formatNumber(current)}</strong><small>/ {SCORE_LIMIT}점</small></div>
      <div className={styles.judgeScore}>심사 {professional}<small>/ 600</small></div>
    </div>
  );
}

export default function CeremonyClient({ initialTeams, isDemo }: { initialTeams: CeremonyTeam[]; isDemo: boolean }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [finishedScreen, setFinishedScreen] = useState(false);
  const [showRanks, setShowRanks] = useState(false);
  const [showMedals, setShowMedals] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const [teams, setTeams] = useState<CeremonyTeam[]>(initialTeams);
  const [draft, setDraft] = useState("");
  const groups = useMemo(() => ({
    STARTUP: teams.filter((team) => team.category === "STARTUP"),
    BUSINESS_ANALYSIS: teams.filter((team) => team.category === "BUSINESS_ANALYSIS"),
  }), [teams]);

  const finalAwards = useMemo(() => ({
    STARTUP: categoryFinalRanking(groups.STARTUP),
    BUSINESS_ANALYSIS: categoryFinalRanking(groups.BUSINESS_ANALYSIS),
  }), [groups]);
  const awardTie = finalAwards.STARTUP.hasTie || finalAwards.BUSINESS_ANALYSIS.hasTie;
  // Competition ranking within each category; equal scores share the same rank.
  // No rankings are shown in production until verified scoring data is connected.
  const ranks = useMemo(() => {
    const result = new Map<string, number>();
    if (!isDemo) return result;
    for (const group of [groups.STARTUP, groups.BUSINESS_ANALYSIS]) {
      const sorted = [...group].sort((a, b) => scoreAtStep(b, step) - scoreAtStep(a, step));
      sorted.forEach((team) => {
        const value = scoreAtStep(team, step);
        result.set(team.id, sorted.findIndex((item) => scoreAtStep(item, step) === value) + 1);
      });
    }
    return result;
  }, [groups, step, isDemo]);

  useEffect(() => {
    if (!isDemo || !playing || step >= 3) return;
    const timer = window.setTimeout(() => setStep((previous) => previous + 1), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [playing, step, isDemo]);

  const restart = () => { setStep(0); setPlaying(false); setFinishedScreen(false); setShowRanks(false); setShowMedals(false); };
  const start = () => { if (!isDemo) return; restart(); setPlaying(true); };
  const loadScores = () => {
    if (!isDemo) return;
    try {
      const parsed: unknown = JSON.parse(draft);
      if (!Array.isArray(parsed) || parsed.length !== teams.length) throw new Error("팀 개수가 일치하지 않습니다.");
      const values = parsed as unknown[];
      const next = teams.map((team, i) => {
        const item = values[i];
        if (typeof item !== "object" || item === null) throw new Error(`${i + 1}번 팀 데이터가 잘못되었습니다.`);
        const row = item as Record<string, unknown>;
        const judges = row.judges;
        if (row.id !== team.id || !Array.isArray(judges) || judges.length !== 3 || judges.some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 200) || typeof row.audience !== "number" || !Number.isFinite(row.audience) || row.audience < 0 || row.audience > 240) {
          throw new Error(`${team.name}: 팀 ID 및 0~200점 심사값 3개, 0~240점 청중값을 확인하세요.`);
        }
        return { ...team, judges: judges as [number, number, number], audience: row.audience as number };
      });
      setTeams(next);
      restart();
      setShowInput(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "점수 JSON 형식이 올바르지 않습니다.");
    }
  };

  return <main className={styles.page}>
    <div className={styles.topLine}><strong>{isDemo ? "LIVE REHEARSAL · FAIR SCORE CEREMONY" : "LIVE · FAIR SCORE CEREMONY"}</strong><span>{isDemo ? "DEMO · 리허설 예시 순위" : "운영 점수 미연동 · 집계 대기 (예시 점수 사용 안 함)"} · 창업 {groups.STARTUP.length}팀 / 기업분석 {groups.BUSINESS_ANALYSIS.length}팀</span></div>
    <header className={styles.header}>
      <div><h1>평가 단계별 집계</h1><p>청중평가 240점 + 전문심사위원 3명 × 200점 = 총 840점 · {isDemo ? "리허설 예시 점수" : "실제 집계 연동 전 · 0점 대기"}</p></div>
      <div className={styles.actions}>
        <button disabled={!isDemo} onClick={() => {setDraft(JSON.stringify(teams.map(t => ({ id:t.id, audience:t.audience, judges:t.judges })), null, 2));setShowInput(true);}}>리허설 점수 입력</button>
        <button disabled={!isDemo} onClick={start}>처음부터 다시 실행</button>
        <button onClick={() => setPlaying((value) => !value)} disabled={!isDemo || step === 3 || finishedScreen}>{playing && step < 3 ? "일시 정지" : "자동 재생"}</button>
        <button onClick={() => { setPlaying(false); setStep((value) => Math.min(3, value + 1)); }} disabled={!isDemo || step === 3 || finishedScreen}>다음 심사 공개</button>
        <button onClick={() => { setPlaying(false); setShowRanks(true); }} disabled={!isDemo || step !== 3 || showRanks || finishedScreen}>1~6위 순위 공개</button>
        <button className={styles.nextScreenButton} onClick={() => {setPlaying(false); setShowMedals(true);}} disabled={!isDemo || step !== 3 || !showRanks || awardTie || finishedScreen}>금·은·동 메달 확대</button>
        <button onClick={() => {setPlaying(false); setFinishedScreen(true);}} disabled={!isDemo || step !== 3 || !showRanks || showMedals || finishedScreen}>집계 종료 · 다음 화면</button>
        {finishedScreen && <button onClick={() => setFinishedScreen(false)}>결과 화면으로 돌아가기</button>}
      </div>
    </header>
    {isDemo && step === 3 && awardTie && <p role="alert" className={styles.tieWarning}>동점 발생: 시상 순위를 확정할 수 없습니다. 운영위원의 공식 동점 처리 규정 확인이 필요합니다.</p>}
    {finishedScreen ? <section className={styles.manualEndScreen} aria-live="polite">
      <small>ALL JUDGING STAGES COMPLETED · REHEARSAL</small>
      <h2>평가 단계별 집계가 완료되었습니다</h2>
      <p>화면 전환은 운영자 수동 제어입니다. 이전 화면으로 돌아가거나 처음부터 다시 실행할 수 있습니다.</p>
      <strong>창업 6개 팀 · 기업분석 6개 팀</strong>
    </section> : <>
    <section className={styles.summary}>
      <div><small>PART 1 · 청중평가단</small><strong>{isDemo ? 240 : 0} <em>/ 240점 상한</em></strong><span className={styles.summaryRail}><i style={{width: isDemo ? "100%" : "0%"}} /></span><p>{isDemo ? "첫 구간 0~240점 · 실제 팀 점수는 마커로 표시" : "청중평가 공식 집계 대기"}</p></div>
      <div><small>PART 2~4 · 전문심사위원단</small><strong>{STEP_LIMITS[step]} <em>/ 840점 단계 상한</em></strong><div className={styles.judgeChips}>{[1,2,3].map(n => <span key={n} className={n <= step ? styles.active : ""}>{n}</span>)}</div><p>{isDemo ? `현재 공개 가능 구간: 0~${STEP_LIMITS[step]}점 · 막대는 실제 누적 점수` : "실제 점수 데이터 연동 대기"}</p></div>
      <div><small>현재 집계 단계</small><strong className={styles.stageText}>{JUDGE_STEPS[step]}</strong><p>{playing && step < 3 ? "단계마다 7초간 표시 후 다음 단계 진행" : step === 3 ? "최종 공개 완료 · 운영자가 다음 화면을 수동으로 전환합니다" : isDemo ? "수동 공개 또는 자동 재생 가능" : "공식 데이터 연결 전까지 화면 공개 차단"}</p></div>
    </section>
    <section className={styles.sectionTitle}><strong>AUDIENCE + PROFESSIONAL JUDGES · 통합 누적 집계</strong><span>하나의 막대 · 청중평가 + 심사 1·2·3번 마커 · 840점 공통 척도</span></section>
    <div className={styles.axis} aria-label="4개 구간: 청중 240점, 심사 1 누적 440점, 심사 2 누적 640점, 심사 3 누적 840점"><div className={styles.axisSpacer} /><div className={styles.axisScale}>{TICKS.map(tick => <span key={tick} style={{left:`${scorePercent(tick)}%`}}>{tick}</span>)}</div><div className={styles.axisSuffix}>누적 점수</div></div>
    <div className={styles.groups}>
      <section><div className={styles.groupTitle}><strong>창업 부문</strong><span>{groups.STARTUP.length}개 팀</span></div>{groups.STARTUP.map((team,index)=><TeamRow key={team.id} team={team} index={index} step={step} rank={showRanks ? ranks.get(team.id) ?? null : null} hasResults={isDemo}/>)}</section>
      <section><div className={styles.groupTitle}><strong>기업분석 부문</strong><span>{groups.BUSINESS_ANALYSIS.length}개 팀</span></div>{groups.BUSINESS_ANALYSIS.map((team,index)=><TeamRow key={team.id} team={team} index={index} step={step} rank={showRanks ? ranks.get(team.id) ?? null : null} hasResults={isDemo}/>)}</section>
    </div>
    <footer className={styles.footer}>팀당 그래프 1개 · 청중(240) → 1번 심사(440) → 2번 심사(640) → 3번 심사(840) · 점수 마커는 팀별 실제 누적값으로 배치. {isDemo ? "리허설 예시 점수 · 최종 심사 후 수동 1~6위 공개" : "운영 점수 연동 전 · 실제 득표와 심사 점수가 검증되기 전까지 순위를 숨깁니다."}</footer>
    </>}
    {isDemo && showRanks && !showMedals && !finishedScreen && <div className={styles.awardLegend}>각 부문 1위 대상 · 2위 최우수상 · 3~4위 우수상 · 5~6위 챌린지상 (시상은 사회자가 진행)</div>}
    {isDemo && showMedals && <div className={styles.medalOverlay} role="dialog" aria-modal="true" aria-label="시상 순위 발표">
      <div className={styles.medalWindow}>
        <small>REHEARSAL · FINAL STANDINGS</small>
        <h2>최종 순위 공개</h2>
        <div className={styles.medalCategories}>
          {(["STARTUP", "BUSINESS_ANALYSIS"] as const).map(category => (
            <section key={category} className={styles.medalCategory}>
              <h3>{category === "STARTUP" ? "창업 부문" : "기업분석 부문"}</h3>
              {finalAwards[category].ranked.map(({ team, rank, award }) => (
                <div key={team.id} className={rank <= 3 ? styles.medalTop : styles.medalOther}>
                  <b className={styles.medalIcon}>{rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}위`}</b>
                  <div><strong>{rank}위 · {team.name}</strong><small>{award} · {scoreAtStep(team, 3)} / 840점</small></div>
                </div>
              ))}
            </section>
          ))}
        </div>
        <p>리허설용 예시 점수입니다. 실제 시상에는 운영 검증을 마친 공식 데이터만 사용하세요.</p>
        <button type="button" onClick={() => setShowMedals(false)}>점수 그래프로 돌아가기</button>
      </div>
    </div>}
    {isDemo && showInput && <div className={styles.overlay}><div className={styles.editor}>
      <h2>리허설 점수 입력</h2><p>JSON 배열을 편집합니다. 팀 순서와 ID는 그대로 유지하고, audience(0~240) 및 judges(각 0~200)를 수정하세요. 실제 운영 DB에는 저장되지 않습니다.</p>
      <textarea aria-label="리허설 점수 JSON" value={draft} onChange={e => setDraft(e.target.value)} spellCheck={false}/>
      <div className={styles.actions}><button onClick={() => setShowInput(false)}>취소</button><button onClick={loadScores}>리허설 점수 적용</button></div>
    </div></div>}
  </main>;
}
