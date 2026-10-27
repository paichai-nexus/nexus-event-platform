export type Criterion = { id: string; max_score: number | string; weight: number | string };
export type Assignment = { team_id: string; judge_user_id: string };
export type Submission = { id: string; team_id: string; judge_user_id: string; status: string };
export type Score = { submission_id: string; criterion_id: string; score: number | string };
export type Vote = { team_id: string; vote_count: number | string; eligibility_count: number | string };
export type Team = { id: string; name: string };

/** Read-only diagnostics. This deliberately does NOT compute official rankings. */
export function summarizeScoringDiagnostics(input: {
  teams: Team[]; criteria: Criterion[]; assignments: Assignment[];
  submissions: Submission[]; scores: Score[]; votes: Vote[];
}) {
  const criteria = new Map(input.criteria.map((c) => [c.id, c]));
  const expectedMax = input.criteria.reduce((s, c) => s + Number(c.max_score) * Number(c.weight), 0);
  if (!Number.isFinite(expectedMax) || expectedMax < 0) throw new Error("INVALID_CRITERIA");
  const scoredBySubmission = new Map<string, Map<string, number>>();
  for (const score of input.scores) {
    if (!criteria.has(score.criterion_id)) continue;
    const value = Number(score.score);
    if (!Number.isFinite(value)) throw new Error("INVALID_SCORE");
    if (!scoredBySubmission.has(score.submission_id)) scoredBySubmission.set(score.submission_id, new Map());
    scoredBySubmission.get(score.submission_id)!.set(score.criterion_id, value);
  }
  const votes = new Map(input.votes.map((v) => [v.team_id, v]));
  const results = input.teams.map((team) => {
    const assigned = input.assignments.filter((a) => a.team_id === team.id);
    const submitted = input.submissions.filter((s) => s.team_id === team.id && s.status === "SUBMITTED" && assigned.some((a) => a.judge_user_id === s.judge_user_id));
    const complete = submitted.filter((s) => {
      const values = scoredBySubmission.get(s.id);
      return input.criteria.length > 0 && input.criteria.every((c) => values?.has(c.id) && values.get(c.id)! >= 0 && values.get(c.id)! <= Number(c.max_score));
    });
    const ready = expectedMax > 0 && assigned.length > 0 && complete.length === assigned.length && submitted.length === assigned.length;
    const normalizedJudgePreview = ready
      ? Number((complete.reduce((sum, s) => sum + input.criteria.reduce((subtotal, c) => subtotal + scoredBySubmission.get(s.id)!.get(c.id)! * Number(c.weight), 0), 0) / complete.length / expectedMax * 100).toFixed(4))
      : null;
    const vote = votes.get(team.id);
    return {
      teamId: team.id, teamName: team.name,
      assignedJudges: assigned.length, submittedJudges: submitted.length,
      completeJudgeSubmissions: complete.length,
      judgeScorePreview100: normalizedJudgePreview,
      audienceVoteCount: Number(vote?.vote_count ?? 0),
      audienceEligibleCount: Number(vote?.eligibility_count ?? 0),
      readyForPolicyReview: ready,
    };
  });
  return { status: "POLICY_APPROVAL_REQUIRED" as const,
    reasons: ["70:30 vs 80:20 policy conflict", "Audience vote-to-score conversion not approved", "Tie resolution not approved"],
    officialScoresAvailable: false as const, teams: results };
}
