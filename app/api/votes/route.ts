import { z } from "zod";
import { readAudienceSessionToken } from "@/lib/attendance/sessionCookie";
import { usesPersistentStorage, isMockRuntime } from "@/lib/config/runtime";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getVoteRepository } from "@/lib/repositories/repositoryFactory";

const eventSchema = z.string().uuid().optional();

function requireSession(request: Request) {
  const token = readAudienceSessionToken(request);
  if (!token) throw new DomainError("FORBIDDEN", "현장 입장을 먼저 완료해주세요.", 403);
  return token;
}

function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) {
    if (!isMockRuntime()) throw new DomainError("FORBIDDEN", "요청 출처를 확인할 수 없습니다.", 403);
    return;
  }
  const expectedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  if (new URL(origin).host !== expectedHost) {
    throw new DomainError("FORBIDDEN", "허용되지 않은 요청 출처입니다.", 403);
  }
}

export async function GET(request: Request) {
  try {
    const rawEventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
    const parsedEventId = eventSchema.safeParse(rawEventId);
    if (!parsedEventId.success) throw new DomainError("VALIDATION_ERROR", "행사 식별자가 올바르지 않습니다.", 422);
    const eventId = parsedEventId.data;
    const data = await getVoteRepository().getState(eventId, requireSession(request));
    return Response.json({ ok: true, storage: usesPersistentStorage() ? "DATABASE" : "MOCK", data });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = z.object({ eventId: z.string().uuid().optional() }).safeParse(await request.json());
    if (!parsed.success) throw new DomainError("VALIDATION_ERROR", "투표 요청이 올바르지 않습니다.", 422);
    const data = await getVoteRepository().submit(parsed.data.eventId, requireSession(request));
    return Response.json({ ok: true, storage: usesPersistentStorage() ? "DATABASE" : "MOCK", data });
  } catch (error) {
    return toErrorResponse(error);
  }
}
