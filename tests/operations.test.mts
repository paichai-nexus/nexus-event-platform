import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCsv } from "../features/export/lib/downloadCsv.ts";
import { canSubmitVote, isDuplicateCheckIn, nextPrizeWinner, normalizeParticipantId } from "../features/event/lib/mockOperations.ts";
import { createEmptyTeamSlots } from "../features/event/data/teamSlots.ts";
import { calculateFinalScore, calculateScoreRows, calculateScoringResult } from "../features/scoring/lib/calculateScores.ts";
import { toPublicEventSnapshot } from "../features/event/services/eventSnapshotService.ts";
import { COMMON_DOCUMENT_CRITERIA, DOCUMENT_SCORING_POLICY, PRESENTATION_DOCUMENT_CRITERIA, SCORING_POLICY_READY } from "../features/scoring/data/evaluationPolicy.ts";
import { canTransitionEvent } from "../features/event/lib/eventStateMachine.ts";
import { hasRequiredRole } from "../lib/auth/roles.ts";
import { readAudienceSessionToken } from "../lib/attendance/sessionCookie.ts";

test("admin authorization rejects inactive and unapproved roles", () => {
  assert.equal(hasRequiredRole("ADMIN", true, ["ADMIN"]), true);
  assert.equal(hasRequiredRole("STAFF", true, ["ADMIN", "STAFF"]), true);
  assert.equal(hasRequiredRole("JUDGE", true, ["ADMIN", "STAFF"]), false);
  assert.equal(hasRequiredRole("ADMIN", false, ["ADMIN"]), false);
  assert.equal(hasRequiredRole(undefined, true, ["ADMIN"]), false);
});

test("check-in ID normalization and duplicate detection", () => {
  assert.equal(normalizeParticipantId("P-12"), "#0012");
  assert.equal(normalizeParticipantId("invalid"), null);
  assert.equal(isDuplicateCheckIn(["#0012"], "#0012"), true);
});

test("team vote rejects duplicate and closed submissions", () => {
  assert.equal(canSubmitVote("OPEN", [], "TEAM-01"), true);
  assert.equal(canSubmitVote("OPEN", ["TEAM-01"], "TEAM-01"), false);
  assert.equal(canSubmitVote("CLOSED", [], "TEAM-01"), false);
});

test("team slots preserve the 19 / 10 / 9 structure with 15 supplied team profiles", () => {
  const teams = createEmptyTeamSlots();
  assert.equal(teams.length, 19);
  assert.equal(teams.filter((team) => team.category === "STARTUP").length, 10);
  assert.equal(teams.filter((team) => team.category === "BUSINESS_ANALYSIS").length, 9);
  assert.equal(teams.filter((team) => team.name).length, 15);
  assert.equal(teams.filter((team) => team.promotionEnabled).length, 15);
  assert.equal(teams.find((team) => team.name === "EVER OASIS")?.leaderName, null);
  assert.deepEqual(teams.find((team) => team.name === "밋턴")?.memberNames, []);
});

test("80/20 scoring preserves ties without forced ordering", () => {
  assert.equal(calculateFinalScore(90, 80), 88);
  const rows = calculateScoreRows([
    { teamId: "A", teamName: "TEAM A", professional: 90, audience: 80 },
    { teamId: "B", teamName: "TEAM B", professional: 85, audience: 100 },
  ]);
  assert.equal(rows[0].finalScore, 88);
  assert.equal(rows[1].finalScore, 88);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[1].rank, 1);
  assert.equal(rows.every((row) => row.tied), true);
});

test("scoring is blocked until official criteria are configured", () => {
  const result = calculateScoringResult([], false);
  assert.equal(result.status, "SCORING_BLOCKED");
  assert.match(result.reason, /평가기준/);
});

test("prize selection skips previous winners", () => {
  assert.equal(nextPrizeWinner([]), "#0142");
  assert.equal(nextPrizeWinner(["#0142"]), "#0087");
});

test("CSV output escapes comma and quotes", () => {
  const csv = createCsv([{ team: "TEAM, 01", note: 'A "test"' }]);
  assert.match(csv, /"TEAM, 01"/);
  assert.match(csv, /"A ""test"""/);
});

test("CSV output neutralizes spreadsheet formulas", () => {
  const csv = createCsv([{ a: "=2+2", b: "+SUM(A1:A2)", c: "-1+2", d: "@cmd" }]);
  assert.match(csv, /"'=2\+2"/);
  assert.match(csv, /"'\+SUM\(A1:A2\)"/);
  assert.match(csv, /"'-1\+2"/);
  assert.match(csv, /"'@cmd"/);
});

