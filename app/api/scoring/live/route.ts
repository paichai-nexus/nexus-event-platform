import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { toErrorResponse } from "@/lib/errors/domainError";
import { getPaperJudgeScores } from "@/lib/judging/paperJudgeScoreStore";
import { getTeamRepository } from "@/lib/repositories/repositoryFactory";
import { calculateJudgeOnlyRows } from "@/features/scoring/lib/judgeOnlyTotals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const eventId = z.string().uuid().parse(new URL(request.url).searchParams.get("eventId"));
    const [teams, paperScores] = await Promise.all([
      getTeamRepository().getTeams(eventId),
      getPaperJudgeScores(eventId),
    ]);
    const rows = calculateJudgeOnlyRows(teams, paperScores);
    return Response.json({
      ok: true,
      data: {
        maxScore: 600,
        judgeCount: 3,
        audienceIncluded: false,
        teams: rows,
        fullySubmittedTeams: rows.filter(row => row.complete).length,
        totalTeams: rows.length,
        allComplete: rows.length > 0 && rows.every(row => row.complete),
        updatedAt: new Date().toISOString(),
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
