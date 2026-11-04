import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { toErrorResponse } from "@/lib/errors/domainError";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const eventIdSchema = z.string().uuid();

type DbTeam = { id: string; name: string | null; category: string; presentation_order: number };
type DbJudge = { team_id: string; judge_slot: number; total_score: number; status: string };
type DbBallot = { category: string; first_team_id: string; second_team_id: string };

/**
 * Authorized, read-only live scoreboard. No votes, scores, event state, or
 * official results are written, finalized, or published by this endpoint.
 * IMPORTANT: Raw rank ballots have no approved conversion formula in schema 016.
 */
export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const parsed = eventIdSchema.safeParse(new URL(request.url).searchParams.get("eventId"));
    if (!parsed.success) return NextResponse.json({ ok: false, error: "VALID_EVENT_ID_REQUIRED" }, { status: 400 });
    const eventId = parsed.data;
    const db = createSupabaseAdminClient();
    if (!db) {
      return NextResponse.json(
        { ok: false, error: "DATABASE_UNAVAILABLE" },
        { status: 503 }
      );
    }
    const [eventResult, teamResult, judgesResult, ballotsResult, policyResult, juryResult] = await Promise.all([
      db.from("events").select("id,name,mode,status,result_status").eq("id", eventId).single(),
      db.from("teams").select("id,name,category,presentation_order").eq("event_id", eventId).eq("active", true).order("presentation_order", { ascending: true }),
      db.from("paper_judge_scores").select("team_id,judge_slot,total_score,status").eq("event_id", eventId),
      db.from("audience_rank_ballots").select("category,first_team_id,second_team_id").eq("event_id", eventId),
      db.from("scoring_policy_versions").select("status,professional_weight,audience_weight,audience_conversion_rule,tie_break_rule,category_aggregation_rule").eq("event_id", eventId).eq("status", "APPROVED").limit(1),
      db.from("audience_jury_reservations").select("id", { count: "exact", head: true }).eq("event_id", eventId).not("pcu_code", "is", null),
    ]);
    if (eventResult.error || teamResult.error || judgesResult.error || ballotsResult.error || policyResult.error || juryResult.error) {
      console.error("SCORING_LIVE_READ_FAILED", {
        event: eventResult.error?.code, teams: teamResult.error?.code,
        judges: judgesResult.error?.code, ballots: ballotsResult.error?.code,
        policy: policyResult.error?.code, jury: juryResult.error?.code,
      });
      return NextResponse.json({ ok: false, error: "LIVE_SCORING_READ_FAILED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    const teams = (teamResult.data ?? []) as DbTeam[];
    const judges = (judgesResult.data ?? []) as DbJudge[];
    const ballots = (ballotsResult.data ?? []) as DbBallot[];
    const approvedPolicy = policyResult.data?.[0] ?? null;
    const ballotCountByCategory = new Map<string, number>();
    for (const b of ballots) ballotCountByCategory.set(b.category, (ballotCountByCategory.get(b.category) ?? 0) + 1);
    const results = teams.map((team) => {
      const slots: Array<number | null> = [null, null, null];
      let draftCount = 0;
      for (const score of judges) {
        if (score.team_id !== team.id || !Number.isInteger(score.judge_slot) || score.judge_slot < 1 || score.judge_slot > 3) continue;
        if (score.status === "SUBMITTED") slots[score.judge_slot - 1] = Number(score.total_score);
        else draftCount++;
      }
      const first = ballots.filter((b) => b.first_team_id === team.id).length;
      const second = ballots.filter((b) => b.second_team_id === team.id).length;
      const categoryBallots = ballotCountByCategory.get(team.category) ?? 0;
      const submittedJudges = slots.filter((v) => v !== null).length;
      const judgeRaw = slots.reduce<number>((sum, v) => sum + (v ?? 0), 0);
      // TRANSPARENT ILLUSTRATION ONLY: 1st=2pts, 2nd=1pt, scaled to 20.
      // This is NOT the committee-approved score-conversion rule.
      const audienceIllustration = categoryBallots > 0 ? (first * 2 + second) / (2 * categoryBallots) * 20 : null;
      const judgeIllustration = submittedJudges === 3 ? judgeRaw / 600 * 80 : null;
      const illustrativeTotal = judgeIllustration !== null && audienceIllustration !== null
        ? Math.round((judgeIllustration + audienceIllustration) * 100) / 100 : null;
      return {
        id: team.id, name: team.name ?? "팀명 미등록", category: team.category,
        order: team.presentation_order, judgeSlots: slots,
        submittedJudges, draftCount, judgeRaw,
        firstVotes: first, secondVotes: second, categoryBallots,
        audienceIllustration, judgeIllustration, illustrativeTotal,
      };
    });
    return NextResponse.json({
      ok: true,
      data: {
        event: eventResult.data,
        policyApproved: Boolean(approvedPolicy),
        approvedPolicy,
        juryRegistered: juryResult.count ?? 0,
        totalBallots: ballots.length,
        totalSubmittedJudgeForms: judges.filter((j) => j.status === "SUBMITTED").length,
        teams: results,
        updatedAt: new Date().toISOString(),
        illustrativeFormula: "청중 1순위=2점, 2순위=1점 → 카테고리별 투표 수로 정규화한 20점 + 심사위원 3명 총점/600×80점. 정책 미승인 시 공식 점수 아님.",
      },
    }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) { return toErrorResponse(error); }
}
