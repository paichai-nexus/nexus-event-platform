import { NextResponse } from "next/server";
import { z } from "zod";
import { AUDIENCE_SESSION_COOKIE, readAudienceSessionToken } from "@/lib/attendance/sessionCookie";
import { getMockAudienceJuryState, registerMockAudienceJury } from "@/lib/audience-jury/mockAudienceJuryStore";
import { getSupabaseAudienceJuryState, registerSupabaseAudienceJury } from "@/lib/audience-jury/supabaseAudienceJuryStore";
import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { AUDIENCE_JURY_DEPARTMENTS } from "@/types/audience-jury";

const eventSchema = z.string().uuid().optional();
const registrationSchema = z.object({
  eventId: eventSchema,
  department: z.enum(AUDIENCE_JURY_DEPARTMENTS),
  studentNumber: z.string().trim().regex(/^[0-9A-Za-z-]{5,20}$/, "학번을 정확히 입력해주세요."),
  name: z.string().trim().min(2, "이름을 입력해주세요.").max(30, "이름이 너무 깁니다.").regex(/^[가-힣A-Za-z\s]+$/, "이름에는 한글 또는 영문만 입력할 수 있습니다."),
});

function tokenFor(request: Request) {
  return readAudienceSessionToken(request) ?? crypto.randomUUID();
}

function response(data: unknown, token: string, storage: "MOCK" | "SUPABASE") {
  const result = NextResponse.json({ ok: true, storage, data });
  result.cookies.set(AUDIENCE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return result;
}

export async function GET(request: Request) {
  try {
    const eventId = eventSchema.parse(new URL(request.url).searchParams.get("eventId") ?? undefined);
    const token = tokenFor(request);
    const mock = isMockRuntime();
    const data = mock ? getMockAudienceJuryState(token, eventId) : await getSupabaseAudienceJuryState(token, eventId);
    return response(data, token, mock ? "MOCK" : "SUPABASE");
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = registrationSchema.parse(await request.json());
    const token = tokenFor(request);
    const mock = isMockRuntime();
    const data = mock
      ? registerMockAudienceJury(token, input, input.eventId)
      : await registerSupabaseAudienceJury(token, input, input.eventId);
    return response(data, token, mock ? "MOCK" : "SUPABASE");
  } catch (error) {
    if (error instanceof z.ZodError) {
      return toErrorResponse(new DomainError("VALIDATION_ERROR", error.issues[0]?.message ?? "신청 정보를 확인해주세요.", 422));
    }
    return toErrorResponse(error);
  }
}
