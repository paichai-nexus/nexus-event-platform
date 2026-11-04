import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { toErrorResponse } from "@/lib/errors/domainError";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Team = {
  id: string;
  name: string | null;
  category: string;
  presentation_order: number;
};

type JudgeScore = {
  team_id: string;
  judge_slot: number;
  total_score: number;
  status: string;
};

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);

    const eventId = z.string().uuid().parse(
      new URL(request.url).searchParams.get("eventId")
    );

    const db = createSupabaseAdminClient();

    if (!db) {
      return NextResponse.json(
        { ok: false, error: "DATABASE_UNAVAILABLE" },
        { status: 503 }
      );
    }

    const [teamsResult, scoresResult] = await Promise.all([
      db.from("teams")
        .select("id,name,category,presentation_order")
        .eq("event_id", eventId)
        .eq("active", true),

      db.from("paper_judge_scores")
        .select("team_id,judge_slot,total_score,status")
        .eq("event_id", eventId),
    ]);

    if (teamsResult.error || scoresResult.error) {
      return NextResponse.json(
        { ok: false, error: "SCORING_READ_FAILED" },
        { status: 503 }
      );
    }

    const teams = (teamsResult.data ?? []) as Team[];
    const scores = (scoresResult.data ?? []) as JudgeScore[];

    const rows = teams.map((team) => {
      const slots: Array<number | null> = [null, null, null];

      for (const score of scores) {
        if (
          score.team_id !== team.id ||
          score.status !== "SUBMITTED" ||
          !Number.isInteger(score.judge_slot) ||
          score.judge_slot < 1 ||
          score.judge_slot > 3
        ) continue;

        const value = Number(score.total_score);
        if (!Number.isFinite(value) || value < 0 || value > 200) {
          continue;
        }

        slots[score.judge_slot - 1] = value;
      }

      const submitted = slots.filter(
        (score) => score !== null
      ).length;

      const complete = submitted === 3;

      const total = complete
        ? slots.reduce<number>(
            (sum, score) => sum + (score ?? 0), 0
          )
        : null;

      return {
        id: team.id,
        name: team.name ?? "팀명 미등록",
        category: team.category,
        order: team.presentation_order,
        judgeSlots: slots,
        submittedJudges: submitted,
        total,
        complete,
        rank: null as number | null,
      };
    });

    for (const category of new Set(rows.map(r => r.category))) {
      const categoryRows = rows
        .filter(r => r.category === category && r.total !== null)
        .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));

      categoryRows.forEach((row) => {
        row.rank = categoryRows.findIndex(
          other => other.total === row.total
        ) + 1;
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        maxScore: 600,
        judgeCount: 3,
        audienceIncluded: false,
        teams: rows,
        updatedAt: new Date().toISOString(),
      }
    }, {
      headers: { "Cache-Control": "private, no-store" }
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
