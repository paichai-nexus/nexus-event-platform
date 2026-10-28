import "server-only";

import { finalistProfileForName } from "@/features/event/data/finalistCandidates";
import { DomainError } from "@/lib/errors/domainError";
import {
  getPostgresTestRequestUserId,
  postgresOneJson,
  postgresRowsJson,
  runPostgresTestJson,
} from "@/lib/integration/postgresTest";
import type { AttendanceRepository } from "@/lib/repositories/attendanceRepository";
import type { CheckInCommand, CheckInOutcome, CheckInRepository, CheckInSnapshot } from "@/lib/repositories/checkInRepository";
import type { EventControlRepository, EventControlSnapshot } from "@/lib/repositories/eventControlRepository";
import type { JudgeRepository } from "@/lib/repositories/judgeRepository";
import type { PrizeCatalogRepository } from "@/lib/repositories/prizeCatalogRepository";
import type { PrizeRepository } from "@/lib/repositories/prizeRepository";
import type { TeamRepository } from "@/lib/repositories/teamRepository";
import type { VoteRepository } from "@/lib/repositories/voteRepository";
import type { AudienceAttendanceState } from "@/types/attendance";
import type { JudgeProgress, JudgeWorkspace, JudgeWorkspaceScore } from "@/types/judging";
import type { PrizeDefinition, PrizeDefinitionUpdate, PrizeRecord } from "@/types/prize";
import type { Team, TeamUpdate } from "@/types/team";
import type { AudienceVoteSnapshot, AudienceVoteState } from "@/types/voting";

type SqlError = Error & { message: string };

function messageOf(error: unknown) {
  return (error as SqlError)?.message ?? "";
}

function eventRowQuery() {
  return postgresOneJson(`
    select event.id as "eventId", event.mode, event.status,
      event.voting_status as "votingStatus", event.version,
      event.active_team_id as "activeTeamId", event.display_mode as "displayMode",
      event.result_status as "resultStatus", event.reveal_step as "revealStep"
    from public.events event
    where (nullif(:'event_id', '')::uuid is null or event.id = nullif(:'event_id', '')::uuid)
    order by event.starts_at desc
  `);
}

async function eventSnapshot(eventId?: string) {
  const row = await runPostgresTestJson<EventControlSnapshot | null>(eventRowQuery(), { event_id: eventId ?? "" });
  if (!row) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
  return { ...row, version: Number(row.version), revealStep: Number(row.revealStep) };
}

async function eventMutation(functionExpression: string, variables: Record<string, string | number | null>, userId: string) {
  const row = await runPostgresTestJson<EventControlSnapshot | null>(postgresOneJson(`
    select changed.id as "eventId", changed.mode, changed.status,
      changed.voting_status as "votingStatus", changed.version,
      changed.active_team_id as "activeTeamId", changed.display_mode as "displayMode",
      changed.result_status as "resultStatus", changed.reveal_step as "revealStep"
    from ${functionExpression} changed
  `), variables, { role: "authenticated", userId });
  if (!row) throw new DomainError("DATABASE_ERROR", "행사 상태를 변경하지 못했습니다.", 500);
  return { ...row, version: Number(row.version), revealStep: Number(row.revealStep) };
}

export class PostgresTestAttendanceRepository implements AttendanceRepository {
  private async execute(action: string, sessionToken: string, eventId?: string) {
    const row = await runPostgresTestJson<AudienceAttendanceState | null>(postgresOneJson(`
      select result.known, result.active, result.participant_id as "participantId",
        result.entered_at as "enteredAt", result.active_count as "activeCount"
      from public.${action}(nullif(:'event_id', '')::uuid, :'session_token') result
    `), { event_id: eventId ?? "", session_token: sessionToken }, { role: "service_role" });
    if (!row) throw new DomainError("DATABASE_ERROR", "입장 상태를 확인하지 못했습니다.", 500);
    return { ...row, activeCount: Number(row.activeCount) };
  }

  getStatus(sessionToken: string, eventId?: string) { return this.execute("get_audience_attendance", sessionToken, eventId); }
  enter(sessionToken: string, eventId?: string) { return this.execute("enter_audience_attendance", sessionToken, eventId); }
  exit(sessionToken: string, eventId?: string) { return this.execute("exit_audience_attendance", sessionToken, eventId); }
}

