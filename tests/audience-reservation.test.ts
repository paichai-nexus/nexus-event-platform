import { beforeEach, describe, expect, it } from "vitest";
import { parseAudienceReservationRows, parseAudienceReservationText } from "@/lib/audience-jury/parseAudienceReservationCsv";
import {
  attachMockReservationPcuCode,
  getMockAudienceReservations,
  importMockAudienceReservations,
  resetMockAudienceReservations,
  setMockAudiencePaperSigned,
  verifyAndRecordMockReservationQr,
} from "@/lib/audience-jury/mockAudienceReservationStore";

describe("청중평가 예약·서명·QR 명단", () => {
  beforeEach(() => resetMockAudienceReservations());

  it("Excel CSV/TSV의 학과·학번·이름 열을 읽는다", () => {
    const csv = "학과,학번,이름\n경영학과,20260001,김학생\nIT경영정보학과,20260002,이학생";
    const parsed = parseAudienceReservationText(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([
      { department: "경영학과", studentNumber: "20260001", name: "김학생" },
      { department: "IT경영정보학과", studentNumber: "20260002", name: "이학생" },
    ]);
  });

  it("잘못된 학과와 필수 열 누락을 사용자에게 알린다", () => {
    const parsed = parseAudienceReservationText("학과\t학번\t이름\n없는학과\t20260001\t김학생");
    expect(parsed.rows).toEqual([]);
    expect(parsed.errors[0]).toContain("학과명");
    expect(() => parseAudienceReservationText("학과,이름\n경영학과,김학생")).toThrow("학과, 학번, 이름 열");
  });

  it("XLSX에서 읽은 셀 행도 동일한 검증 규칙으로 변환한다", () => {
    const parsed = parseAudienceReservationRows([
      ["소속 학과", "성명", "Student ID"],
      ["관광경영학과", "박학생", 20261234],
    ]);
    expect(parsed).toEqual({
      rows: [{ department: "관광경영학과", name: "박학생", studentNumber: "20261234" }],
      errors: [],
    });
  });

  it("동일 학번을 중복 등록하지 않는다", () => {
    const rows = [
      { department: "경영학과" as const, studentNumber: "20260001", name: "김학생" },
      { department: "관광경영학과" as const, studentNumber: "20260001", name: "다른학생" },
    ];
    const result = importMockAudienceReservations(rows);
    expect(result.imported).toBe(1);
    expect(result.duplicates).toBe(1);
    expect(result.summary.total).toBe(1);
  });

  it("서명 전 QR을 거부하고 서명 후 동일인만 QR 출석 처리한다", () => {
    const result = importMockAudienceReservations([{ department: "경영학과", studentNumber: "20260001", name: "김학생" }]);
    const row = result.rows[0]!;
    expect(() => verifyAndRecordMockReservationQr({ department: "경영학과", studentNumber: "20260001", name: "김학생" }))
      .toThrow("종이 참석표 서명 확인이 필요합니다.");
    setMockAudiencePaperSigned(row.id, true);
    expect(() => verifyAndRecordMockReservationQr({ department: "경영학과", studentNumber: "20260001", name: "다른이름" }))
      .toThrow("예약 명단의 이름·학과·학번과 일치하지 않습니다.");
    verifyAndRecordMockReservationQr({ department: "경영학과", studentNumber: "20260001", name: "김학생" });
    expect(getMockAudienceReservations().summary.qrCheckedIn).toBe(1);
    expect(() => setMockAudiencePaperSigned(row.id, false)).toThrow("QR 출석이 완료된 예약자는 서명을 취소할 수 없습니다.");
  });

  it("청중평가단 확정 후 예약자 명단에 PCU 코드를 연결한다", () => {
    importMockAudienceReservations([{ department: "경영학과", studentNumber: "20260001", name: "김학생" }]);
    attachMockReservationPcuCode("20260001", "PCU-001");
    expect(getMockAudienceReservations().rows[0]?.pcuCode).toBe("PCU-001");
  });
});
