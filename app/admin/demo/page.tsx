"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";

const DEMO_TEAMS = [
  { id: "TEAM-01", name: "EVER OASIS", department: "항공서비스학과", category: "STARTUP", target: 28 },
  { id: "TEAM-02", name: "밋턴", department: "경영학과", category: "STARTUP", target: 26 },
  { id: "TEAM-03", name: "시너지", department: "IT경영정보학과", category: "BUSINESS_ANALYSIS", target: 24 },
  { id: "TEAM-04", name: "밸류루트", department: "경영학과", category: "STARTUP", target: 22 },
  { id: "TEAM-05", name: "TEAM:HOTEL", department: "호텔항공경영학과", category: "STARTUP", target: 20 },
  { id: "TEAM-06", name: "관광ON", department: "관광경영학과", category: "STARTUP", target: 18 },
  { id: "TEAM-07", name: "가치로", department: "글로벌비즈니스학과", category: "BUSINESS_ANALYSIS", target: 16 },
  { id: "TEAM-08", name: "TOUCHPOINT", department: "항공서비스학과", category: "BUSINESS_ANALYSIS", target: 16 },
  { id: "TEAM-09", name: "타겟", department: "IT경영정보학과", category: "STARTUP", target: 14 },
  { id: "TEAM-10", name: "어프로치", department: "호텔항공경영학과", category: "BUSINESS_ANALYSIS", target: 12 },
  { id: "TEAM-11", name: "분석할계룡", department: "경영학과", category: "BUSINESS_ANALYSIS", target: 10 },
  { id: "TEAM-12", name: "김성근", department: "글로벌비즈니스학과", category: "STARTUP", target: 10 },
  { id: "TEAM-13", name: "이면", department: "IT경영정보학과", category: "BUSINESS_ANALYSIS", target: 8 },
  { id: "TEAM-14", name: "이어봄", department: "경영학과", category: "STARTUP", target: 8 },
  { id: "TEAM-15", name: "조선제일주", department: "경영학과", category: "BUSINESS_ANALYSIS", target: 8 },
] as const;

const VOTE_SEQUENCE = Array.from({ length: Math.max(...DEMO_TEAMS.map((team) => team.target)) }, (_, round) =>
  DEMO_TEAMS.flatMap((team, teamIndex) => round < team.target ? [teamIndex] : []),
).flat();

const DEFAULT_JUDGE_SCORES = [
  [174, 180, 177], [185, 182, 179], [168, 172, 170], [176, 173, 178], [171, 169, 175],
  [166, 171, 168], [181, 176, 179], [173, 175, 172], [165, 168, 170], [178, 174, 176],
  [169, 167, 171], [175, 177, 173], [164, 166, 168], [172, 170, 174], [167, 169, 165],
];

const DEPARTMENT_COLORS: Record<string, string> = {
  "경영학과": "#ff304f",
  "IT경영정보학과": "#168cff",
  "호텔항공경영학과": "#ffd43b",
  "관광경영학과": "#35d06f",
  "항공서비스학과": "#a56eff",
  "글로벌비즈니스학과": "#ff8a34",
};

const DEPARTMENTS = Object.keys(DEPARTMENT_COLORS);

type DemoPhase = "ENTRY" | "COUNTDOWN" | "AUDIENCE" | "AUDIENCE_LOCKED" | "JUDGES" | "COMPLETE";