export class PostgresTestCheckInRepository implements CheckInRepository {
  async checkIn(command: CheckInCommand): Promise<CheckInOutcome> {
    const actor = await getPostgresTestRequestUserId();
    const row = await runPostgresTestJson<Record<string, string | null> | null>(postgresOneJson(`
      select result.status, result.participant_id, result.participant_code, result.checked_in_at
      from public.perform_check_in(
        nullif(:'event_id', '')::uuid, :'participant_code', :'checked_in_by'::uuid,
        :'source'::public.check_in_source
      ) result
    `), {
      event_id: command.eventId ?? "",
      participant_code: command.participantCode,
      checked_in_by: command.checkedInBy || actor,
      source: command.source,
    }, { role: "authenticated", userId: actor });
    if (!row) return { status: "ERROR" };
    if (["NOT_FOUND", "INVALID_EVENT", "ERROR"].includes(row.status ?? "")) return { status: row.status as "NOT_FOUND" | "INVALID_EVENT" | "ERROR" };
    if (row.status === "INACTIVE" && row.participant_id && row.participant_code) {
      return { status: "INACTIVE", participantId: row.participant_id, participantCode: row.participant_code };
    }
    if ((row.status === "SUCCESS" || row.status === "ALREADY_CHECKED_IN") && row.participant_id && row.participant_code && row.checked_in_at) {
      return { status: row.status, participantId: row.participant_id, participantCode: row.participant_code, checkedInAt: row.checked_in_at };
    }
    return { status: "ERROR" };
  }

  async getSnapshot(eventId?: string): Promise<CheckInSnapshot> {
    const event = await eventSnapshot(eventId);
    const summary = await runPostgresTestJson<{ registeredCount: number; checkInCount: number }>(postgresOneJson(`
      select
        (select count(*)::int from public.participants where event_id = :'event_id'::uuid and active) as "registeredCount",
        ((select count(*) from public.check_ins where event_id = :'event_id'::uuid) +
         (select count(*) from public.audience_attendance_sessions where event_id = :'event_id'::uuid and exited_at is null))::int as "checkInCount"
    `), { event_id: event.eventId }, { role: "service_role" });
    const checkIns = await runPostgresTestJson<Array<{ participantId: string; time: string }>>(postgresRowsJson(`
      select record.participant_id as "participantId", record.time
      from (
        select participant.participant_code as participant_id, check_in.checked_in_at as time
        from public.check_ins check_in join public.participants participant on participant.id = check_in.participant_id
        where check_in.event_id = :'event_id'::uuid
        union all
        select attendance.participant_label, attendance.entered_at
        from public.audience_attendance_sessions attendance
        where attendance.event_id = :'event_id'::uuid and attendance.exited_at is null
      ) record order by record.time desc limit 50
    `), { event_id: event.eventId }, { role: "service_role" });
    return { eventId: event.eventId, registeredCount: Number(summary.registeredCount), checkInCount: Number(summary.checkInCount), checkIns };
  }
}

export class PostgresTestEventControlRepository implements EventControlRepository {
  getSnapshot(eventId?: string) { return eventSnapshot(eventId); }
  async setVotingStatus(eventId: string, status: EventControlSnapshot["votingStatus"]) {
    const userId = await getPostgresTestRequestUserId();
    return eventMutation("public.set_event_voting_status(:'event_id'::uuid, :'value'::public.voting_status)", { event_id: eventId, value: status }, userId);
  }
  async setMode(eventId: string, mode: EventControlSnapshot["mode"]) {
    const userId = await getPostgresTestRequestUserId();
    return eventMutation("public.set_event_mode(:'event_id'::uuid, :'value'::public.event_mode)", { event_id: eventId, value: mode }, userId);
  }
  async setStatus(eventId: string, status: EventControlSnapshot["status"]) {
    const userId = await getPostgresTestRequestUserId();
    return eventMutation("public.set_event_status(:'event_id'::uuid, :'value'::public.event_status)", { event_id: eventId, value: status }, userId);
  }
  async setActiveTeam(eventId: string, teamId: string | null) {
    if (!teamId) throw new DomainError("VALIDATION_ERROR", "발표팀을 선택해주세요.", 422);
    const userId = await getPostgresTestRequestUserId();
    return eventMutation("public.activate_event_team(:'event_id'::uuid, :'team_id'::uuid)", { event_id: eventId, team_id: teamId }, userId);
  }
  async completeActiveTeam(eventId: string) {
    const userId = await getPostgresTestRequestUserId();
    return eventMutation("public.complete_event_team(:'event_id'::uuid)", { event_id: eventId }, userId);
  }
  async setDisplayMode(eventId: string, displayMode: EventControlSnapshot["displayMode"]) {
    const userId = await getPostgresTestRequestUserId();
    return eventMutation("public.set_event_display_mode(:'event_id'::uuid, :'value')", { event_id: eventId, value: displayMode }, userId);
  }
  async setRevealStep(eventId: string, revealStep: number) {
    const userId = await getPostgresTestRequestUserId();
    return eventMutation("public.set_event_reveal_step(:'event_id'::uuid, :'value'::integer)", { event_id: eventId, value: revealStep }, userId);
  }
  async resetRehearsal(eventId: string) {
    const userId = await getPostgresTestRequestUserId();
    await runPostgresTestJson(postgresOneJson(`select public.reset_rehearsal_event(:'event_id'::uuid) as reset`), { event_id: eventId }, { role: "authenticated", userId });
    return eventSnapshot(eventId);
  }
}

