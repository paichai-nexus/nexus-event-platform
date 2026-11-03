import { beforeEach, describe, expect, it } from "vitest";
import {
  authenticateMockAudienceJury,
  getMockAudienceJuryDrawPool,
  getMockAudienceJuryState,
  registerMockAudienceJury,
  resetMockAudienceJury,
  verifyMockAudienceJuryAuth,
} from "@/lib/audience-jury/mockAudienceJuryStore";
import {
  importMockAudienceReservations,
  resetMockAudienceReservations,
  setMockAudiencePaperSigned,
} from "@/lib/audience-jury/mockAudienceReservationStore";

describe("학과별 청중평가단 선착순 등록", () => {
  beforeEach(() => {
    resetMockAudienceJury();
    resetMockAudienceReservations();
  });

  it("예약 명단이 있으면 종이 서명을 마친 동일인만 QR 등록한다", () => {
    const imported = importMockAudienceReservations([{ department: "경영학과", studentNumber: "20260001", name: "김학생" }]);
    expect(() => registerMockAudienceJury("session-1", { department: "경영학과", studentNumber: "20260001", name: "김학생" }))
      .toThrow("종이 참석표 서명 확인이 필요합니다.");
    setMockAudiencePaperSigned(imported.rows[0]!.id, true);
    expect(() => registerMockAudienceJury("session-2", { department: "경영학과", studentNumber: "20260002", name: "이학생" }))
      .toThrow("예약 명단의 이름·학과·학번과 일치하지 않습니다.");
    const accepted = registerMockAudienceJury("session-3", { department: "경영학과", studentNumber: "20260001", name: "김학생" });
    expect(accepted.registration?.serialNumber).toBe("PCU-001");
  });

  it("학과별 등록 순번과 전체 120명 정원을 계산한다", () => {
    const first = registerMockAudienceJury("session-1", { department: "경영학과", studentNumber: "20260001", name: "김학생" });
    const second = registerMockAudienceJury("session-2", { department: "경영학과", studentNumber: "20260002", name: "이학생" });
    expect(first.registration?.position).toBe(1);
    expect(second.registration?.position).toBe(2);
    expect(second.totalAccepted).toBe(2);
    expect(second.totalCapacity).toBe(120);
  });

  it("동일 학번의 중복 등록을 거부한다", () => {
    registerMockAudienceJury("session-1", { department: "경영학과", studentNumber: "20260001", name: "김학생" });
    expect(() => registerMockAudienceJury("session-2", { department: "관광경영학과", studentNumber: "20260001", name: "김학생" }))
      .toThrow("이미 청중평가단으로 등록된 학번입니다.");
  });

  it("동일 브라우저의 재요청은 새 자리를 차감하지 않는다", () => {
    registerMockAudienceJury("session-1", { department: "경영학과", studentNumber: "20260001", name: "김학생" });
    const repeated = registerMockAudienceJury("session-1", { department: "관광경영학과", studentNumber: "20260099", name: "다른이름" });
    expect(repeated.registration?.department).toBe("경영학과");
    expect(repeated.totalAccepted).toBe(1);
  });

  it("한 학과의 20명 정원을 초과하지 않는다", () => {
    for (let index = 0; index < 20; index += 1) {
      registerMockAudienceJury(`session-${index}`, { department: "IT경영정보학과", studentNumber: `2026${String(index).padStart(4, "0")}`, name: `학생${String(index).padStart(2, "가")}`.replace(/[0-9]/g, "가") });
    }
    expect(() => registerMockAudienceJury("session-over", { department: "IT경영정보학과", studentNumber: "20269999", name: "초과학생" }))
      .toThrow("IT경영정보학과 청중평가단 20명이 마감되었습니다.");
    expect(getMockAudienceJuryState("other").departments.find((item) => item.department === "IT경영정보학과")?.accepted).toBe(20);
  });

  it("등록된 학번, 이름과 PCU 코드가 모두 일치할 때만 인증 세션을 발급한다", () => {
    const state = registerMockAudienceJury("registration-session", { department: "경영학과", studentNumber: "20260001", name: "김학생" });
    const serialNumber = state.registration?.serialNumber ?? "";
    expect(serialNumber).toBe("PCU-001");
    expect(() => authenticateMockAudienceJury({ studentNumber: "20260001", name: "김학생", serialNumber: "PCU-002" }))
      .toThrow("등록된 이름, 학번 또는 시리얼 번호가 일치하지 않습니다.");
    expect(() => authenticateMockAudienceJury({ studentNumber: "20260001", name: "다른이름", serialNumber }))
      .toThrow("등록된 이름, 학번 또는 시리얼 번호가 일치하지 않습니다.");
    const authenticated = authenticateMockAudienceJury({ studentNumber: "20260001", name: "김학생", serialNumber });
    expect(authenticated.token).not.toBe("registration-session");
    expect(verifyMockAudienceJuryAuth(authenticated.token)?.studentNumber).toBe("20260001");
    expect(verifyMockAudienceJuryAuth("registration-session")).toBeNull();
  });

  it("학과별 PCU-001~120 구간을 20명씩 발급하고 럭키드로우 후보를 격리한다", () => {
    const departments = ["경영학과", "IT경영정보학과", "호텔항공경영학과", "관광경영학과", "항공서비스학과", "글로벌비즈니스학과"] as const;
    let participant = 0;
    departments.forEach((department) => {
      for (let position = 1; position <= 20; position += 1) {
        participant += 1;
        registerMockAudienceJury(`session-${participant}`, {
          department,
          studentNumber: `2026${String(participant).padStart(4, "0")}`,
          name: `학생${"가".repeat(position)}`,
        });
      }
    });
    const pool = getMockAudienceJuryDrawPool();
    expect(pool).toHaveLength(120);
    expect(pool[0]?.participantCode).toBe("PCU-001");
    expect(pool[19]?.participantCode).toBe("PCU-020");
    expect(pool[20]?.participantCode).toBe("PCU-021");
    expect(pool[119]?.participantCode).toBe("PCU-120");
    expect(pool.find((candidate) => candidate.department === "호텔항공경영학과")?.participantCode).toBe("PCU-101");
    expect(pool.some((candidate) => candidate.participantCode === "PCU-000")).toBe(false);
    expect(new Set(pool.map((candidate) => candidate.participantCode))).toHaveLength(120);
  });
});
