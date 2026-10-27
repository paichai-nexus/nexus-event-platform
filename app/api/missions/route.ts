import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getMissionRepository } from "@/lib/repositories/repositoryFactory";

const eventIdSchema = z.string().uuid();
const inputShape = { title: z.string().trim().min(1).max(100), description: z.string().trim().max(500), type: z.enum(["DEPARTMENT_INTRO", "TEAM_SUPPORT", "BUSINESS_QUIZ", "OX_QUIZ", "APPLAUSE_EXPERIMENT"]), points: z.number().int().min(0).max(10000), status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]), experimental: z.boolean() } as const;
const enforceExperimentalApplause = (input: z.infer<z.ZodObject<typeof inputShape>>, context: z.RefinementCtx) => {
  if (input.type === "APPLAUSE_EXPERIMENT" && !input.experimental) {
    context.addIssue({ code: "custom", path: ["experimental"], message: "박수 이벤트는 실험 기능으로만 저장할 수 있습니다." });
  }
};
const createSchema = z.object({ ...inputShape, eventId: eventIdSchema }).superRefine(enforceExperimentalApplause);
const updateSchema = z.object({ ...inputShape, eventId: eventIdSchema, id: z.string().min(1) }).superRefine(enforceExperimentalApplause);
const reviewSchema = z.object({ eventId: eventIdSchema, participationId: z.string().min(1), reviewStatus: z.enum(["APPROVED", "REJECTED"]) });

export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { await authorizeRoles(["ADMIN", "STAFF"]); const eventId = eventIdSchema.safeParse(new URL(request.url).searchParams.get("eventId")); if (!eventId.success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 필요합니다.", 422); return Response.json({ ok: true, data: await getMissionRepository().getAll(eventId.data) }); } catch (error) { return toErrorResponse(error); } }
export async function POST(request: Request) { try { await authorizeRoles(["ADMIN", "STAFF"]); const parsed = createSchema.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "미션 입력값을 확인해주세요.", 422); const { eventId, ...input } = parsed.data; return Response.json({ ok: true, data: await getMissionRepository().create(eventId, input) }); } catch (error) { return toErrorResponse(error); } }
export async function PATCH(request: Request) { try { await authorizeRoles(["ADMIN", "STAFF"]); const body = await request.json(); const review = reviewSchema.safeParse(body); if (review.success) return Response.json({ ok: true, data: await getMissionRepository().reviewParticipation(review.data.eventId, review.data.participationId, review.data.reviewStatus) }); const parsed = updateSchema.safeParse(body); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "미션 입력값을 확인해주세요.", 422); const { eventId, id, ...input } = parsed.data; return Response.json({ ok: true, data: await getMissionRepository().update(eventId, id, input) }); } catch (error) { return toErrorResponse(error); } }