export class PostgresTestVoteRepository implements VoteRepository {
  async getState(eventId: string | undefined, sessionToken: string) {
    const row = await runPostgresTestJson<AudienceVoteState | null>(postgresOneJson(`
      select result.eligible, result.voting_status as "votingStatus", result.team_id as "teamId",
        result.submission_id as "submissionId", result.submitted_at as "submittedAt"
      from public.get_audience_vote_state(nullif(:'event_id', '')::uuid, :'session_token') result
    `), { event_id: eventId ?? "", session_token: sessionToken }, { role: "service_role" });
    if (!row) throw new DomainError("DATABASE_ERROR", "투표 상태를 확인하지 못했습니다.", 500);
    return row;
  }
  async submit(eventId: string | undefined, sessionToken: string) {
    try {
      await runPostgresTestJson(postgresOneJson(`
        select submission.id from public.submit_audience_vote(nullif(:'event_id', '')::uuid, :'session_token') submission
      `), { event_id: eventId ?? "", session_token: sessionToken }, { role: "service_role" });
    } catch (error) {
      const message = messageOf(error);
      if (message.includes("VOTING_CLOSED")) throw new DomainError("EVENT_CLOSED", "현재 투표가 열려 있지 않습니다.", 409);
      if (message.includes("NOT_ELIGIBLE")) throw new DomainError("FORBIDDEN", "현장 입장을 완료한 참가자만 투표할 수 있습니다.", 403);
      if (message.includes("ALREADY_SUBMITTED")) {
        const state = await this.getState(eventId, sessionToken);
        if (state.submissionId) return state;
        throw new DomainError("ALREADY_SUBMITTED", "이미 해당 발표팀 평가를 제출했습니다.", 409);
      }
      throw error;
    }
    return this.getState(eventId, sessionToken);
  }
  async getSnapshot(eventId: string): Promise<AudienceVoteSnapshot> {
    const userId = await getPostgresTestRequestUserId();
    const teams = await runPostgresTestJson<AudienceVoteSnapshot["teams"]>(postgresRowsJson(`
      select result.team_id as "teamId", result.vote_count as "voteCount", result.eligibility_count as "eligibilityCount"
      from public.get_audience_vote_snapshot(:'event_id'::uuid) result
    `), { event_id: eventId }, { role: "authenticated", userId });
    const normalized = teams.map((team) => ({ ...team, voteCount: Number(team.voteCount), eligibilityCount: Number(team.eligibilityCount) }));
    return { totalVotes: normalized.reduce((sum, team) => sum + team.voteCount, 0), teams: normalized };
  }
}

