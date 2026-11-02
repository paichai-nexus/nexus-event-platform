import { describe, expect, it } from "vitest";
import { evaluateReadiness } from "@/lib/readiness/evaluateReadiness";
const ready = { runtimeMode: "staging", backendReady: true, snapshotReady: true, teamCount: 15, completeTeamProfiles: 15, reservationCount: 120, signedCount: 120, secondDrawLocked: true, thirdDrawLocked: true, resultShowApproved: true, bestReviewerReady: true, scoringPolicyDocumentApproved: true, scoringPolicyReady: true };
describe("event readiness", () => {
  it("passes only when all live prerequisites are ready", () => expect(evaluateReadiness(ready).every((item) => item.level === "PASS")).toBe(true));
  it("blocks mock runtime, unlocked draws, unapproved results and unresolved scoring", () => { const checks = evaluateReadiness({ ...ready, runtimeMode: "mock", secondDrawLocked: false, thirdDrawLocked: false, resultShowApproved: false, scoringPolicyReady: false }); expect(checks.filter((item) => item.level === "BLOCK").map((item) => item.id)).toEqual(["runtime", "draw-second", "draw-third", "result-show", "scoring"]); });
  it("distinguishes policy document approval from official formula activation", () => { const checks = evaluateReadiness({ ...ready, scoringPolicyDocumentApproved: false, scoringPolicyReady: false }); expect(checks.filter((item) => item.level === "BLOCK").map((item) => item.id)).toEqual(["scoring-document", "scoring"]); });
});
