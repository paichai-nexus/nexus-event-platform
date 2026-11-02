"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationAlert } from "@/components/ui/OperationAlert";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { teamDisplayName } from "@/features/event/data/teamSlots";
import type { PaperJudgeScore } from "@/types/paper-judging";
import type { Team } from "@/types/team";

type Draft = { documentScore: number; presentationScore: number; qnaScore: number };
const empty = (): Record<1 | 2 | 3, Draft> => ({ 1: { documentScore: 0, presentationScore: 0, qnaScore: 0 }, 2: { documentScore: 0, presentationScore: 0, qnaScore: 0 }, 3: { documentScore: 0, presentationScore: 0, qnaScore: 0 } });
function draftsFor(teamId: string, records: PaperJudgeScore[]) {
  const next = empty();
  for (const record of records.filter((item) => item.teamId === teamId)) next[record.judgeSlot] = { documentScore: record.documentScore, presentationScore: record.presentationScore, qnaScore: record.qnaScore };
  return next;
}

export function PaperJudgeScoreEntry({ eventId, teams }: { eventId: string; teams: Team[] }) {
  const activeTeams = teams.filter((team) => team.active && team.name).sort((a, b) => a.order - b.order);
  const [teamId, setTeamId] = useState(activeTeams[0]?.id ?? "");
  const [records, setRecords] = useState<PaperJudgeScore[]>([]);
  const [drafts, setDrafts] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/judging/paper?eventId=${encodeURIComponent(eventId)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) { setFeedback(payload.error?.message ?? "종이 심사표 입력값을 불러오지 못했습니다."); return; }
    const nextRecords = payload.data as PaperJudgeScore[];
    setRecords(nextRecords);
    setDrafts(draftsFor(teamId, nextRecords));
  }, [eventId, teamId]);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const selected = teams.find((team) => team.id === teamId) ?? null;
  const selectedRecords = records.filter((record) => record.teamId === teamId);
  const submitted = selectedRecords.filter((record) => record.status === "SUBMITTED").length;
  const totals = useMemo(() => ([1, 2, 3] as const).map((slot) => drafts[slot].documentScore + drafts[slot].presentationScore + drafts[slot].qnaScore), [drafts]);

  const change = (slot: 1 | 2 | 3, field: keyof Draft, value: number, maximum: number) => setDrafts((current) => ({ ...current, [slot]: { ...current[slot], [field]: Math.max(0, Math.min(maximum, Number.isFinite(value) ? value : 0)) } }));

  const save = async (status: "DRAFT" | "SUBMITTED") => {
    if (!teamId || busy) return;
    if (status === "SUBMITTED" && !window.confirm("심사위원 3명의 종이 점수를 제출하고 잠글까요? 제출 후에는 수정할 수 없습니다.")) return;
    setBusy(true); setFeedback("");
    try {
      for (const judgeSlot of [1, 2, 3] as const) {
        const response = await fetch("/api/judging/paper", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, teamId, judgeSlot, ...drafts[judgeSlot], status }) });
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? `심사위원 ${judgeSlot} 점수를 저장하지 못했습니다.`);
      }
      await load();
      setFeedback(status === "SUBMITTED" ? "심사위원 3명의 종이 점수가 제출·잠금 처리되었습니다." : "종이 심사표 점수를 임시 저장했습니다.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "종이 심사표 점수를 저장하지 못했습니다."); }
    finally { setBusy(false); }
  };

  return <section className="admin-card paper-score-panel">
    <PanelHeader label="PAPER SCORE ENTRY" title="종이 심사표 수기 입력" aside={<StatusBadge tone={submitted === 3 ? "success" : submitted ? "warning" : "neutral"}>{submitted} / 3 제출</StatusBadge>} />
    <OperationAlert level="INFO">서류 50점 + 발표 100점 + 질의응답 50점 = 심사위원 1인당 200점입니다. 이 원점수는 공식 환산식 승인 전까지 최종 순위에 자동 반영되지 않습니다.</OperationAlert>
    <label className="admin-field paper-score-panel__team">입력 대상 팀<select value={teamId} onChange={(event) => { setTeamId(event.target.value); setDrafts(draftsFor(event.target.value, records)); }}>{activeTeams.map((team) => <option key={team.id} value={team.id}>{String(team.order).padStart(2, "0")} · {teamDisplayName(team)}</option>)}</select></label>
    {selected && <div className="paper-score-panel__identity"><strong>{teamDisplayName(selected)}</strong><span>{selected.department ?? "학과 미등록"} · {selected.category === "STARTUP" ? "창업 부문" : "기업분석 부문"}</span></div>}
    <div className="paper-score-grid"><header><span>심사위원</span><b>서류 / 50</b><b>발표 / 100</b><b>질의응답 / 50</b><b>합계 / 200</b><b>상태</b></header>{([1, 2, 3] as const).map((slot, index) => {
      const record = selectedRecords.find((item) => item.judgeSlot === slot);
      const locked = record?.status === "SUBMITTED";
      return <div key={slot}><strong>심사위원 {slot}</strong><input aria-label={`심사위원 ${slot} 서류점수`} type="number" min={0} max={50} step={1} disabled={locked || busy} value={drafts[slot].documentScore} onChange={(event) => change(slot, "documentScore", Number(event.target.value), 50)} /><input aria-label={`심사위원 ${slot} 발표점수`} type="number" min={0} max={100} step={1} disabled={locked || busy} value={drafts[slot].presentationScore} onChange={(event) => change(slot, "presentationScore", Number(event.target.value), 100)} /><input aria-label={`심사위원 ${slot} 질의응답점수`} type="number" min={0} max={50} step={1} disabled={locked || busy} value={drafts[slot].qnaScore} onChange={(event) => change(slot, "qnaScore", Number(event.target.value), 50)} /><b>{totals[index]}</b><StatusBadge tone={locked ? "success" : record ? "warning" : "neutral"}>{locked ? "제출 잠금" : record ? "임시저장" : "미입력"}</StatusBadge></div>;
    })}<footer><span>전문심사 원점수 합계</span><strong>{totals.reduce((sum, score) => sum + score, 0)} / 600</strong></footer></div>
    <div className="paper-score-panel__actions"><button className="admin-button" type="button" disabled={busy || submitted > 0} onClick={() => void save("DRAFT")}>임시 저장</button><button className="admin-button admin-button--primary" type="button" disabled={busy || submitted > 0} onClick={() => void save("SUBMITTED")}>{busy ? "저장 중…" : "3명 점수 제출·잠금"}</button></div>
    <p className="participant-feedback" role="status">{feedback}</p>
  </section>;
}
