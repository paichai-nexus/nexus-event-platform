import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidAttendanceEntryPass, isValidAttendanceExitPass } from "@/lib/attendance/exitPass";
import { DomainError } from "@/lib/errors/domainError";
import { toErrorResponse } from "@/lib/errors/domainError";
import { getAttendanceRepository } from "@/lib/repositories/repositoryFactory";
import { AUDIENCE_SESSION_COOKIE, readAudienceSessionToken } from "@/lib/attendance/sessionCookie";

const eventIdSchema = z.string().uuid().optional();

function getEventId(request: Request) {
  const value = new URL(request.url).searchParams.get("eventId") ?? undefined;
  const parsed = eventIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function sessionToken(request: Request) {
  return readAudienceSessionToken(request) ?? crypto.randomUUID();
}

function responseWithSession(data: unknown, token: string) {
  const response = NextResponse.json({ ok: true, data });
  response.cookies.set(AUDIENCE_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function GET(request: Request) {
  try {
    const token = sessionToken(request);
    const data = await getAttendanceRepository().getStatus(token, getEventId(request));
    return responseWithSession(data, token);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { entryPass?: string } | null;
    if (!isValidAttendanceEntryPass(body?.entryPass)) {
      throw new DomainError("FORBIDDEN", "입장 QR이 만료되었거나 올바르지 않습니다. 안내 화면의 새 QR을 다시 스캔해주세요.", 403);
    }
    const token = sessionToken(request);
    const data = await getAttendanceRepository().enter(token, getEventId(request));
    return responseWithSession(data, token);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { exitPass?: string } | null;
    if (!isValidAttendanceExitPass(body?.exitPass)) {
      throw new DomainError("FORBIDDEN", "출구 QR이 만료되었거나 올바르지 않습니다. 출구의 새 QR을 다시 스캔해주세요.", 403);
    }
    const token = sessionToken(request);
    const data = await getAttendanceRepository().exit(token, getEventId(request));
    return responseWithSession(data, token);
  } catch (error) {
    return toErrorResponse(error);
  }
}
