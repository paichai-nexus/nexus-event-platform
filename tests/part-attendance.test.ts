import { beforeEach, describe, expect, test } from "vitest";
import {
  getMockPartAttendanceDrawPool,
  getMockPartAttendanceSnapshot,
  resetMockPartAttendance,
  submitMockPartAttendance,
} from "@/lib/attendance/mockPartAttendanceStore";

const attendee = { department: "경영학과" as const, studentNumber: "20269999", name: "리허설학생" };

describe("part attendance", () => {
  beforeEach(() => resetMockPartAttendance());

  test("1부와 2부 출석을 각각 집계하고 교집합을 계산한다", () => {
    submitMockPartAttendance({ ...attendee, part: 1 });
    submitMockPartAttendance({ ...attendee, part: 2 });
    expect(getMockPartAttendanceSnapshot()).toMatchObject({ partOneCount: 1, partTwoCount: 1, bothCount: 1, uniqueCount: 1 });
  });

  test("같은 학번의 같은 부 재제출은 중복 인원을 만들지 않는다", () => {
    const first = submitMockPartAttendance({ ...attendee, part: 1 });
    const duplicate = submitMockPartAttendance({ ...attendee, part: 1 });
    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(duplicate.record.id).toBe(first.record.id);
    expect(getMockPartAttendanceSnapshot().partOneCount).toBe(1);
  });

  test("같은 학번에 다른 이름이나 학과를 사용할 수 없다", () => {
    submitMockPartAttendance({ ...attendee, part: 1 });
    expect(() => submitMockPartAttendance({ ...attendee, part: 2, name: "다른학생" })).toThrow(/일치하지 않습니다/);
  });

  test("럭키드로우 후보에는 1부와 2부 모두 출석한 사람만 포함한다", () => {
    submitMockPartAttendance({ ...attendee, part: 1 });
    submitMockPartAttendance({ ...attendee, part: 2 });
    submitMockPartAttendance({ department: "관광경영학과", studentNumber: "20268888", name: "1부만", part: 1 });
    expect(getMockPartAttendanceDrawPool()).toEqual([expect.stringMatching(/^ENT-/)]);
  });
});
