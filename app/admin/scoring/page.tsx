"use client";

import { SectionLabel } from "@/components/ui/SectionLabel";
import { LiveScoringBoard } from "@/components/LiveScoringBoard";
import { useEventOps } from "@/features/event/context/EventOpsProvider";

export default function ScoringPage() {
  const { state } = useEventOps();

  return (
    <div className="admin-page">
      <SectionLabel
        label="JUDGE SCORING"
        title="심사위원 점수 집계"
        description="전문가 심사 100% · 총 600점"
      />
      <LiveScoringBoard eventId={state.eventId} />
    </div>
  );
}
