import { NextResponse } from "next/server";
import { isValidAttendanceEntryPass } from "@/lib/attendance/exitPass";
import { AUDIENCE_SESSION_COOKIE, readAudienceSessionToken } from "@/lib/attendance/sessionCookie";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getAttendanceRepository } from "@/lib/repositories/repositoryFactory";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    if (!isValidAttendanceEntryPass(requestUrl.searchParams.get("entryPass"))) {
      throw new DomainError("FORBIDDEN", "입장 QR이 만료되었습니다. 안내 화면의 새 QR을 다시 스캔해주세요.", 403);
    }

    const sessionToken = readAudienceSessionToken(request) ?? crypto.randomUUID();
    await getAttendanceRepository().enter(sessionToken);
    const resultUrl = new URL("/check-in", requestUrl.origin);
    resultUrl.searchParams.set("entered", "1");
    const response = NextResponse.redirect(resultUrl, 303);
    response.cookies.set(AUDIENCE_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
