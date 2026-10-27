"use client";

import { SectionLabel } from "@/components/ui/SectionLabel";
import { EmptyState, ErrorState, LoadingState, OfflineState } from "@/components/ui/States";
import { useEventOps } from "@/features/event/context/EventOpsProvider";

const scenarios = [
  ["Loading", "데이터 로딩 상태"], ["Empty", "결과 없음 상태"], ["Offline", "네트워크 연결 끊김"],
  ["Error", "처리 오류 안내"], ["Duplicate Check-In", "중복 입장 차단"], ["Duplicate Vote", "중복 평가 차단"],
  ["Voting Closed", "투표 마감 상태"], ["Judge Missing", "심사 미제출 경고"], ["Tie Result", "동점 결과 경고"],
] as const;

export default function QaPage() {
  const { state, setNetwork, setQaScenario } = useEventOps();
  const select = (scenario: string) => {
    setQaScenario(scenario);
    setNetwork(scenario === "Offline" ? "OFFLINE" : "ONLINE");
  };
  return (
    <div className="admin-page">
      <SectionLabel label="REHEARSAL LAB" title="리허설 테스트" description="Production 데이터를 변경하지 않는 운영 시나리오 Control Room입니다." />
      <section className="scenario-grid">{scenarios.map(([scenario, description]) => <button key={scenario} className={state.qaScenario === scenario ? "is-active" : ""} type="button" onClick={() => select(scenario)}><span>◇</span><strong>{scenario}</strong><small>{description}</small></button>)}</section>
      <section className="admin-card qa-preview"><div className="admin-card__heading"><div><small>SCENARIO PREVIEW</small><h2>{state.qaScenario ?? "시나리오를 선택하세요"}</h2></div></div>
        {state.qaScenario === "Loading" && <LoadingState />}
        {state.qaScenario === "Empty" && <EmptyState />}
        {state.qaScenario === "Offline" && <OfflineState />}
        {state.qaScenario === "Error" && <ErrorState />}
        {state.qaScenario && !["Loading", "Empty", "Offline", "Error"].includes(state.qaScenario) && <div className="state-card"><span>!</span><strong>{state.qaScenario.toUpperCase()}</strong><p>해당 예외 상태의 안내 UI가 활성화되었습니다.</p></div>}
        {!state.qaScenario && <EmptyState message="왼쪽 시나리오 카드를 선택하면 상태가 표시됩니다." />}
      </section>
    </div>
  );
}
