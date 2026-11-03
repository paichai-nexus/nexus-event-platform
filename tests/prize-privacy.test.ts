import { describe, expect, it } from "vitest";
import { maskStudentNumber, maskWinnerName } from "@/lib/prize/privacy";

describe("전광판 당첨자 개인정보 마스킹", () => {
  it("이름은 첫 글자와 마지막 글자만 공개한다", () => {
    expect(maskWinnerName("박영준")).toBe("박*준");
    expect(maskWinnerName("김혜원")).toBe("김*원");
    expect(maskWinnerName("이준")).toBe("이*");
  });

  it("학번은 앞 네 자리만 공개한다", () => {
    expect(maskStudentNumber("20261234")).toBe("2026****");
    expect(maskStudentNumber("A12345678")).toBe("A123*****");
  });
});
