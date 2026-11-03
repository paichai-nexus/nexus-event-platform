import { NextResponse } from "next/server";
import { z } from "zod";
import { AUDIENCE_SESSION_COOKIE } from "@/lib/attendance/sessionCookie";
import { AUDIENCE_JURY_AUTH_COOKIE, readAudienceJuryAuthToken } from "@/lib/audience-jury/authCookie";
import { authenticateMockAudienceJury, verifyMockAudienceJuryAuth } from "@/lib/audience-jury/mockAudienceJuryStore";
import { authenticateSupabaseAudienceJury, verifySupabaseAudienceJuryAuth } from "@/lib/audience-jury/supabaseAudienceBallotStore";
import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";

const credentialsSchema = z.object({
  eventId: z.string().uuid().optional(),
  studentNumber: z.string().trim().min(5).max(20),
  name: z.string().trim().min(2).max(30),
  serialNumber: z.string().trim().regex(/^PCU-(?:1(?:0[1-9]|[1-9][0-9])|2(?:0[0-9]|1[0-9]|20))$/i),
});

function authenticatedResponse(data: unknown, token: string) {
  const response = NextResponse.json({ ok: true, data });
  const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 };
  response.cookies.set(AUDIENCE_SESSION_COOKIE, token, options);
  response.cookies.set(AUDIENCE_JURY_AUTH_COOKIE, token, options);
  return response;
}

export async function GET(request: Request) {
  try {
    const token = readAudienceJuryAuthToken(request);
    const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
    const registration = token
      ? (isMockRuntime() ? verifyMockAudienceJuryAuth(token, eventId) : await verifySupabaseAudienceJuryAuth(token, eventId))
      : null;
    return NextResponse.json({ ok: true, data: { authenticated: Boolean(registration), registration } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = credentialsSchema.parse(await request.json());
    if (isMockRuntime()) {
      const result = authenticateMockAudienceJury(input, input.eventId);
      return authenticatedResponse({ authenticated: true, registration: result.registration }, result.token);
    }
    const token = crypto.randomUUID();
    const registration = await authenticateSupabaseAudienceJury(input, token, input.eventId);
    return authenticatedResponse({ authenticated: true, registration }, token);
  } catch (error) {
    if (error instanceof z.ZodError) return toErrorResponse(new DomainError("VALIDATION_ERROR", "이름, 학번과 시리얼 번호를 확인해주세요.", 422));
    return toErrorResponse(error);
  }
}
