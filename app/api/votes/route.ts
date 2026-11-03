import { z } from "zod";
import { NextResponse } from "next/server";
import { AUDIENCE_SESSION_COOKIE } from "@/lib/attendance/sessionCookie";
import { readAudienceSessionToken } from "@/lib/attendance/sessionCookie";
import { usesPersistentStorage } from "@/lib/config/runtime";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getVoteRepository } from "@/lib/repositories/repositoryFactory";

const eventSchema = z.string().uuid().optional();

export async function GET(request: Request) {
  try {
    const rawEventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
    const parsedEventId = eventSchema.safeParse(rawEventId);
    if (!parsedEventId.success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 올바르지 않습니다.", 422);
    const eventId = parsedEventId.data;
    const token = readAudienceSessionToken(request) ?? crypto.randomUUID();
    const data = await getVoteRepository().getState(eventId, token);
    const response = NextResponse.json({ ok: true, storage: usesPersistentStorage() ? "DATABASE" : "MOCK", data });
    response.cookies.set(AUDIENCE_SESSION_COOKIE, token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST() {
  return toErrorResponse(new DomainError("FORBIDDEN", "부문별 1·2등 순위 투표 페이지를 이용해주세요.", 403));
}
