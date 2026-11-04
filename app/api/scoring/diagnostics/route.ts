import { authorizeRoles } from "@/lib/auth/authorize";
import { requireRuntimeMode } from "@/lib/config/runtime";
import { toErrorResponse } from "@/lib/errors/domainError";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { summarizeScoringDiagnostics } from "@/features/scoring/lib/scoringDiagnostics";
import { readPostgresScoringDiagnostics } from "@/lib/scoring/postgresScoringDiagnostics";

export const dynamic = "force-dynamic";

/** Admin-only informational endpoint; never publishes or finalizes results. */
export async function GET(request: Request) {
  try {
    const actor = await authorizeRoles(["ADMIN", "STAFF"]);
    const eventId = new URL(request.url).searchParams.get("eventId");
    if (!eventId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
      return Response.json({ ok: false, error: "VALID_EVENT_ID_REQUIRED" }, { status: 400 });
    }
    const runtimeMode = requireRuntimeMode();
    if (runtimeMode === "postgres-test") {
      const input = await readPostgresScoringDiagnostics(eventId, actor.userId);
      const report = summarizeScoringDiagnostics(input);
      return Response.json(
        { ok: true, runtimeMode, eventId, ...report },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }
    const db = await createSupabaseServerClient();
    if (!db) return Response.json({ ok: false, error: "DATABASE_UNAVAILABLE" }, { status: 503 });
    const [teams, criteria, assignments, submissions, votes, paperScores] = await Promise.all([
      db.from("teams").select("id,name,category,presentation_order").eq("event_id", eventId).eq("active", true).order("presentation_order"),
      db.from("evaluation_criteria").select("id,max_score,weight").eq("event_id", eventId).eq("scope", "JUDGE").eq("active", true),
      db.from("judge_assignments").select("team_id,judge_user_id").eq("event_id", eventId).eq("active", true),
      db.from("judge_submissions").select("id,team_id,judge_user_id,status").eq("event_id", eventId),
      db.rpc("get_audience_vote_snapshot", { p_event_id: eventId }),
      db.from("paper_judge_scores").select("team_id,judge_slot,total_score,status").eq("event_id", eventId),
    ]);
    if ([teams,criteria,assignments,submissions,votes,paperScores].some((x) => x.error)) {
      return Response.json({ ok: false, error: "SCORING_READ_FAILED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const ids = (submissions.data ?? []).map((s) => s.id);
    // PostgREST .in([]) is backend-dependent; avoid issuing it for empty submissions.
    const scores = ids.length
      ? await db.from("judge_scores").select("submission_id,criterion_id,score").in("submission_id", ids)
      : { data: [], error: null };
    if (scores.error) return Response.json({ ok: false, error: "SCORING_READ_FAILED" }, { status: 503 });
    const report = summarizeScoringDiagnostics({
      teams: teams.data ?? [], criteria: criteria.data ?? [], assignments: assignments.data ?? [],
      submissions: submissions.data ?? [], scores: scores.data ?? [], votes: votes.data ?? [], paperScores: paperScores.data ?? [],
    });
    return Response.json({ ok: true, runtimeMode, eventId, ...report }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