export class PostgresTestJudgeRepository implements JudgeRepository {
  async getWorkspace(eventId: string, activeTeamId: string | null, judgeUserId: string): Promise<JudgeWorkspace> {
    const assignedTeamIds = await runPostgresTestJson<string[]>(`select coalesce(jsonb_agg(team_id), '[]'::jsonb)::text from public.judge_assignments where event_id = :'event_id'::uuid and judge_user_id = :'judge_id'::uuid and active;`, { event_id: eventId, judge_id: judgeUserId }, { role: "authenticated", userId: judgeUserId });
    const criteria = await runPostgresTestJson<JudgeWorkspace["criteria"]>(postgresRowsJson(`select id, name, max_score as "maxScore", order_index as "order" from public.evaluation_criteria where event_id = :'event_id'::uuid and scope = 'JUDGE' and active order by order_index`), { event_id: eventId }, { role: "authenticated", userId: judgeUserId });
    const submission = activeTeamId ? await runPostgresTestJson<{ id: string; status: "DRAFT" | "SUBMITTED"; submittedAt: string | null } | null>(postgresOneJson(`select id, status, submitted_at as "submittedAt" from public.judge_submissions where event_id = :'event_id'::uuid and team_id = :'team_id'::uuid and judge_user_id = :'judge_id'::uuid`), { event_id: eventId, team_id: activeTeamId, judge_id: judgeUserId }, { role: "authenticated", userId: judgeUserId }) : null;
    const scores = submission ? await runPostgresTestJson<JudgeWorkspaceScore[]>(postgresRowsJson(`select criterion_id as "criterionId", score from public.judge_scores where submission_id = :'submission_id'::uuid`), { submission_id: submission.id }, { role: "authenticated", userId: judgeUserId }) : [];
    return { eventId, activeTeamId, assignedTeamIds, criteria: criteria.map((criterion) => ({ ...criterion, maxScore: Number(criterion.maxScore), order: Number(criterion.order) })), submissionId: submission?.id ?? null, status: submission?.status ?? "NOT_STARTED", scores: scores.map((score) => ({ ...score, score: Number(score.score) })), submittedAt: submission?.submittedAt ?? null };
  }
  async saveDraft(eventId: string, teamId: string, scores: JudgeWorkspaceScore[]) {
    const userId = await getPostgresTestRequestUserId();
    await runPostgresTestJson(postgresOneJson(`select saved.id from public.save_judge_scores(:'event_id'::uuid, :'team_id'::uuid, :'scores'::jsonb) saved`), { event_id: eventId, team_id: teamId, scores: JSON.stringify(scores) }, { role: "authenticated", userId });
    return this.getWorkspace(eventId, teamId, userId);
  }
  async submit(eventId: string, teamId: string) {
    const userId = await getPostgresTestRequestUserId();
    await runPostgresTestJson(postgresOneJson(`select saved.id from public.submit_judge_scores(:'event_id'::uuid, :'team_id'::uuid) saved`), { event_id: eventId, team_id: teamId }, { role: "authenticated", userId });
    return this.getWorkspace(eventId, teamId, userId);
  }
  async getProgress(eventId: string): Promise<JudgeProgress[]> {
    const userId = await getPostgresTestRequestUserId();
    const rows = await runPostgresTestJson<JudgeProgress[]>(postgresRowsJson(`
      select assignment.judge_user_id as id,
        count(*) filter (where submission.status = 'SUBMITTED')::int as completed,
        count(*)::int as total
      from public.judge_assignments assignment
      left join public.judge_submissions submission on submission.event_id = assignment.event_id
        and submission.team_id = assignment.team_id and submission.judge_user_id = assignment.judge_user_id
      where assignment.event_id = :'event_id'::uuid and assignment.active
      group by assignment.judge_user_id order by assignment.judge_user_id
    `), { event_id: eventId }, { role: "authenticated", userId });
    return rows.map((row) => ({ ...row, completed: Number(row.completed), total: Number(row.total) }));
  }
  async unlock(submissionId: string, reason: string) {
    const userId = await getPostgresTestRequestUserId();
    try {
      return await runPostgresTestJson<Record<string, unknown>>(postgresOneJson(`select unlocked.* from public.unlock_judge_submission(:'submission_id'::uuid, :'reason') unlocked`), { submission_id: submissionId, reason }, { role: "authenticated", userId });
    } catch (error) {
      if (messageOf(error).includes("RESULT_FINALIZED")) throw new DomainError("EVENT_CLOSED", "결과 확정 이후에는 잠금을 해제할 수 없습니다.", 409);
      throw error;
    }
  }
}

function toTeam(row: Team): Team {
  const profile = finalistProfileForName(row.name);
  return { ...row, leaderName: profile?.leaderName ?? null, memberNames: profile?.memberNames ?? [], topic: profile?.topic ?? null, promotionEnabled: Boolean(profile), order: Number(row.order), status: row.status === "READY" ? "READY" : row.status };
}

