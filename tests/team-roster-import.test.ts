import { describe, expect, it } from "vitest";
import { parseTeamRosterRows } from "@/lib/teams/parseTeamRoster";
const header = ["발표순서", "부문", "팀명", "소속학과", "대표자", "팀원", "지도교수", "발표주제", "참가상태"];
const valid = Array.from({ length: 19 }, (_, index) => [index + 1, index < 10 ? "창업" : "기업분석", `팀${index + 1}`, "경영학과", `대표${index + 1}`, `팀원${index + 1}`, "지도교수", `발표주제${index + 1}`, "참가"]);
describe("team roster parser", () => {
  it("accepts exactly 19 teams with a 10/9 category split", () => { const result = parseTeamRosterRows([header, ...valid]); expect(result.errors).toEqual([]); expect(result.rows).toHaveLength(19); });
  it("rejects duplicate order and an invalid category split", () => { const broken = valid.map((row) => [...row]); broken[18][0] = 18; broken[18][1] = "창업"; const result = parseTeamRosterRows([header, ...broken]); expect(result.errors).toContain("발표순서가 중복되었습니다."); expect(result.errors).toContain("부문 구성은 창업 10팀·기업분석 9팀이어야 합니다."); });
});
