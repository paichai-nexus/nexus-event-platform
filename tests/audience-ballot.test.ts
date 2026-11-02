import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  getMockAudienceBallots,
  getMockAudienceBallotAggregate,
  resetMockAudienceBallots,
  submitMockAudienceBallot,
} from "@/lib/audience-jury/mockAudienceBallotStore";
import { registerMockAudienceJury, resetMockAudienceJury } from "@/lib/audience-jury/mockAudienceJuryStore";
import { resetMockAudienceReservations } from "@/lib/audience-jury/mockAudienceReservationStore";
import { getMockTeamSnapshot } from "@/lib/repositories/mockTeamRepository";

const EVENT_ID = "00000000-0000-4000-8000-000000000100";

describe("부문별 청중 예상 순위 투표", () => {
  beforeEach(() => {
    resetMockAudienceBallots();
    resetMockAudienceJury();
    resetMockAudienceReservations();
  });

  it("서로 다른 팀을 1위와 2위로 저장한다", () => {
    const saved = submitMockAudienceBallot({
      eventId: "event-1",
      authToken: "jury-1",
      category: "STARTUP",
      firstTeamId: "startup-1",
      secondTeamId: "startup-2",
    });
    expect(saved).toMatchObject({ firstTeamId: "startup-1", secondTeamId: "startup-2" });
    expect(getMockAudienceBallots("event-1", "jury-1")).toHaveLength(1);
  });

  it("같은 팀을 1위와 2위에 중복 선택할 수 없다", () => {
    expect(() => submitMockAudienceBallot({
      eventId: "event-1",
      authToken: "jury-1",
      category: "STARTUP",
      firstTeamId: "startup-1",
      secondTeamId: "startup-1",
    })).toThrow("1등과 2등은 서로 다른 팀을 선택해야 합니다.");
  });

  it("같은 평가단의 동일 부문 재제출을 거부한다", () => {
    const input = {
      eventId: "event-1",
      authToken: "jury-1",
      category: "STARTUP" as const,
      firstTeamId: "startup-1",
      secondTeamId: "startup-2",
    };
    submitMockAudienceBallot(input);
    expect(() => submitMockAudienceBallot({ ...input, firstTeamId: "startup-3" }))
      .toThrow("이미 해당 부문 평가를 제출했습니다.");
  });

  it("창업과 기업분석 부문은 각각 한 번씩 제출할 수 있다", () => {
    submitMockAudienceBallot({ eventId: "event-1", authToken: "jury-1", category: "STARTUP", firstTeamId: "s-1", secondTeamId: "s-2" });
    submitMockAudienceBallot({ eventId: "event-1", authToken: "jury-1", category: "BUSINESS_ANALYSIS", firstTeamId: "b-1", secondTeamId: "b-2" });
    expect(getMockAudienceBallots("event-1", "jury-1").map((item) => item.category))
      .toEqual(["STARTUP", "BUSINESS_ANALYSIS"]);
  });

  it("행사와 인증 세션별로 제출 결과를 격리한다", () => {
    submitMockAudienceBallot({ eventId: "event-1", authToken: "jury-1", category: "STARTUP", firstTeamId: "s-1", secondTeamId: "s-2" });
    expect(getMockAudienceBallots("event-1", "jury-2")).toEqual([]);
    expect(getMockAudienceBallots("event-2", "jury-1")).toEqual([]);
  });

  it("관리자 집계는 동등한 1위 후보 두 선택을 원표로 보존하고 공식 점수는 생성하지 않는다", () => {
    registerMockAudienceJury("jury-1", { department: "경영학과", studentNumber: "20260001", name: "김학생" }, EVENT_ID);
    const startup = getMockTeamSnapshot().filter((team) => team.category === "STARTUP" && team.name).slice(0, 2);
    expect(startup).toHaveLength(2);
    submitMockAudienceBallot({ eventId: EVENT_ID, authToken: "jury-1", category: "STARTUP", firstTeamId: startup[0]!.id, secondTeamId: startup[1]!.id });
    const aggregate = getMockAudienceBallotAggregate(EVENT_ID);
    const startupAggregate = aggregate.categories.find((category) => category.category === "STARTUP")!;
    expect(aggregate.officialScoresAvailable).toBe(false);
    expect(aggregate.acceptedJuryCount).toBe(1);
    expect(startupAggregate.submittedBallots).toBe(1);
    expect(startupAggregate.teams.find((team) => team.teamId === startup[0]!.id)?.firstVotes).toBe(1);
    expect(startupAggregate.teams.find((team) => team.teamId === startup[1]!.id)?.secondVotes).toBe(1);
  });
});
