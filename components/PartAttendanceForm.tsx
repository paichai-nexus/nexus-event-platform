"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AUDIENCE_JURY_DEPARTMENTS, type AudienceJuryDepartment } from "@/types/audience-jury";
import type { EventPart, PartAttendanceSnapshot } from "@/types/part-attendance";

export function PartAttendanceForm({ part }: { part: EventPart }) {
  const [department, setDepartment] = useState<AudienceJuryDepartment>(AUDIENCE_JURY_DEPARTMENTS[0]);
  const [studentNumber, setStudentNumber] = useState("");
  const [name, setName] = useState("");
  const [snapshot, setSnapshot] = useState<PartAttendanceSnapshot | null>(null);
  const [participantCode, setParticipantCode] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const load = () => fetch("/api/part-attendance", { cache: "no-store" }).then((response) => response.json()).then((payload) => payload.ok && setSnapshot(payload.data)).catch(() => undefined);
    void load();
    const timer = window.setInterval(load, 2_000);
    return () => window.clearInterval(timer);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setFeedback("");
    try {
      const response = await fetch("/api/part-attendance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ part, department, studentNumber, name }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "출석을 저장하지 못했습니다.");
      setSnapshot(payload.data.snapshot);
      setParticipantCode(payload.data.record.participantCode);
      setFeedback(payload.data.duplicate ? `${part}부 출석이 이미 완료되어 있습니다.` : `${part}부 출석이 완료되었습니다.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "출석을 저장하지 못했습니다.");
    } finally { setBusy(false); }
  };

  return <main className="participant-page part-attendance-page">
    <header className="participant-header"><Link href="/">← 행사 안내</Link><div><strong>경영대학 학술제</strong><small>PART {part} ATTENDANCE</small></div><span className="status-badge status-badge--info">{part}부</span></header>
    <section className="participant-hero"><span>ATTENDANCE</span><h1>{part}부 출석체크</h1><p>본인의 학과·학번·이름을 정확히 입력해주세요. 같은 학번은 각 부에 한 번만 출석할 수 있습니다.</p><div className="participant-status-row"><span><small>1부 출석</small><strong>{snapshot?.partOneCount ?? 0}명</strong></span><span><small>2부 출석</small><strong>{snapshot?.partTwoCount ?? 0}명</strong></span><span><small>1·2부 모두</small><strong>{snapshot?.bothCount ?? 0}명</strong></span></div></section>
    <section className="participant-content"><section className="jury-registration part-attendance-form"><header><small>LIVE ATTENDANCE</small><h2>{part}부 현장 출석 등록</h2><p>제출 완료 화면이 나올 때까지 페이지를 닫지 마세요.</p></header>{participantCode ? <div className="part-attendance-success"><span>✓</span><strong>{feedback}</strong><p>럭키드로우 식별번호</p><b>{participantCode}</b><em>1부와 2부에 동일한 학번으로 출석하면 추첨 대상에 포함됩니다.</em></div> : <form onSubmit={submit}><label><span>학과</span><select value={department} onChange={(event) => setDepartment(event.target.value as AudienceJuryDepartment)}>{AUDIENCE_JURY_DEPARTMENTS.map((item) => <option key={item}>{item}</option>)}</select></label><label><span>학번</span><input required minLength={5} maxLength={20} autoComplete="off" inputMode="numeric" value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} /></label><label><span>이름</span><input required minLength={2} maxLength={30} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label><button className="admin-button admin-button--primary" disabled={busy}>{busy ? "출석 저장 중…" : `${part}부 출석 완료`}</button></form>} {!participantCode && <p className="participant-feedback" role="status">{feedback}</p>}</section></section>
  </main>;
}
