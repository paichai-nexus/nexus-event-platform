import { NextResponse } from "next/server";
import { z } from "zod";
import { isMockRuntime } from "@/lib/config/runtime";
import { toErrorResponse } from "@/lib/errors/domainError";
import { getMockPartAttendanceSnapshot, submitMockPartAttendance } from "@/lib/attendance/mockPartAttendanceStore";
import { getSupabasePartAttendanceSnapshot, submitSupabasePartAttendance } from "@/lib/attendance/supabasePartAttendanceStore";
import { AUDIENCE_JURY_DEPARTMENTS } from "@/types/audience-jury";

const eventIdSchema = z.string().uuid().optional();
const submitSchema = z.object({
  eventId: eventIdSchema,
  part: z.union([z.literal(1), z.literal(2)]),
  department: z.enum(AUDIENCE_JURY_DEPARTMENTS),
  studentNumber: z.string().trim().min(5).max(20).regex(/^[0-9A-Za-z-]+$/),
  name: z.string().trim().min(2).max(30),
});

export async function GET(request: Request) {
  try {
    const eventId = eventIdSchema.parse(new URL(request.url).searchParams.get("eventId") ?? undefined);
    const data = isMockRuntime() ? getMockPartAttendanceSnapshot(eventId) : await getSupabasePartAttendanceSnapshot(eventId);
    return NextResponse.json({ ok: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = submitSchema.parse(await request.json());
    const result = isMockRuntime()
      ? { ...submitMockPartAttendance(input), snapshot: getMockPartAttendanceSnapshot(input.eventId) }
      : await submitSupabasePartAttendance(input);
    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return toErrorResponse(error);
  }
}