export default function RapidDemoCountdownPage() {
  const [runId, setRunId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [phase, setPhase] = useState<DemoPhase>("ENTRY");
  const [entryOpen, setEntryOpen] = useState(true);
  const [entryError, setEntryError] = useState("");
  const [judgeScores, setJudgeScores] = useState<number[][]>(() => DEFAULT_JUDGE_SCORES.map((scores) => [...scores]));
  const [submitted, setSubmitted] = useState(0);
  const [judgeCompleted, setJudgeCompleted] = useState(0);
  const [votes, setVotes] = useState<number[]>(() => DEMO_TEAMS.map(() => 0));
  const [cheerDepartmentIndex, setCheerDepartmentIndex] = useState(0);

  useEffect(() => {
    if (runId === null) return;
    const cleanup: number[] = [];
    cleanup.push(window.setTimeout(() => setCountdown(2), 1_000));
    cleanup.push(window.setTimeout(() => setCountdown(1), 2_000));
    cleanup.push(window.setTimeout(() => {
      setPhase("AUDIENCE");
      let cursor = 0;
      const raceTimer = window.setInterval(() => {
        const teamIndex = VOTE_SEQUENCE[cursor];
        setVotes((current) => current.map((value, index) => index === teamIndex ? value + 1 : value));
        cursor += 1;
        setSubmitted(cursor);
        setCheerDepartmentIndex(Math.min(DEPARTMENTS.length - 1, Math.floor((cursor - 1) / 40)));
        if (cursor === VOTE_SEQUENCE.length) {
          window.clearInterval(raceTimer);
          setPhase("AUDIENCE_LOCKED");
          cleanup.push(window.setTimeout(() => {
            setPhase("JUDGES");
            cleanup.push(window.setTimeout(() => setJudgeCompleted(1), 1_600));
            cleanup.push(window.setTimeout(() => setJudgeCompleted(2), 4_300));
            cleanup.push(window.setTimeout(() => setJudgeCompleted(3), 7_000));
            cleanup.push(window.setTimeout(() => setPhase("COMPLETE"), 8_500));
          }, 5_000));
        }
      }, 175);
      cleanup.push(raceTimer);
    }, 3_000));
    return () => cleanup.forEach((timer) => window.clearTimeout(timer));
  }, [runId]);

  const ranking = useMemo(() => DEMO_TEAMS
    .map((team, index) => ({ ...team, votes: votes[index], judgeScores: judgeScores[index], originalIndex: index }))
    .sort((a, b) => b.votes - a.votes || a.originalIndex - b.originalIndex), [judgeScores, votes]);

  const replay = () => {
    setCountdown(3);
    setPhase("COUNTDOWN");
    setSubmitted(0);
    setJudgeCompleted(0);
    setVotes(DEMO_TEAMS.map(() => 0));
    setCheerDepartmentIndex(0);
    setRunId((current) => (current ?? 0) + 1);
  };

  const updateJudgeScore = (teamIndex: number, judgeIndex: number, value: string) => {
    const parsed = Number(value);
    setJudgeScores((current) => current.map((scores, rowIndex) => rowIndex === teamIndex
      ? scores.map((score, columnIndex) => columnIndex === judgeIndex ? parsed : score)
      : scores));
  };

  const startAggregation = () => {
    const valid = judgeScores.every((scores) => scores.length === 3 && scores.every((score) => Number.isInteger(score) && score >= 0 && score <= 200));
    if (!valid) {
      setEntryError("모든 심사위원 점수를 0~200 사이의 정수로 입력해주세요.");
      return;
    }
    setEntryError("");
    setEntryOpen(false);
    replay();
  };

  return (
    <main className="race-demo" aria-live="polite">
      <header className="race-demo__header">
        <div><small>LIVE REHEARSAL · FAIR SCORE CEREMONY</small><h1>평가 단계별 집계</h1><p>청중평가단 120명·240점 봉인 후 전문심사위원단 3명·600점 별도 공개</p></div>
        <div className="race-demo__header-actions"><button type="button" onClick={() => setEntryOpen(true)}>전문심사 점수 입력</button><button type="button" onClick={replay}>처음부터 다시 실행</button></div>
      </header>

      <section className="race-demo__summary">
        <div className={submitted === 240 ? "is-locked" : ""}><small>STEP 1 · 청중평가단</small><strong>{submitted}<em>/ 240점</em></strong><span className="race-demo__summary-track"><i style={{ width: `${submitted / 2.4}%` }} /></span><span>{submitted === 240 ? "120명 집계 종료 · 데이터 봉인" : `${Math.floor(submitted / 2)} / 120명 평가 반영`}</span></div>
        <div className={judgeCompleted === 3 ? "is-locked" : ""}><small>STEP 2 · 전문심사위원단</small><strong>{judgeCompleted}<em>/ 3명 · 600점 만점</em></strong><span className="race-demo__judge-dots">{[1, 2, 3].map((judge) => <i key={judge} className={judge <= judgeCompleted ? "is-complete" : ""}>{judge}</i>)}</span><span>{phase === "AUDIENCE" || phase === "COUNTDOWN" ? "청중평가 종료 전 비공개" : `${judgeCompleted * 200} / 600점 범위 반영`}</span></div>
        <div><small>현재 집계 단계</small><strong className="race-demo__phase">{phase === "ENTRY" ? "전문심사 점수 입력" : phase === "COUNTDOWN" ? "시작 대기" : phase === "AUDIENCE" ? "청중평가 집계 중" : phase === "AUDIENCE_LOCKED" ? "청중평가 봉인 완료" : phase === "JUDGES" ? "전문심사 집계 중" : "전체 집계 완료"}</strong><span>{phase === "COMPLETE" ? "두 평가 원점수의 독립 집계 완료" : "단계 간 점수 혼합 없이 분리 집계"}</span></div>
      </section>

      <div className={`race-demo__modebar race-demo__modebar--${phase === "JUDGES" || phase === "COMPLETE" ? "judges" : "audience"}`}><div><small>{phase === "JUDGES" || phase === "COMPLETE" ? "PROFESSIONAL JUDGES" : "AUDIENCE PANEL"}</small><strong>{phase === "JUDGES" || phase === "COMPLETE" ? "전문심사위원단 점수 공개" : "청중평가단 점수 집계"}</strong></div><span>{phase === "JUDGES" || phase === "COMPLETE" ? "심사위원별 200점 · 총 600점" : "120명 × 2점 · 총 240점"}</span></div>

      <section className={`race-demo__board ${phase === "JUDGES" || phase === "COMPLETE" ? "is-judges" : "is-audience"}`} aria-label="부문별 실시간 평가 집계">
        {(["STARTUP", "BUSINESS_ANALYSIS"] as const).map((category) => {
          const categoryTeams = ranking.filter((team) => team.category === category);
          return <div className={`race-demo__division race-demo__division--${category.toLowerCase()}`} key={category}>
            <header><strong>{category === "STARTUP" ? "창업 부문" : "기업분석 부문"}</strong><span>{categoryTeams.length}개 팀</span></header>
            {categoryTeams.map((team, rank) => {
              const visibleJudgeTotal = team.judgeScores.slice(0, judgeCompleted).reduce((sum, score) => sum + score, 0);
              const showingJudges = phase === "JUDGES" || phase === "COMPLETE";
              const progress = showingJudges
                ? (judgeCompleted === 0 ? 0 : Math.min(100, (visibleJudgeTotal / (judgeCompleted * 200)) * 100))
                : Math.min(100, (team.votes / 28) * 100);
              const departmentStyle = { "--department-color": DEPARTMENT_COLORS[team.department] } as CSSProperties;
              return <article key={team.id} style={departmentStyle} className={rank < 3 && team.votes > 0 ? `is-leading is-rank-${rank + 1}` : ""}>
                <b>{String(rank + 1).padStart(2, "0")}</b>
                <div className="race-demo__team"><small>{team.id} · {team.department}</small><strong>{team.name}</strong></div>
                <div className="race-demo__track"><i style={{ width: `${progress}%` }}><span>◆</span></i></div>
                <div className="race-demo__metrics">{showingJudges ? <><strong>{visibleJudgeTotal}<small>점</small></strong><span>{judgeCompleted}<small>/3명</small></span></> : <><strong>{team.votes}<small>점</small></strong><span>전문 비공개</span></>}</div>
              </article>;
            })}
          </div>;
        })}
      </section>

      <footer className="race-demo__footer"><div><small>현장 응원 웨이브 · 평가 점수 미반영</small><div className="race-demo__department-legend">{Object.entries(DEPARTMENT_COLORS).map(([department, color], index) => <span className={phase === "AUDIENCE" && cheerDepartmentIndex === index ? "is-active" : ""} key={department} style={{ "--department-color": color } as CSSProperties}><i />{department}</span>)}</div></div><p>DEMO DATA · 공식 순위 아님 · 결과 확정 비활성화</p></footer>

      {phase === "COUNTDOWN" && <div className="race-demo__countdown"><small>REAL-TIME AGGREGATION STARTS IN</small><strong key={countdown}>{countdown}</strong><p>청중평가단 120명 × 2점 집계를 시작합니다</p></div>}
      {phase === "AUDIENCE" && <div className="race-demo__cheer-callout" style={{ "--department-color": DEPARTMENT_COLORS[DEPARTMENTS[cheerDepartmentIndex]] } as CSSProperties} role="status"><small>현장 응원 웨이브 · 점수 미반영</small><strong>{DEPARTMENTS[cheerDepartmentIndex]} 파이팅!</strong></div>}
      {phase === "AUDIENCE_LOCKED" && <div className="race-demo__handoff" role="status"><small>STEP 1 COMPLETE · SEALED</small><strong>청중평가 집계 종료</strong><div><b>120명</b><span>참여 확인</span><b>240점</b><span>원점수 봉인</span></div><p>청중평가 데이터가 종료되었습니다.<br />이제 전문심사위원단 점수를 별도로 집계합니다.</p><i><span /></i></div>}
      {entryOpen && <div className="manual-score-entry" role="dialog" aria-modal="true" aria-label="전문심사위원단 점수 수기 입력">
        <section>
          <header><div><small>PROFESSIONAL JUDGES SCORE ENTRY</small><h2>전문심사위원단 점수 수기 입력</h2><p>서류 50점 + 발표 100점 + 문답 50점으로 계산된 심사위원별 최종 합계 200점을 옮겨 적습니다.</p></div><button type="button" onClick={() => phase === "ENTRY" ? undefined : setEntryOpen(false)} disabled={phase === "ENTRY"}>닫기</button></header>
          <div className="manual-score-entry__head"><span>팀</span><b>심사위원 1</b><b>심사위원 2</b><b>심사위원 3</b><b>합계</b></div>
          <div className="manual-score-entry__rows">{DEMO_TEAMS.map((team, teamIndex) => <label key={team.id}><span><small>{team.id} · {team.department}</small><strong>{team.name}</strong></span>{[0, 1, 2].map((judgeIndex) => <input key={judgeIndex} type="number" min="0" max="200" step="1" aria-label={`${team.name} 전문심사위원 ${judgeIndex + 1} 점수`} value={judgeScores[teamIndex][judgeIndex]} onChange={(event) => updateJudgeScore(teamIndex, judgeIndex, event.target.value)} />)}<b>{judgeScores[teamIndex].reduce((sum, score) => sum + (Number.isFinite(score) ? score : 0), 0)} / 600</b></label>)}</div>
          <footer><div><strong>공식 정책 잠금</strong><span>청중점수 환산식과 70:30·80:20 정책은 승인 전이므로 여기서는 원점수만 집계합니다.</span>{entryError && <em>{entryError}</em>}</div><button type="button" onClick={startAggregation}>입력 완료 · 집계 시작</button></footer>
        </section>
      </div>}
    </main>
  );
}
