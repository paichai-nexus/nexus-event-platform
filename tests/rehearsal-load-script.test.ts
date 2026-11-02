import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const script = readFileSync("scripts/rehearsal-120-load.mjs", "utf8");
describe("120-person rehearsal load guard", () => {
  it("refuses non-mock runtimes before any reset or write", () => { expect(script.indexOf('assert.equal(health.body?.mode, "mock"')).toBeLessThan(script.indexOf('RESET_REHEARSAL')); expect(script).toContain("ALLOW_REHEARSAL_LOAD_TEST"); });
  it("covers signatures, 6x20 registration, duplicate clicks, 120 votes and three judges", () => { expect(script).toContain("paperSigned: true"); expect(script).toContain("length: 20"); expect(script).toContain("voteCount, 120"); expect(script).toContain("duplicate clicks must reconcile to one submission"); expect(script).toContain('["1", "2", "3"]'); });
});
