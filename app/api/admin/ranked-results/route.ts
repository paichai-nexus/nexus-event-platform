import { authorizeRoles } from "@/lib/auth/authorize";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isMockRuntime, isPostgresTestRuntime } from "@/lib/config/runtime";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getEventControlRepository } from "@/lib/repositories/repositoryFactory";

export async function GET(request:Request) {
  try {
    await authorizeRoles(["ADMIN","STAFF"]);
    const raw=new URL(request.url).searchParams.get("eventId")??undefined;
    const event=await getEventControlRepository().getSnapshot(raw);
    if(isMockRuntime()) return Response.json({ok:true,data:{eventId:event.eventId,rows:[],note:"Mock 집계는 제공되지 않습니다."}});
    if(isPostgresTestRuntime()) throw new DomainError("DATABASE_ERROR","Postgres test ranked tally adapter is not implemented.",503);
    const db=createSupabaseAdminClient();
    if(!db) throw new DomainError("DATABASE_ERROR","Supabase 설정이 없습니다.",503);
    const {data,error}=await db.rpc("get_pcu_ranked_tally",{p_event_id:event.eventId});
    if(error) throw new DomainError("DATABASE_ERROR","청중 순위표를 조회하지 못했습니다.",503);
    return Response.json({ok:true,data:{eventId:event.eventId,rows:data,conversionPolicy:"UNCONFIRMED"}},{headers:{"Cache-Control":"no-store"}});
  } catch(error){return toErrorResponse(error);}
}
