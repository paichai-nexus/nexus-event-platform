"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { PublicEventSnapshot } from "@/features/event/services/eventSnapshotService";
import { backoffDelay, requestJson } from "@/lib/network/resilientFetch";
import { AUDIENCE_JURY_DEPARTMENTS, type AudienceJuryDepartment, type AudienceJuryState } from "@/types/audience-jury";

type VoteStorage = "DATABASE" | "MOCK";
type SnapshotPayload = { data: PublicEventSnapshot };
type JuryPayload = { data: AudienceJuryState; storage: VoteStorage };

export default function VotePage() {
  const [snapshot, setSnapshot] = useState<PublicEventSnapshot | null>(null);
  const [juryState, setJuryState] = useState<AudienceJuryState | null>(null);
  const [storage, setStorage] = useState<VoteStorage | null>(null);
  const [pending, setPending] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [department, setDepartment] = useState<AudienceJuryDepartment>("경영학과");
  const [studentNumber, setStudentNumber] = useState("");
  const [name, setName] = useState("");
  const submittingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const juryPayload = await requestJson<JuryPayload>("/api/audience-jury", { cache: "no-store" });
      const snapshotPayload = await requestJson<SnapshotPayload>("/api/event/public-snapshot", { cache: "no-store" });
      setJuryState(juryPayload.data);
      setSnapshot(snapshotPayload.data);
      setStorage(juryPayload.storage);
      return true;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "투표 상태를 확인하지 못했습니다.");
      return false;
    } finally {
      setPending(false);
    }
  }, []);

  const registerJury = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPending(true);
    setFeedback("");
    try {
      const payload = await requestJson<JuryPayload>("/api/audience-jury", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department, studentNumber, name }),
      });
      setJuryState(payload.data);
      setStorage(payload.storage);
      setFeedback(`${department} 청중평가단 ${payload.data.registration?.position}번으로 등록되었습니다. PCU 참가자 비밀번호를 보관해주세요.`);
      await refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "청중평가단 등록을 완료하지 못했습니다.");
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    let failures = 0;

    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      if (!stopped) timer = window.setTimeout(() => void run(), delay);
    };
    const run = async () => {
      if (document.hidden || !navigator.onLine) return;
      const succeeded = await refresh();
      failures = succeeded ? 0 : Math.min(failures + 1, 6);
      schedule(succeeded ? 5_000 + Math.round(Math.random() * 1_000) : backoffDelay(failures, 1_000, 30_000));
    };
    const resume = () => {
      if (!document.hidden && navigator.onLine) schedule(Math.round(Math.random() * 300));
    };
    const pause = () => window.clearTimeout(timer);
    const onVisibilityChange = () => document.hidden ? pause() : resume();

    window.addEventListener("online", resume);
    window.addEventListener("offline", pause);
    document.addEventListener("visibilitychange", onVisibilityChange);
    schedule(0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", pause);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  const currentTeam = snapshot?.activeTeam ?? null;
  const registered = juryState?.registration ?? null;

  return (
    <main className="participant-page">
      <header className="participant-header">
        <Link href="/">← 행사 안내</Link>
        <div><strong>경영대학 학술제</strong><small>AUDIENCE VOTE</small></div>
        <span className="status-badge status-badge--info">REGISTRATION</span>
      </header>
      <section className="participant-hero">
        <span>AUDIENCE VOTE</span>
        <h1>청중평가</h1>
        <p>학과별 선착순 20명, 총 120명의 청중평가단만 현재 발표팀을 평가할 수 있습니다.</p>
        <div className="participant-status-row">
          <span><small>등록 상태</small><strong>{registered ? "청중평가단 승인" : "등록 필요"}</strong></span>
          <span><small>전체 선발</small><strong>{juryState?.totalAccepted ?? 0} / 120명</strong></span>
          <span><small>현재 발표</small><strong>{currentTeam?.name ?? "대기"}</strong></span>
        </div>
      </section>
      <section className="participant-content">
        <div className="participant-notice">
          <strong>{storage === "DATABASE" ? "SERVER STORAGE" : storage === "MOCK" ? "SERVER MOCK" : "CONNECTING"}</strong>
          <p>{storage === "DATABASE" ? "제출 결과는 서버 DB에 영구 저장됩니다." : "Mock과 운영 DB는 분리되어 있습니다."}</p>
        </div>
        {!registered ? <section className="jury-registration">
          <header><small>FIRST-COME AUDIENCE JURY</small><h2>청중평가단 선착순 등록</h2><p>학과별 20명이 마감되면 추가 등록할 수 없습니다. 본인의 정보만 정확히 입력해주세요.</p></header>
          <div className="jury-capacity-grid">{juryState?.departments.map((item) => <div className={item.remaining === 0 ? "is-full" : ""} key={item.department}><span>{item.department}<small>{item.pcuStart}–{item.pcuEnd}</small></span><strong>{item.accepted}<small>/20명</small></strong><i><b style={{ width: `${item.accepted * 5}%` }} /></i></div>)}</div>
          <form onSubmit={registerJury}>
            <label><span>학과</span><select value={department} onChange={(event) => setDepartment(event.target.value as AudienceJuryDepartment)}>{AUDIENCE_JURY_DEPARTMENTS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label><span>학번</span><input autoComplete="off" inputMode="numeric" maxLength={20} placeholder="학번 입력" value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} /></label>
            <label><span>이름</span><input autoComplete="name" maxLength={30} placeholder="이름 입력" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <button className="admin-button admin-button--primary" type="submit" disabled={pending || !studentNumber.trim() || !name.trim()}>{pending ? "정원 확인 중" : "청중평가단 등록"}</button>
          </form>
          <p className="jury-privacy-note">입력 정보는 본인 확인과 중복 신청 방지에만 사용되며 공개 집계 화면에는 표시되지 않습니다.</p>
        </section> : <section className="jury-accepted"><small>REGISTRATION ACCEPTED</small><strong>{registered.department} {registered.position}번째 청중평가단</strong><span>{registered.name} · 학번 {registered.studentNumber.slice(-4).padStart(registered.studentNumber.length, "•")}</span><div className="jury-serial"><small>PCU 참가자 비밀번호 · 럭키드로우 번호</small><b>{registered.serialNumber}</b><em>2차 인증과 현장 럭키드로우에 사용됩니다. 화면을 캡처하거나 안전하게 기록해주세요.</em></div><p>이름·학번·PCU 코드가 모두 일치해야 별도의 평가 페이지로 이동할 수 있습니다.</p><Link className="admin-button admin-button--primary" href="/vote/auth">2차 인증 후 평가 페이지 입장</Link></section>}
        <p className="participant-feedback" role="status">{feedback}</p>
      </section>
    </main>
  );
}
