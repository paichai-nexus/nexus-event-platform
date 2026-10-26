"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { PublicEventSnapshot } from "@/features/event/services/eventSnapshotService";
import type { JudgeWorkspace, JudgeWorkspaceScore } from "@/types/judging";

export default function JudgePage() {
  const [workspace, setWorkspace] = useState<JudgeWorkspace | null>(null);
  const [snapshot, setSnapshot] = useState<PublicEventSnapshot | null>(null);
  const [scores, setScores] = useState<JudgeWorkspaceScore[]>([]);
  const [storage, setStorage] = useState<"DATABASE" | "MOCK" | null>(null);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [workspaceResponse, snapshotResponse] = await Promise.all([
        fetch("/api/judging?view=workspace", { cache: "no-store" }),
        fetch("/api/event/public-snapshot", { cache: "no-store" }),
      ]);
      const workspacePayload = await workspaceResponse.json();
      if (!workspaceResponse.ok) throw new Error(workspacePayload.error?.message ?? "심사 작업공간을 불러오지 못했습니다.");
      const nextWorkspace = workspacePayload.data as JudgeWorkspace;
      setWorkspace(nextWorkspace);
      setScores(nextWorkspace.criteria.map((criterion) => ({
        criterionId: criterion.id,
        score: nextWorkspace.scores.find((score) => score.criterionId === criterion.id)?.score ?? 0,
      })));
      setStorage(workspacePayload.storage);
      const snapshotPayload = await snapshotResponse.json();
      if (snapshotResponse.ok) setSnapshot(snapshotPayload.data as PublicEventSnapshot);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "심사 작업공간을 불러오지 못했습니다.");
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const total = useMemo(() => scores.reduce((sum, score) => sum + score.score, 0), [scores]);
  const maximum = useMemo(() => workspace?.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0) ?? 0, [workspace]);
  const teamAssigned = Boolean(workspace?.activeTeamId && workspace.assignedTeamIds.includes(workspace.activeTeamId));
  const readOnly = workspace?.status === "SUBMITTED";

  const save = async () => {
    if (!workspace?.activeTeamId) throw new Error("현재 심사 대상이 없습니다.");
    const response = await fetch("/api/judging", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: workspace.eventId, teamId: workspace.activeTeamId, scores }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error?.message ?? "심사 점수를 저장하지 못했습니다.");
    setWorkspace(payload.data as JudgeWorkspace);
    return payload.data as JudgeWorkspace;
  };

  const saveDraft = async () => {
    setPending(true);
    try {
      await save();
      setMessage("심사 점수가 서버에 임시 저장되었습니다.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "심사 점수를 저장하지 못했습니다.");
    } finally {
      setPending(false);
    }
  };

  const finalSubmit = async () => {
    setPending(true);
    try {
      const saved = await save();
      if (!saved.activeTeamId) throw new Error("현재 심사 대상이 없습니다.");
      const response = await fetch("/api/judging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: saved.eventId, teamId: saved.activeTeamId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? "심사 점수를 제출하지 못했습니다.");
      setWorkspace(payload.data as JudgeWorkspace);
      setMessage("심사가 최종 제출되어 잠겼습니다.");
      setConfirm(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "심사 점수를 제출하지 못했습니다.");
    } finally {
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