test("public snapshot exposes only allow-listed presentation data", () => {
  const snapshot = toPublicEventSnapshot(
    {
      eventId: "event-secret",
      mode: "LIVE",
      status: "VOTING_READY",
      votingStatus: "READY",
      version: 7,
      activeTeamId: "team-1",
      displayMode: "SPOTLIGHT",
      resultStatus: "LOCKED",
      revealStep: 0,
    },
    [{ id: "team-1", name: "공개 팀", leaderName: "비공개 이름", memberNames: ["비공개 팀원"], topic: "공개 주제", promotionEnabled: true, order: 1, category: "STARTUP", status: "PRESENTING", active: true }],
    "2026-11-04T04:00:00.000Z",
  );
  const serialized = JSON.stringify(snapshot);
  assert.equal(snapshot.version, 7);
  assert.equal(snapshot.activeTeam?.name, "공개 팀");
  assert.equal(serialized.includes("비공개 이름"), false);
  assert.equal(serialized.includes("비공개 팀원"), false);
  assert.equal(serialized.includes("event-secret"), false);
  assert.equal(serialized.includes("score"), false);
});

test("document criteria preserve the supplied 50 + 100 + 50 judge score structure", () => {
  const commonDocument = COMMON_DOCUMENT_CRITERIA.document.reduce((sum, item) => sum + item.maxScore, 0);
  const commonQa = COMMON_DOCUMENT_CRITERIA.qa.reduce((sum, item) => sum + item.maxScore, 0);
  const startupPresentation = PRESENTATION_DOCUMENT_CRITERIA.STARTUP.reduce((sum, item) => sum + item[1], 0);
  const analysisPresentation = PRESENTATION_DOCUMENT_CRITERIA.BUSINESS_ANALYSIS.reduce((sum, item) => sum + item[1], 0);
  assert.deepEqual([commonDocument, startupPresentation, commonQa], [50, 100, 50]);
  assert.equal(analysisPresentation, 100);
  assert.equal(DOCUMENT_SCORING_POLICY.professionalWeight, 0.7);
  assert.equal(DOCUMENT_SCORING_POLICY.audienceWeight, 0.3);
  assert.equal(DOCUMENT_SCORING_POLICY.approvalStatus, "CONFLICT_REQUIRES_APPROVAL");
});

test("event state machine rejects unsafe jumps", () => {
  assert.equal(canTransitionEvent("SETUP", "CHECK_IN_OPEN"), true);
  assert.equal(canTransitionEvent("SETUP", "FINALIZED"), false);
  assert.equal(canTransitionEvent("VOTING_OPEN", "VOTING_CLOSED"), true);
  assert.equal(canTransitionEvent("ENDED", "VOTING_OPEN"), false);
});

test("production control migration keeps LIVE reset blocked and vote sessions event-scoped", () => {
  const sql = readFileSync(new URL("../supabase/migrations/011_production_control_plane.sql", import.meta.url), "utf8");
  assert.match(sql, /if v_mode <> 'REHEARSAL' then raise exception 'LIVE_RESET_FORBIDDEN'/);
  assert.match(sql, /foreign key \(event_id, team_id\) references public\.teams\(event_id, id\)/);
  assert.match(sql, /ACTIVE_TEAM_MUST_BE_COMPLETED/);
  assert.match(sql, /VOTE_SESSION_NOT_READY/);
  assert.match(sql, /delete from public\.team_vote_sessions where event_id = p_event_id/);
});

test("audience session cookie parser never invents a credential", () => {
  assert.equal(readAudienceSessionToken(new Request("http://localhost/api/votes")), null);
  assert.equal(readAudienceSessionToken(new Request("http://localhost/api/votes", { headers: { cookie: "a=1; audience_attendance_session=opaque%20token; b=2" } })), "opaque token");
});

test("persistent voting migration enforces event isolation, close checks, and idempotency", () => {
  const sql = readFileSync(new URL("../supabase/migrations/012_persistent_voting_and_judging.sql", import.meta.url), "utf8");
  assert.match(sql, /unique \(vote_session_id, participant_id\)/);
  assert.match(sql, /audience_submission_session_same_team_fk/);
  assert.match(sql, /session_token_hash = encode\(digest\(p_session_token, 'sha256'\), 'hex'\)/);
  assert.match(sql, /selected_session\.status <> 'OPEN'/);
  assert.match(sql, /on conflict \(vote_session_id, participant_id\) do update/);
  assert.match(sql, /RESULT_FINALIZED/);
  assert.match(sql, /judge_score_revisions/);
});

test("document totals do not mathematically equal an exact 70/30 split", () => {
  const professional = 3 * 200;
  const statedTotal = 840;
  const impliedAudience = statedTotal - professional;
  assert.equal(impliedAudience, 240);
  assert.notEqual(professional / statedTotal, 0.7);
  assert.notEqual(impliedAudience / statedTotal, 0.3);
  assert.equal(SCORING_POLICY_READY, false);
});
