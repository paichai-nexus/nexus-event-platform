import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { registerMockAudienceJury, resetMockAudienceJury } from "@/lib/audience-jury/mockAudienceJuryStore";
import { resetMockAudienceReservations } from "@/lib/audience-jury/mockAudienceReservationStore";
import { drawMockPrizeItem, getMockPrizeInventory, resetMockPrizeInventory } from "@/lib/prize/prizeInventoryStore";
import { resetMockCheckIns } from "@/lib/repositories/mockCheckInRepository";
import { lockPrizeStage, resetMockPrizeStages } from "@/lib/prize/prizeStageStore";

const EVENT_ID = "00000000-0000-4000-8000-000000000100";

describe("확정 경품 풀과 서버 추첨", () => {
  beforeAll(() => {
    vi.stubEnv("APP_RUNTIME_MODE", "mock");
    vi.stubEnv("ALLOW_MOCK_RUNTIME", "true");
    vi.stubEnv("NODE_ENV", "development");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    resetMockAudienceJury();
    resetMockAudienceReservations();
    resetMockPrizeInventory();
    resetMockCheckIns();
    resetMockPrizeStages();
    registerMockAudienceJury("jury-1", { department: "경영학과", studentNumber: "20260001", name: "김학생" }, EVENT_ID);
    registerMockAudienceJury("jury-2", { department: "경영학과", studentNumber: "20260002", name: "이학생" }, EVENT_ID);
  });

  it("청중평가단 8명과 전체 참여자 27명, 총 91만원 예산을 보존한다", () => {
    const inventory = getMockPrizeInventory();
    expect(inventory).toHaveLength(6);
    expect(inventory.filter((item) => item.pool === "AUDIENCE_JURY").reduce((sum, item) => sum + item.winnerCount, 0)).toBe(8);
    expect(inventory.filter((item) => item.pool === "ALL_PARTICIPANTS").reduce((sum, item) => sum + item.winnerCount, 0)).toBe(27);
    expect(inventory.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0)).toBe(910000);
  });

  it("풀을 분리하고 행사 전체에서 중복 당첨을 차단한다", async () => {
    const audiencePrize = getMockPrizeInventory().find((item) => item.id === "AUDIENCE-OUTBACK")!;
    const allPrize = getMockPrizeInventory().find((item) => item.id === "ALL-AIRPODS")!;
    await lockPrizeStage(EVENT_ID, "SECOND");
    const first = await drawMockPrizeItem(EVENT_ID, audiencePrize.id, "SECOND");
    const second = await drawMockPrizeItem(EVENT_ID, allPrize.id, "SECOND");
    expect(first.pool).toBe("AUDIENCE_JURY");
    expect(second.pool).toBe("ALL_PARTICIPANTS");
    expect(second.participantCode).not.toBe(first.participantCode);
    await expect(drawMockPrizeItem(EVENT_ID, allPrize.id, "SECOND")).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});
