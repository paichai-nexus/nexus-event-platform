import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { importTeamRoster } from "@/lib/teams/teamRosterImportStore";
const row = z.object({ order: z.number().int().min(1).max(19), category: z.enum(["STARTUP", "BUSINESS_ANALYSIS"]), name: z.string().trim().min(1).max(100), department: z.string().trim().min(1).max(100), leaderName: z.string().trim().min(1).max(100), memberNames: z.array(z.string().trim().min(1).max(100)).min(1).max(20), advisorName: z.string().trim().min(1).max(100), topic: z.string().trim().min(1).max(300), active: z.boolean() });
const input = z.object({ eventId: z.string().uuid(), rows: z.array(row).length(19) });
export async function POST(request: Request) { try { await authorizeRoles(["ADMIN"]); const parsed = input.safeParse(await request.json()); if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "최종 팀 명단 19개 항목을 확인해주세요.", 422); return Response.json({ ok: true, data: await importTeamRoster(parsed.data.eventId, parsed.data.rows) }); } catch (error) { return toErrorResponse(error); } }
