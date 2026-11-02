import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import {
  getMockAudienceReservations,
  importMockAudienceReservations,
  setMockAudiencePaperSigned,
} from "@/lib/audience-jury/mockAudienceReservationStore";
import {
  getSupabaseAudienceReservations,
  importSupabaseAudienceReservations,
  setSupabaseAudiencePaperSigned,
} from "@/lib/audience-jury/supabaseAudienceJuryStore";
import { AUDIENCE_JURY_DEPARTMENTS } from "@/types/audience-jury";

const rowSchema = z.object({
  department: z.enum(AUDIENCE_JURY_DEPARTMENTS),
  name: z.string().trim().min(2).max(30),
  studentNumber: z.string().trim().regex(/^[0-9A-Za-z-]{5,20}$/),
});
const importSchema = z.object({ eventId: z.string().uuid().optional(), rows: z.array(rowSchema).min(1).max(500) });
const updateSchema = z.object({ eventId: z.string().uuid().optional(), id: z.string().uuid(), paperSigned: z.boolean() });

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
    const mock = isMockRuntime();
    const data = mock ? getMockAudienceReservations(eventId) : await getSupabaseAudienceReservations(eventId);
    return Response.json({ ok: true, storage: mock ? "MOCK" : "SUPABASE", data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const input = importSchema.parse(await request.json());
    const mock = isMockRuntime();
    const data = mock
      ? importMockAudienceReservations(input.rows, input.eventId)
      : await importSupabaseAudienceReservations(input.rows, input.eventId);
    return Response.json({ ok: true, storage: mock ? "MOCK" : "SUPABASE", data });
  } catch (error) {
    if (error instanceof z.ZodError) return toErrorResponse(new DomainError("VALIDATION_ERROR", "예약자 파일의 이름·학과·학번 형식을 확인해주세요.", 422));
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const input = updateSchema.parse(await request.json());
    const mock = isMockRuntime();
    const data = mock
      ? setMockAudiencePaperSigned(input.id, input.paperSigned, input.eventId)
      : await setSupabaseAudiencePaperSigned(input.id, input.paperSigned, input.eventId);
    return Response.json({ ok: true, storage: mock ? "MOCK" : "SUPABASE", data });
  } catch (error) {
    if (error instanceof z.ZodError) return toErrorResponse(new DomainError("VALIDATION_ERROR", "서명 처리 요청을 확인해주세요.", 422));
    return toErrorResponse(error);
  }
}
