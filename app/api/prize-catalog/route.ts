import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getPrizeCatalogRepository } from "@/lib/repositories/repositoryFactory";

const eventIdSchema = z.string().uuid();
const updateSchema = z.object({
  eventId: eventIdSchema,
  id: z.string().min(1),
  rank: z.number().int().min(2).max(12),
  name: z.string().trim().max(120).nullable(),
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).transform((value) => value || null),
  quantity: z.number().int().positive().nullable(),
  winnerCount: z.number().int().positive().nullable(),
  status: z.enum(["UNCONFIRMED", "CONFIRMED"]),
  drawStatus: z.enum(["READY", "IN_PROGRESS", "COMPLETED"]),
}).refine((value) => value.status === "UNCONFIRMED" || Boolean(value.name && value.quantity && value.winnerCount), {
  message: "확정 경품은 상품명·수량·당첨자 수가 필요합니다.",
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const parsed = eventIdSchema.safeParse(new URL(request.url).searchParams.get("eventId"));
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 필요합니다.", 422);
    return Response.json({ ok: true, data: await getPrizeCatalogRepository().getCatalog(parsed.data) });
  } catch (error) { return toErrorResponse(error); }
}

export async function PUT(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const parsed = updateSchema.safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "경품 입력값을 확인해주세요.", 422);
    return Response.json({ ok: true, data: await getPrizeCatalogRepository().updatePrize(parsed.data) });
  } catch (error) { return toErrorResponse(error); }
}
