"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { PublicEventSnapshot } from "@/features/event/services/eventSnapshotService";
import type { AudienceVoteState } from "@/types/voting";

type VoteStorage = "DATABASE" | "MOCK";

export default function VotePage() {
  const [snapshot, setSnapshot] = useState<PublicEventSnapshot | null>(null);
  const [voteState, setVoteState] = useState<AudienceVoteState | null>(null);
  const [storage, setStorage] = useState<VoteStorage | null>(null);
  const [pending, setPending] = useState(true);
  const [feedback, setFeedback] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [snapshotResponse, voteResponse] = await Promise.all([
        fetch("/api/event/public-snapshot", { cache: "no-store" }),
        fetch("/api/votes", { cache: "no-store" }),
      ]);
      const snapshotPayload = await snapshotResponse.json();
      if (snapshotResponse.ok) setSnapshot(snapshotPayload.data as PublicEventSnapshot);
      const votePayload = await voteResponse.json();
      if (!voteResponse.ok) throw new Error(votePayload.error?.message ?? "투표 상태를 확인하지 못했습니다.");
      setVoteState(votePayload.data as AudienceVoteState);
      setStorage(votePayload.storage as VoteStorage);
      setFeedback("");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "투표 상태를 확인하지 못했습니다.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => void refresh(), 3_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [refresh]);

  const submitVote = async () => {
    setPending(true);
    try {
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "투표를 저장하지 못했습니다.");
      setVoteState(payload.data as AudienceVoteState);
      setStorage(payload.storage as VoteStorage);
      setFeedback("평가가 서버에 저장되었습니다.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "투표를 저장하지 못했습니다.");
    } finally {
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
