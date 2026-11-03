import { NextResponse } from "next/server";
import { z } from "zod";
import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getMockPartAttendanceSnapshot, submitMockPartAttendance } from "@/lib/attendance/mockPartAttendanceStore";
import { AUDIENCE_JURY_DEPARTMENTS } from "@/types/audience-jury";

const eventIdSchema = z.string().uuid().optional();
const submitSchema = z.object({
  eventId: eventIdSchema,
  part: z.union([z.literal(1), z.literal(2)]),
  department: z.enum(AUDIENCE_JURY_DEPARTMENTS),
  studentNumber: z.string().trim().min(5).max(20).regex(/^[0-9A-Za-z-]+$/),
  name: z.string().trim().min(2).max(30),
});

function requireMock() {
  if (!isMockRuntime()) throw new DomainError("INVALID_STATE", "운영 DB 출석 테이블 연결 전에는 이 양식을 사용할 수 없습니다.", 503);
}

export async function GET(request: Request) {
  try {
    requireMock();
    const eventId = eventIdSchema.parse(new URL(request.url).searchParams.get("eventId") ?? undefined);
    return NextResponse.json({ ok: true, data: getMockPartAttendanceSnapshot(eventId) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireMock();
    const input = submitSchema.parse(await request.json());
    const result = submitMockPartAttendance(input);
    return NextResponse.json({ ok: true, data: { ...result, snapshot: getMockPartAttendanceSnapshot(input.eventId) } });
  } catch (error) {
    return toErrorResponse(error);
  }
}
