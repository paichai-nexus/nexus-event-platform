import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { canonicalJson, summarizeReservations, summarizeScoringPolicy, verifyOperationalSnapshot } from "@/lib/export/operationalExport";
describe("redacted operational export", () => {
  it("summarizes attendance without exporting names or student numbers", () => { const summary = summarizeReservations([{ id: "1", department: "경영학과", name: "개인정보", studentNumber: "20260001", reservedAt: "t", paperSignedAt: "t", qrCheckedInAt: null, pcuCode: "PCU101" }]); expect(JSON.stringify(summary)).not.toContain("개인정보"); expect(JSON.stringify(summary)).not.toContain("20260001"); expect(summary.departments["경영학과"]).toEqual({ reserved: 1, signed: 1, checkedIn: 0, accepted: 1 }); });
  it("produces stable canonical JSON regardless of object key order", () => expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 4 }, b: 2 })));
  it("records policy approval separately from official score availability", () => {
    const summary = summarizeScoringPolicy({ id: "policy-1", eventId: "event-1", version: "2026-A", professionalWeight: 70, audienceWeight: 30, judgeCount: 3, professionalMaxPerJudge: 200, audienceConversionRule: "approved conversion", tieBreakRule: "approved tie", categoryAggregationRule: "separate categories", status: "APPROVED", approvedAt: "2026-11-02T00:00:00.000Z", updatedAt: "2026-11-02T00:00:00.000Z" }, false);
    expect(summary.status).toBe("APPROVED");
    expect(summary.officialScoresAvailable).toBe(false);
    expect(summary.officialResultLock).toBe("POLICY_APPROVAL_REQUIRED");
    expect(JSON.stringify(summary)).not.toContain("event-1");
  });
  it("verifies an unchanged snapshot and rejects modified data", async () => {
    const data = { audience: { accepted: 120 }, scoringPolicy: { status: "APPROVED", officialScoresAvailable: false } };
    const digest = createHash("sha256").update(canonicalJson(data)).digest("hex");
    const snapshot = { exportType: "REDACTED_OPERATIONAL_SNAPSHOT", integrity: { algorithm: "SHA-256", digest }, data };
    await expect(verifyOperationalSnapshot(snapshot)).resolves.toEqual({ valid: true, reason: "SHA-256 무결성 검증을 통과했습니다." });
    await expect(verifyOperationalSnapshot({ ...snapshot, data: { ...data, audience: { accepted: 121 } } })).resolves.toEqual({ valid: false, reason: "내용이 변경되었거나 손상된 Snapshot입니다." });
  });
});
