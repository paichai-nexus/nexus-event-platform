import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getEventControlRepository, getJudgeRepository } from "@/lib/repositories/repositoryFactory";
import { isSupabaseConfigured } from "@/lib/config/runtime";

const scoreSchema = z.object({ criterionId: z.string().uuid(), score: z.number().finite().min(0) });
const teamIdSchema = z.string().trim().min(1).max(100);
const saveSchema = z.object({ eventId: z.string().uuid(), teamId: teamIdSchema, scores: z.array(scoreSchema).max(100) });
const submitSchema = z.object({ eventId: z.string().uuid(), teamId: teamIdSchema });

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const workspace = url.searchParams.get("view") === "workspace";
    const actor = workspace ? await authorizeRoles(["JUDGE"]) : await authorizeRoles(["ADMIN", "STAFF"]);
    const requestedEventId = url.searchParams.get("eventId") ?? undefined;
    const event = await getEventControlRepository().getSnapshot(requestedEventId);
    if (workspace) {
      const data = await getJudgeRepository().getWorkspace(event.eventId, event.activeTeamId, actor.userId);
      return Response.json({ ok: true, storage: isSupabaseConfigured() ? "DATABASE" : "MOCK", data });
    }
    const data = await getJudgeRepository().getProgress(event.eventId);
    return Response.json({ ok: true, storage: isSupabaseConfigured() ? "DATABASE" : "MOCK", data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    await authorizeRoles(["JUDGE"]);
    const parsed = saveSchema.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "심사 점수를 확인해주세요.", 422);
    const data = await getJudgeRepository().saveDraft(parsed.data.eventId, parsed.data.teamId, parsed.data.scores);
    return Response.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await authorizeRoles(["JUDGE"]);
    const parsed = submitSchema.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "심사 제출 대상을 확인해주세요.", 422);
    const data = await getJudgeRepository().submit(parsed.data.eventId, parsed.data.teamId);
    return Response.json({ ok: true, data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
