import { createHash } from "node:crypto";
import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { getCeremonyControl } from "@/lib/ceremony/ceremonyControlStore";
import { getRuntimePolicy, isMockRuntime } from "@/lib/config/runtime";
import { canonicalJson, summarizeReservations } from "@/lib/export/operationalExport";
import { summarizeScoringPolicy } from "@/lib/export/operationalExport";
import { SCORING_POLICY_READY } from "@/features/scoring/data/evaluationPolicy";
import { getPaperJudgeScores } from "@/lib/judging/paperJudgeScoreStore";
import { getMockAudienceReservations } from "@/lib/audience-jury/mockAudienceReservationStore";
import { getSupabaseAudienceReservations } from "@/lib/audience-jury/supabaseAudienceJuryStore";
import { getMockPrizeInventory, getSupabasePrizeInventory } from "@/lib/prize/prizeInventoryStore";
import { getPrizeStages } from "@/lib/prize/prizeStageStore";
import { getEventControlRepository, getTeamRepository } from "@/lib/repositories/repositoryFactory";
import { getResultShowDeck } from "@/lib/results/resultShowStore";
import { getScoringPolicy } from "@/lib/scoring/scoringPolicyStore";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";

const eventIdSchema = z.string().uuid();
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN"]);
    const eventId = eventIdSchema.safeParse(new URL(request.url).searchParams.get("eventId"));
    if (!eventId.success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 필요합니다.", 422);
    const mock = isMockRuntime();
    const [event, teams, reservationData, prizes, prizeStages, paperScores, resultShow, ceremony, scoringPolicy] = await Promise.all([
      getEventControlRepository().getSnapshot(eventId.data), getTeamRepository().getTeams(eventId.data),
      mock ? getMockAudienceReservations(eventId.data) : getSupabaseAudienceReservations(eventId.data),
      mock ? getMockPrizeInventory() : getSupabasePrizeInventory(eventId.data), getPrizeStages(eventId.data),
      getPaperJudgeScores(eventId.data), getResultShowDeck(eventId.data), getCeremonyControl(eventId.data), getScoringPolicy(eventId.data),
    ]);
    const data = { event, teams, audience: summarizeReservations(reservationData.rows), prizes, prizeStages, paperScores, resultShow, ceremony, scoringPolicy: summarizeScoringPolicy(scoringPolicy, SCORING_POLICY_READY) };
    const digest = createHash("sha256").update(canonicalJson(data)).digest("hex");
    const generatedAt = new Date().toISOString();
    const body = { schemaVersion: 2, exportType: "REDACTED_OPERATIONAL_SNAPSHOT", generatedAt, runtimeMode: getRuntimePolicy().mode, integrity: { algorithm: "SHA-256", digest }, data };
    const date = generatedAt.slice(0, 10).replaceAll("-", "");
    return Response.json(body, { headers: { "Cache-Control": "no-store, max-age=0", "Content-Disposition": `attachment; filename="nexus-operational-${date}.json"`, "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return toErrorResponse(error); }
}