export class PostgresTestTeamRepository implements TeamRepository {
  async getTeams(eventId: string) {
    const rows = await runPostgresTestJson<Team[]>(postgresRowsJson(`select id, name, presentation_order as "order", category, case when status = 'WAITING' then 'READY' else status::text end as status, active, null::text as "leaderName", '[]'::jsonb as "memberNames", null::text as topic, false as "promotionEnabled" from public.teams where event_id = :'event_id'::uuid order by presentation_order`), { event_id: eventId }, { role: "service_role" });
    return rows.map(toTeam);
  }
  async updateTeam(update: TeamUpdate) {
    const userId = await getPostgresTestRequestUserId();
    const row = await runPostgresTestJson<Team | null>(postgresOneJson(`update public.teams set name = nullif(trim(:'name'), ''), presentation_order = :'order'::int, category = :'category'::public.team_category, status = :'status'::public.team_status, active = :'active'::boolean where id = :'id'::uuid and event_id = :'event_id'::uuid returning id, name, presentation_order as "order", category, case when status = 'WAITING' then 'READY' else status::text end as status, active, null::text as "leaderName", '[]'::jsonb as "memberNames", null::text as topic, false as "promotionEnabled"`), { id: update.id, event_id: update.eventId, name: update.name ?? "", order: update.order, category: update.category, status: update.status === "READY" ? "WAITING" : update.status, active: String(update.active) }, { role: "authenticated", userId });
    if (!row) throw new DomainError("DATABASE_ERROR", "참가팀을 저장하지 못했습니다.", 500);
    return toTeam(row);
  }
}

export class PostgresTestPrizeRepository implements PrizeRepository {
  async getHistory(eventId: string): Promise<PrizeRecord[]> {
    const rows = await runPostgresTestJson<PrizeRecord[]>(postgresRowsJson(`select draw.round, participant.participant_code as "participantId", draw.drawn_at as "drawnAt" from public.prize_draws draw join public.participants participant on participant.id = draw.participant_id where draw.event_id = :'event_id'::uuid and draw.status = 'ACTIVE' order by draw.round`), { event_id: eventId }, { role: "service_role" });
    return rows.map((row) => ({ ...row, round: Number(row.round) }));
  }
  async draw(eventId: string): Promise<PrizeRecord> {
    const userId = await getPostgresTestRequestUserId();
    const row = await runPostgresTestJson<PrizeRecord | null>(postgresOneJson(`select result.round, result.participant_code as "participantId", result.drawn_at as "drawnAt" from public.draw_prize_winner(:'event_id'::uuid) result`), { event_id: eventId }, { role: "authenticated", userId });
    if (!row) throw new DomainError("NOT_FOUND", "추첨 가능한 참가자가 없습니다.", 409);
    return { ...row, round: Number(row.round) };
  }
}

export class PostgresTestPrizeCatalogRepository implements PrizeCatalogRepository {
  async getCatalog(eventId: string) {
    const rows = await runPostgresTestJson<PrizeDefinition[]>(postgresRowsJson(`select id, rank, name, image_url as "imageUrl", quantity, winner_count as "winnerCount", status, draw_status as "drawStatus" from public.prize_catalog where event_id = :'event_id'::uuid order by rank`), { event_id: eventId }, { role: "service_role" });
    return rows.map((row) => ({ ...row, rank: Number(row.rank), quantity: row.quantity === null ? null : Number(row.quantity), winnerCount: row.winnerCount === null ? null : Number(row.winnerCount) }));
  }
  async updatePrize(update: PrizeDefinitionUpdate) {
    const userId = await getPostgresTestRequestUserId();
    const row = await runPostgresTestJson<PrizeDefinition | null>(postgresOneJson(`update public.prize_catalog set name = nullif(trim(:'name'), ''), image_url = nullif(trim(:'image_url'), ''), quantity = nullif(:'quantity', '')::int, winner_count = nullif(:'winner_count', '')::int, status = :'status', draw_status = :'draw_status' where id = :'id'::uuid and event_id = :'event_id'::uuid returning id, rank, name, image_url as "imageUrl", quantity, winner_count as "winnerCount", status, draw_status as "drawStatus"`), { id: update.id, event_id: update.eventId, name: update.name ?? "", image_url: update.imageUrl ?? "", quantity: update.quantity, winner_count: update.winnerCount, status: update.status, draw_status: update.drawStatus }, { role: "authenticated", userId });
    if (!row) throw new DomainError("DATABASE_ERROR", "경품 정보를 저장하지 못했습니다.", 500);
    return row;
  }
}
