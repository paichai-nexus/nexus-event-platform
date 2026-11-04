import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const inputSchema = z.object({
  eventId: z.string().uuid(),
  expectedAttendance: z.number().int().nonnegative(),
  expectedPcu: z.number().int().nonnegative(),
  confirmation: z.literal("초기화"),
});

async function getClient() {
  const db = createSupabaseAdminClient();
  if (!db) throw new DomainError("DATABASE_ERROR", "DB 연결이 없습니다.", 503);
  return db;
}

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN"]);
    const eventId = z.string().uuid().parse(new URL(request.url).searchParams.get("eventId"));
    const db = await getClient();
    const event = await db.from("events").select("id,mode,status,result_status").eq("id",eventId).single();
    if (event.error || !event.data) throw new DomainError("NOT_FOUND","행사를 찾을 수 없습니다.",404);
    const [attendance,pcu,ballots,paper,draws,stages,oldDraws,checkins,submissions,judges,results] = await Promise.all([
      db.from("part_attendance_entries").select("id",{count:"exact",head:false}).eq("event_id",eventId),
      db.from("audience_jury_reservations").select("id",{count:"exact",head:false}).eq("event_id",eventId).not("pcu_code","is",null),
      db.from("audience_rank_ballots").select("id",{count:"exact",head:false}).eq("event_id",eventId),
      db.from("paper_judge_scores").select("id",{count:"exact",head:false}).eq("event_id",eventId),
      db.from("prize_item_draws").select("id",{count:"exact",head:false}).eq("event_id",eventId),
      db.from("prize_stage_snapshots").select("id",{count:"exact",head:false}).eq("event_id",eventId),
      db.from("prize_draws").select("id",{count:"exact",head:false}).eq("event_id",eventId),
      db.from("check_ins").select("id",{count:"exact",head:false}).eq("event_id",eventId),
      db.from("audience_submissions").select("id",{count:"exact",head:false}).eq("event_id",eventId),
      db.from("judge_submissions").select("id",{count:"exact",head:false}).eq("event_id",eventId),
      db.from("result_snapshots").select("id",{count:"exact",head:false}).eq("event_id",eventId),
    ]);
    const queries = [attendance,pcu,ballots,paper,draws,stages,oldDraws,checkins,submissions,judges,results];
    const tableNames = [
      "part_attendance_entries",
      "audience_jury_reservations",
      "audience_rank_ballots",
      "paper_judge_scores",
      "prize_item_draws",
      "prize_stage_snapshots",
      "prize_draws",
      "check_ins",
      "audience_submissions",
      "judge_submissions",
      "result_snapshots",
    ];
    const failed = queries.flatMap((q, i) =>
      q.error ? [{ table: tableNames[i], error: q.error.message }] : []
    );
    if (failed.length) {
      console.error("RESET_PREFLIGHT_DB_ERRORS", failed);
      throw new DomainError(
        "DATABASE_ERROR",
        `조회 실패 테이블: ${failed.map(x => x.table).join(", ")}`,
        503
      );
    }
    const otherDataCount=queries.slice(2).reduce((sum,q)=>sum+(q.count??0),0);
    const allowed = event.data.mode === "REHEARSAL" && event.data.result_status === "LOCKED" &&
      !["FINALIZED","ENDED"].includes(event.data.status) && otherDataCount===0;
    return Response.json({ok:true,data:{event:event.data,attendance:attendance.count??0,pcu:pcu.count??0,otherDataCount,allowed}},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return toErrorResponse(error);}
}

export async function POST(request: Request) {
  try {
    await authorizeRoles(["ADMIN"]);
    const parsed=inputSchema.safeParse(await request.json().catch(()=>null));
    if(!parsed.success) throw new DomainError("VALIDATION_ERROR","행사 ID·예상 건수·확인 문구를 확인하세요.",422);
    const db=await getClient();
    const {data,error}=await db.rpc("reset_event_day_test_attendees",{
      p_event_id:parsed.data.eventId,
      p_expected_attendance_count:parsed.data.expectedAttendance,
      p_expected_pcu_count:parsed.data.expectedPcu,
    });
    if(error) throw new DomainError("DATABASE_ERROR",`초기화를 차단했습니다: ${error.message}`,409);
    return Response.json({ok:true,data},{headers:{"Cache-Control":"no-store"}});
  } catch(error) {return toErrorResponse(error);}
}
