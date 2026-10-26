import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getPromoVideoRepository } from "@/lib/repositories/repositoryFactory";
const eventIdSchema = z.string().uuid();
const inputSchema = z.object({ eventId: eventIdSchema, videoUrl: z.string().url(), thumbnailUrl: z.union([z.string().url(), z.literal(""), z.null()]).transform((value) => value || null), title: z.string().trim().min(1).max(100), active: z.boolean() });
export const dynamic = "force-dynamic";
export async function GET(request: Request) { try { const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined; if (eventId && !eventIdSchema.safeParse(eventId).success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 올바르지 않습니다.", 422); return Response.json({ ok: true, data: await getPromoVideoRepository().get(eventId) }); } catch (error) { return toErrorResponse(error); } }
export async function PUT(request: Request) { try { await authorizeRoles(["ADMIN", "STAFF"]); const parsed = inputSchema.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "영상 URL과 제목을 확인해주세요.", 422); const { eventId, ...input } = parsed.data; return Response.json({ ok: true, data: await getPromoVideoRepository().save(eventId, input) }); } catch (error) { return toErrorResponse(error); } }
