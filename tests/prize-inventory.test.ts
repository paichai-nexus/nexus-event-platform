import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { resetMockPartAttendance, submitMockPartAttendance } from "@/lib/attendance/mockPartAttendanceStore";
import { drawMockPrizeItem, getMockPrizeDraws, getMockPrizeInventory, resetMockPrizeInventory } from "@/lib/prize/prizeInventoryStore";
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
    resetMockPartAttendance();
    resetMockPrizeInventory();
    resetMockPrizeStages();
    submitMockPartAttendance({ eventId: EVENT_ID, part: 2, department: "경영학과", studentNumber: "20260001", name: "김학생" });
    submitMockPartAttendance({ eventId: EVENT_ID, part: 2, department: "경영학과", studentNumber: "20260002", name: "이학생" });
  });

  it("행사 단계별 추첨 33명과 베스트 리뷰어 2명, 총 91만원 예산을 보존한다", () => {
    const inventory = getMockPrizeInventory();
    expect(inventory).toHaveLength(6);
    expect(inventory.filter((item) => !item.awardOnly).reduce((sum, item) => sum + item.winnerCount, 0)).toBe(33);
    expect(inventory.filter((item) => item.awardOnly).reduce((sum, item) => sum + item.winnerCount, 0)).toBe(2);
    expect(inventory.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0)).toBe(910000);
  });

  it("차수 불일치와 행사 전체 중복 당첨을 차단한다", async () => {
    const airpods = getMockPrizeInventory().find((item) => item.id === "THIRD-AIRPODS")!;
    const coffee = getMockPrizeInventory().find((item) => item.id === "THIRD-COFFEE")!;
    await lockPrizeStage(EVENT_ID, "THIRD");
    await expect(drawMockPrizeItem(EVENT_ID, airpods.id, "SECOND")).rejects.toMatchObject({ code: "INVALID_STATE" });
    const first = await drawMockPrizeItem(EVENT_ID, airpods.id, "THIRD");
    const second = await drawMockPrizeItem(EVENT_ID, coffee.id, "THIRD");
    expect(second.participantCode).not.toBe(first.participantCode);
    expect(first).toMatchObject({ department: "경영학과", maskedStudentNumber: "2026****" });
    expect(["김*생", "이*생"]).toContain(first.maskedName);
    expect(getMockPrizeDraws(EVENT_ID)[0]?.drawId).toBe(second.drawId);
    await expect(drawMockPrizeItem(EVENT_ID, airpods.id, "THIRD")).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});
