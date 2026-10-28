"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { PublicEventSnapshot } from "@/features/event/services/eventSnapshotService";
import { submitVoteResilient } from "@/features/voting/lib/submitVoteResilient";
import { backoffDelay, requestJson } from "@/lib/network/resilientFetch";
import type { AudienceVoteState } from "@/types/voting";

type VoteStorage = "DATABASE" | "MOCK";
type SnapshotPayload = { data: PublicEventSnapshot };
type VotePayload = { data: AudienceVoteState; storage: VoteStorage };

export default function VotePage() {
  const [snapshot, setSnapshot] = useState<PublicEventSnapshot | null>(null);
  const [voteState, setVoteState] = useState<AudienceVoteState | null>(null);
  const [storage, setStorage] = useState<VoteStorage | null>(null);
  const [pending, setPending] = useState(true);
  const [feedback, setFeedback] = useState("");
  const submittingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const [snapshotPayload, votePayload] = await Promise.all([
        requestJson<SnapshotPayload>("/api/event/public-snapshot", { cache: "no-store" }),
        requestJson<VotePayload>("/api/votes", { cache: "no-store" }),
      ]);
      setSnapshot(snapshotPayload.data);
      setVoteState(votePayload.data);
      setStorage(votePayload.storage);
      return true;
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "투표 상태를 확인하지 못했습니다.");
      return false;
    } finally {
      setPending(false);
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

  const submitVote = async () => {
    if (submittingRef.current || !snapshot?.activeTeam?.id) return;
    submittingRef.current = true;
    setPending(true);
    try {
      const result = await submitVoteResilient(snapshot.activeTeam.id, {
        submit: () => requestJson<VotePayload>("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
        readState: () => requestJson<VotePayload>("/api/votes", { cache: "no-store" }),
      });
      setVoteState(result.data);
      setStorage(result.storage);
      setFeedback(result.recovered ? "서버 상태를 다시 확인해 제출 완료를 복구했습니다." : "평가가 서버에 저장되었습니다.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "투표를 저장하지 못했습니다.");
    } finally {
      submittingRef.current = false;
      setPending(false);
    }
  };

  const votingStatus = voteState?.votingStatus ?? snapshot?.event.votingStatus ?? "READY";
  const currentTeam = snapshot?.activeTeam ?? null;
  const submitted = Boolean(voteState?.submissionId && voteState.teamId === currentTeam?.id);
  const canSubmit = Boolean(currentTeam && voteState?.eligible && votingStatus === "OPEN" && !submitted && !pending);

  return (
    <main className="participant-page">
      <header className="participant-header">
        <Link href="/">← 행사 안내</Link>
        <div><strong>경영대학 학술제</strong><small>AUDIENCE VOTE</small></div>
        <StatusBadge tone={votingStatus === "OPEN" ? "success" : "danger"}>{votingStatus}</StatusBadge>
      </header>
      <section className="participant-hero">
        <span>AUDIENCE VOTE</span>
        <h1>청중평가</h1>
        <p>현장 체크인을 완료한 참가자만 현재 발표팀을 평가할 수 있습니다.</p>
        <div className="participant-status-row">
          <span><small>현재 상태</small><strong>{votingStatus}</strong></span>
          <span><small>현재 발표</small><strong>{currentTeam?.name ?? "대기"}</strong></span>
          <span><small>제출 상태</small><strong>{submitted ? "완료" : "미제출"}</strong></span>
        </div>
      </section>
      <section className="participant-content">
        <div className="participant-notice">
          <strong>{storage === "DATABASE" ? "SERVER STORAGE" : storage === "MOCK" ? "SERVER MOCK" : "CONNECTING"}</strong>
          <p>{storage === "DATABASE" ? "제출 결과는 서버 DB에 영구 저장됩니다." : "Mock과 운영 DB는 분리되어 있습니다."}</p>
        </div>
        <article className={currentTeam ? "is-current" : ""}>
          <div>
            <span>{currentTeam ? String(currentTeam.order).padStart(2, "0") : "--"}</span>
            <div>
              <strong>{currentTeam?.name ?? "다음 발표를 기다려주세요."}</strong>
              <small>{currentTeam ? (currentTeam.category === "STARTUP" ? "창업 부문 · 현재 발표 중" : "기업분석 부문 · 현재 발표 중") : "발표팀이 활성화되면 평가할 수 있습니다."}</small>
            </div>
          </div>
          <button className={`admin-button ${submitted ? "admin-button--success" : "admin-button--primary"}`} type="button" disabled={!canSubmit} onClick={submitVote}>
            {pending ? "확인 중" : submitted ? "SUBMITTED" : voteState?.eligible ? "평가 제출" : "체크인 필요"}
          </button>
        </article>
        {!voteState?.eligible && <Link href="/check-in" className="admin-button admin-button--ghost">현장 체크인 확인</Link>}
        <p className="participant-feedback" role="status">{feedback}</p>
      </section>
    </main>
  );
}
