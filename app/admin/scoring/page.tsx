"use client";

import { DemoScoringSimulation } from "@/components/DemoScoringSimulation";
import { ScoringDiagnosticsPanel } from "@/components/ScoringDiagnosticsPanel";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useEventOps } from "@/features/event/context/EventOpsProvider";

export default function ScoringPage() {
  const { state } = useEventOps();
  return <div className="admin-page">
    <SectionLabel label="LIVE SCORING" title="합산 점수 디스플레이" description="청중평가 선택 수와 전문심사 수기 입력값을 실시간으로 확인합니다" />
    {state.runtimeMode === "mock" ? <DemoScoringSimulation /> : <ScoringDiagnosticsPanel eventId={state.eventId} />}
  </div>;
}
