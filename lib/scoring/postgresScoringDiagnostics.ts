import "server-only";

import type {
  Assignment,
  Criterion,
  Score,
  Submission,
  Team,
  Vote,
} from "@/features/scoring/lib/scoringDiagnostics";
import { DomainError } from "@/lib/errors/domainError";
import { runPostgresTestReadJson } from "@/lib/integration/postgresTest";

export type ScoringDiagnosticsInput = {
  teams: Team[];
  criteria: Criterion[];
  assignments: Assignment[];
  submissions: Submission[];
  scores: Score[];
  votes: Vote[];
};

type PostgresDiagnosticsPayload = ScoringDiagnosticsInput & {
  eventExists: boolean;
  integrity: {
    duplicateAssignments: boolean;
    duplicateSubmissions: boolean;
    duplicateScores: boolean;
  };
};

const diagnosticsQuery = `
select jsonb_build_object(
  'eventExists', exists (
    select 1 from public.events event where event.id = :'event_id'::uuid
  ),
  'teams', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', team.id,
      'name', coalesce(team.name, '미등록 팀 ' || team.presentation_order::text)
    ) order by team.presentation_order)
    from public.teams team
    where team.event_id = :'event_id'::uuid and team.active = true
  ), '[]'::jsonb),
  'criteria', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', criterion.id,
      'max_score', criterion.max_score,
      'weight', criterion.weight
    ) order by criterion.order_index)
    from public.evaluation_criteria criterion
    where criterion.event_id = :'event_id'::uuid
      and criterion.scope = 'JUDGE'
      and criterion.active = true
  ), '[]'::jsonb),
  'assignments', coalesce((
    select jsonb_agg(jsonb_build_object(
      'team_id', assignment.team_id,
      'judge_user_id', assignment.judge_user_id
    ) order by assignment.team_id, assignment.judge_user_id)
    from public.judge_assignments assignment
    where assignment.event_id = :'event_id'::uuid and assignment.active = true
  ), '[]'::jsonb),
  'submissions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', submission.id,
      'team_id', submission.team_id,
      'judge_user_id', submission.judge_user_id,
      'status', submission.status
    ) order by submission.team_id, submission.judge_user_id)
    from public.judge_submissions submission
    where submission.event_id = :'event_id'::uuid
  ), '[]'::jsonb),
  'scores', coalesce((
    select jsonb_agg(jsonb_build_object(
      'submission_id', score.submission_id,
      'criterion_id', score.criterion_id,
      'score', score.score
    ) order by score.submission_id, score.criterion_id)
    from public.judge_scores score
    join public.judge_submissions submission on submission.id = score.submission_id
    where submission.event_id = :'event_id'::uuid
  ), '[]'::jsonb),
  'votes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'team_id', vote.team_id,
      'vote_count', vote.vote_count,
      'eligibility_count', vote.eligibility_count
    ) order by vote.team_id)
    from public.get_audience_vote_snapshot(:'event_id'::uuid) vote
  ), '[]'::jsonb),
  'integrity', jsonb_build_object(
    'duplicateAssignments', exists (
      select 1 from public.judge_assignments assignment
      where assignment.event_id = :'event_id'::uuid and assignment.active = true
      group by assignment.team_id, assignment.judge_user_id having count(*) > 1
    ),
    'duplicateSubmissions', exists (
      select 1 from public.judge_submissions submission
      where submission.event_id = :'event_id'::uuid
      group by submission.team_id, submission.judge_user_id having count(*) > 1
    ),
    'duplicateScores', exists (
      select 1 from public.judge_scores score
      join public.judge_submissions submission on submission.id = score.submission_id
      where submission.event_id = :'event_id'::uuid
      group by score.submission_id, score.criterion_id having count(*) > 1
    )
  )
)::text;
`;

/** PostgreSQL-only adapter used by the isolated `postgres-test` runtime. */
export async function readPostgresScoringDiagnostics(
  eventId: string,
  actorUserId: string,
): Promise<ScoringDiagnosticsInput> {
  const payload = await runPostgresTestReadJson<PostgresDiagnosticsPayload>(
    diagnosticsQuery,
    { event_id: eventId },
    actorUserId,
  );

  if (!payload.eventExists) {
    throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
  }
  if (Object.values(payload.integrity).some(Boolean)) {
    throw new DomainError("DATABASE_ERROR", "중복 평가 데이터가 감지되어 진단을 중단했습니다.", 500);
  }

  return {
    teams: payload.teams,
    criteria: payload.criteria,
    assignments: payload.assignments,
    submissions: payload.submissions,
    scores: payload.scores,
    votes: payload.votes,
  };
}
