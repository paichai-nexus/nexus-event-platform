"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { backoffDelay, isAmbiguousMutationFailure, requestJson } from "@/lib/network/resilientFetch";
import type { AudienceBallotState } from "@/types/audience-ballot";
import type { AudienceJuryRegistration } from "@/types/audience-jury";
import type { TeamCategory } from "@/types/team";

type AuthPayload = { data: { authenticated: boolean; registration: AudienceJuryRegistration | null } };
type BallotPayload = { data: AudienceBallotState; storage: "MOCK" };

const categoryLabels: Record<TeamCategory, string> = {
  STARTUP: "창업 부문",
  BUSINESS_ANALYSIS: "기업분석 부문",
};

export default function AudienceBallotPage() {
  const [registration, setRegistration] = useState<AudienceJuryRegistration | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [ballot, setBallot] = useState<AudienceBallotState | null>(null);
  const [firstTeamId, setFirstTeamId] = useState("");
  const [secondTeamId, setSecondTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const submittingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const auth = await requestJson<AuthPayload>("/api/audience-jury/auth", { cache: "no-store" });
      setAuthenticated(auth.data.authenticated);
      setRegistration(auth.data.registration);
      if (!auth.data.authenticated) return true;
      const payload = await requestJson<BallotPayload>("/api/audience-ballot", { cache: "no-store" });
      setBallot(payload.data);
      return true;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "평가 상태를 확인하지 못했습니다.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    let failures = 0;
    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      if (!stopped) timer = window.setTimeout(() => void run(), delay);
    };
    const run = async () => {
      if (document.hidden || !navigator.onLine || submittingRef.current) return;
      const succeeded = await refresh();
      failures = succeeded ? 0 : Math.min(failures + 1, 6);
      schedule(succeeded ? 4_000 : backoffDelay(failures, 1_000, 30_000));
    };
    const resume = () => { if (!document.hidden && navigator.onLine) schedule(200); };
    const pause = () => window.clearTimeout(timer);
    const visibility = () => document.hidden ? pause() : resume();
    window.addEventListener("online", resume);
    window.addEventListener("offline", pause);
    document.addEventListener("visibilitychange", visibility);
    schedule(0);
    return () => {
      stopped = true;
      pause();
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", pause);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [refresh]);

  const openCategory = ballot?.openCategory ?? null;
  const categoryTeams = useMemo(
    () => ballot?.teams.filter((team) => team.category === openCategory).sort((a, b) => a.order - b.order) ?? [],
    [ballot?.teams, openCategory],
  );
  const currentSubmission = ballot?.submissions.find((item) => item.category === openCategory) ?? null;
  const invalidDuplicate = Boolean(firstTeamId && secondTeamId && firstTeamId === secondTeamId);
  const firstIsValid = categoryTeams.some((team) => team.id === firstTeamId);
  const secondIsValid = categoryTeams.some((team) => team.id === secondTeamId);
  const canSubmit = Boolean(openCategory && firstIsValid && secondIsValid && !invalidDuplicate && !currentSubmission && !submitting);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!openCategory || !canSubmit || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setFeedback("");
    try {
      await requestJson("/api/audience-ballot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: openCategory, firstTeamId, secondTeamId }),
      });
      await refresh();
      setFeedback(`${categoryLabels[openCategory]} 평가가 저장되었습니다.`);
    } catch (error) {
      if (isAmbiguousMutationFailure(error)) {
        const payload = await requestJson<BallotPayload>("/api/audience-ballot", { cache: "no-store" }).catch(() => null);
        const recovered = payload?.data.submissions.some((item) => item.category === openCategory
          && item.firstTeamId === firstTeamId && item.secondTeamId === secondTeamId);
        if (payload) setBallot(payload.data);
        setFeedback(recovered ? "서버 상태를 다시 확인해 제출 완료를 복구했습니다." : "제출 결과를 확인하지 못했습니다. 잠시 후 다시 확인해주세요.");
      } else {
        setFeedback(error instanceof Error ? error.message : "평가를 저장하지 못했습니다.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  if (authenticated === false) {
    return <main className="participant-page"><section className="participant-content ballot-auth-required">
      <small>AUTHENTICATION REQUIRED</small><h1>본인 인증이 필요합니다</h1>
      <p>등록한 이름·학번·PCU 참가자 비밀번호로 2차 인증 후 입장해주세요.</p>
      <Link className="admin-button admin-button--primary" href="/vote/auth">본인 인증하기</Link>
    </section></main>;
  }

  const status = ballot?.votingStatus ?? "READY";
  return <main className="participant-page">
    <header className="participant-header">
      <Link href="/">← 행사 안내</Link>
      <div><strong>청중평가 전용 페이지</strong><small>TWO TEAM BALLOT</small></div>
      <StatusBadge tone={openCategory ? "success" : status === "CLOSED" ? "danger" : "warning"}>{openCategory ? "OPEN" : status}</StatusBadge>
    </header>

    <section className="participant-hero">
      <span>AUDIENCE VOTE</span><h1>1위 후보 두 팀 선택</h1>
      <p>각 부문 발표가 끝난 뒤 1위로 예상하는 서로 다른 두 팀을 선택해주세요. 두 선택의 우선순위는 없습니다.</p>
      <div className="participant-status-row">
        <span><small>본인 인증</small><strong>{registration ? `${registration.department} ${registration.position}번` : "확인 중"}</strong></span>
        {(["STARTUP", "BUSINESS_ANALYSIS"] as TeamCategory[]).map((category) => {
          const submitted = ballot?.submissions.some((item) => item.category === category);
          return <span key={category}><small>{categoryLabels[category]}</small><strong>{submitted ? "제출 완료" : openCategory === category ? "평가 진행 중" : "대기"}</strong></span>;
        })}
      </div>
    </section>

    <section className="participant-content">
      <div className="participant-notice"><strong>부문별 1회 제출</strong><p>창업 부문과 기업분석 부문은 각각 별도로 진행됩니다. 제출 후에는 선택을 변경할 수 없습니다.</p></div>

      {loading && !ballot ? <section className="ballot-waiting"><small>SYNCING</small><h2>평가 시간을 확인하고 있습니다</h2><p>잠시만 기다려주세요.</p></section>
        : !openCategory ? <section className="ballot-waiting"><small>WAITING FOR CONTROL SIGNAL</small><h2>청중평가 시작 전입니다</h2><p>해당 부문의 발표가 끝나고 운영진이 평가 시간을 열면 이 화면에 팀 선택 폼이 자동으로 나타납니다.</p><div><span>01 창업 부문 평가</span><span>02 기업분석 부문 평가</span></div></section>
          : currentSubmission ? <section className="ballot-waiting ballot-waiting--complete"><small>SUBMITTED</small><h2>{categoryLabels[openCategory]} 평가 완료</h2><p>선택 내용이 서버에 저장되었습니다. 다른 부문의 평가 시간이 열리면 다음 폼이 자동으로 표시됩니다.</p></section>
            : <form className="rank-ballot" onSubmit={submit}>
              <header><small>NOW OPEN</small><h2>{categoryLabels[openCategory]}</h2><p>1위 후보 두 팀 선택 (중복 불가 · 우선순위 없음)</p></header>
              <label className="rank-choice rank-choice--first"><span><b>A</b><span><small>1위 후보 A</small><strong>우수하다고 생각하는 첫 번째 팀</strong></span></span><select value={firstTeamId} onChange={(event) => setFirstTeamId(event.target.value)} required><option value="">팀을 선택해주세요</option>{categoryTeams.map((team) => <option key={team.id} value={team.id} disabled={team.id === secondTeamId}>{String(team.order).padStart(2, "0")} · {team.name}</option>)}</select></label>
              <label className="rank-choice rank-choice--second"><span><b>B</b><span><small>1위 후보 B</small><strong>우수하다고 생각하는 두 번째 팀</strong></span></span><select value={secondTeamId} onChange={(event) => setSecondTeamId(event.target.value)} required><option value="">팀을 선택해주세요</option>{categoryTeams.map((team) => <option key={team.id} value={team.id} disabled={team.id === firstTeamId}>{String(team.order).padStart(2, "0")} · {team.name}</option>)}</select></label>
              {invalidDuplicate && <p className="rank-ballot__error">서로 다른 두 팀을 선택해야 합니다.</p>}
              <button className="admin-button admin-button--primary" disabled={!canSubmit} type="submit">{submitting ? "서버에 저장 중…" : `${categoryLabels[openCategory]} 평가 제출`}</button>
              <p>제출 버튼을 누르기 전 선택한 팀을 한 번 더 확인해주세요.</p>
            </form>}
      <p className="participant-feedback" role="status">{feedback}</p>
    </section>
  </main>;
}
