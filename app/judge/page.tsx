"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { PublicEventSnapshot } from "@/features/event/services/eventSnapshotService";
import { saveJudgeDraftResilient, submitJudgeResilient } from "@/features/judging/lib/submissionResilience";
import { requestJson } from "@/lib/network/resilientFetch";
import type { JudgeWorkspace, JudgeWorkspaceScore } from "@/types/judging";

type WorkspacePayload = { data: JudgeWorkspace; storage: "DATABASE" | "MOCK" };
type SnapshotPayload = { data: PublicEventSnapshot };
type JudgeMutationPayload = { data: JudgeWorkspace };

export default function JudgePage() {
  const [workspace, setWorkspace] = useState<JudgeWorkspace | null>(null);
  const [snapshot, setSnapshot] = useState<PublicEventSnapshot | null>(null);
  const [scores, setScores] = useState<JudgeWorkspaceScore[]>([]);
  const [storage, setStorage] = useState<"DATABASE" | "MOCK" | null>(null);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(true);
  const mutationRef = useRef(false);

  const readWorkspace = useCallback(async () => {
    const payload = await requestJson<WorkspacePayload>("/api/judging?view=workspace", { cache: "no-store" });
    setStorage(payload.storage);
    return payload.data;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [nextWorkspace, snapshotPayload] = await Promise.all([
        readWorkspace(),
        requestJson<SnapshotPayload>("/api/event/public-snapshot", { cache: "no-store" }),
      ]);
      setWorkspace(nextWorkspace);
      setScores(nextWorkspace.criteria.map((criterion) => ({
        criterionId: criterion.id,
        score: nextWorkspace.scores.find((score) => score.criterionId === criterion.id)?.score ?? 0,
      })));
      setSnapshot(snapshotPayload.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "심사 작업공간을 불러오지 못했습니다.");
    } finally {
      setPending(false);
    }
  }, [readWorkspace]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const total = useMemo(() => scores.reduce((sum, score) => sum + score.score, 0), [scores]);
  const maximum = useMemo(() => workspace?.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0) ?? 0, [workspace]);
  const teamAssigned = Boolean(workspace?.activeTeamId && workspace.assignedTeamIds.includes(workspace.activeTeamId));
  const readOnly = workspace?.status === "SUBMITTED";

  const save = async (eventId: string, teamId: string) => {
    const payload = await requestJson<JudgeMutationPayload>("/api/judging", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, teamId, scores }),
    });
    return payload.data;
  };

  const saveDraft = async () => {
    if (mutationRef.current || !workspace?.activeTeamId) return;
    mutationRef.current = true;
    setPending(true);
    try {
      const result = await saveJudgeDraftResilient(workspace.activeTeamId, scores, {
        readWorkspace,
        saveDraft: () => save(workspace.eventId, workspace.activeTeamId as string),
      });
      setWorkspace(result.workspace);
      setMessage(result.recovered ? "서버 상태를 다시 확인해 임시 저장 완료를 복구했습니다." : "심사 점수가 서버에 임시 저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "심사 점수를 저장하지 못했습니다.");
    } finally {
      mutationRef.current = false;
      setPending(false);
    }
  };

  const finalSubmit = async () => {
    if (mutationRef.current || !workspace?.activeTeamId) return;
    mutationRef.current = true;
    setPending(true);
    try {
      const teamId = workspace.activeTeamId;
      const eventId = workspace.eventId;
      const result = await submitJudgeResilient(teamId, scores, {
        readWorkspace,
        saveDraft: () => save(eventId, teamId),
        submit: async () => {
          const payload = await requestJson<JudgeMutationPayload>("/api/judging", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId, teamId }),
          });
          return payload.data;
        },
      });
      setWorkspace(result.workspace);
      setMessage(result.recovered ? "서버 상태를 다시 확인해 최종 제출 완료를 복구했습니다." : "심사가 최종 제출되어 잠겼습니다.");
      setConfirm(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "심사 점수를 제출하지 못했습니다.");
    } finally {
      mutationRef.current = false;
      setPending(false);
    }
  };

  return (
    <main className="participant-page participant-page--judge">
      <header className="participant-header">
        <Link href="/">← 행사 안내</Link>
        <div><strong>심사위원 평가</strong><small>JUDGING CONSOLE</small></div>
        <StatusBadge tone={readOnly ? "success" : storage === "DATABASE" ? "blue" : "warning"}>{readOnly ? "SUBMITTED" : storage ?? "CONNECTING"}</StatusBadge>
      </header>
      <section className="participant-hero">
        <span>CURRENT TEAM · {snapshot?.activeTeam ? String(snapshot.activeTeam.order).padStart(2, "0") : "--"}</span>
        <h1>{snapshot?.activeTeam?.name ?? "심사 대상 대기"}</h1>
        <p>{teamAssigned ? "배정된 현재 발표팀의 평가항목을 저장합니다." : "현재 발표팀에 대한 심사 배정을 확인해주세요."}</p>
      </section>
      <section className="participant-content">
        {workspace?.criteria.length ? (
          <div className="judge-form">{workspace.criteria.map((criterion) => {
            const score = scores.find((item) => item.criterionId === criterion.id)?.score ?? 0;
            return <label key={criterion.id}><span><small>CRITERION {criterion.order + 1}</small><strong>{criterion.name}</strong></span><input type="number" min={0} max={criterion.maxScore} value={score} disabled={readOnly || pending} onChange={(event) => setScores((current) => current.map((item) => item.criterionId === criterion.id ? { ...item, score: Math.max(0, Math.min(criterion.maxScore, Number(event.target.value))) } : item))} /><b>/ {criterion.maxScore}</b></label>;
          })}</div>
        ) : <p className="participant-feedback">확정된 심사 기준이 없습니다. 관리자 기준 설정이 필요합니다.</p>}
        <div className="judge-total"><span>TOTAL</span><strong>{total} <small>/ {maximum}</small></strong></div>
        <div className="judge-actions">
          <button className="admin-button admin-button--ghost" type="button" disabled={!teamAssigned || readOnly || pending || !workspace?.criteria.length} onClick={saveDraft}>Save Draft</button>
          <button className="admin-button admin-button--primary" type="button" disabled={!teamAssigned || readOnly || pending || !workspace?.criteria.length} onClick={() => setConfirm(true)}>Final Submit</button>
        </div>
        <p className="participant-feedback" role="status">{message}</p>
      </section>
      <ConfirmModal open={confirm} title="심사를 최종 제출할까요?" description="제출 후에는 관리자 Unlock 전까지 수정할 수 없습니다. 기존 점수와 수정 이력은 보존됩니다." confirmLabel="최종 제출" onCancel={() => setConfirm(false)} onConfirm={finalSubmit} />
    </main>
  );
}
