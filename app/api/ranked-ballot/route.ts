import { NextResponse } from "next/server";
import { z } from "zod";
import { AUDIENCE_SESSION_COOKIE, readAudienceSessionToken } from "@/lib/attendance/sessionCookie";
import { isMockRuntime, isPostgresTestRuntime } from "@/lib/config/runtime";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEventControlRepository, getTeamRepository } from "@/lib/repositories/repositoryFactory";

type Category = "STARTUP" | "BUSINESS_ANALYSIS";
type Choice = { category: Category; rank: 1 | 2; teamId: string };
type State = { registered: boolean; submitted: boolean; votingStatus: string; choices: Choice[]; votingOpensAt?: string | null; votingAvailable?: boolean };
type TeamView = { id: string; name: string; category: Category; order: number };
const eventId = z.string().uuid().optional();
const registration = z.object({
  eventId,
  department: z.string().trim().min(2).max(80),
  studentNumber: z.string().regex(/^[0-9]{5,12}$/),
  fullName: z.string().trim().min(2).max(40),
  pcuCode: z.string().trim().toUpperCase().regex(/^PCU-(10[1-9]|1[1-9][0-9]|2[01][0-9]|220)$/),
});
const choice = z.object({category:z.enum(["STARTUP","BUSINESS_ANALYSIS"]), rank:z.union([z.literal(1),z.literal(2)]), teamId:z.string().uuid().or(z.string().regex(/^TEAM-\d+$/))});
const ballot = z.object({eventId,choices:z.array(choice).length(4)});

const globals = globalThis as typeof globalThis & {
  __pcuRankMock?: { registrations: Map<string, {studentNumber:string;pcuCode:string}>; ballots:Map<string,Choice[]> };
};
function mockStore() {
  globals.__pcuRankMock ??= {registrations:new Map(),ballots:new Map()};
  return globals.__pcuRankMock;
}
function originGuard(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  if (!origin || new URL(origin).host !== host) throw new DomainError("FORBIDDEN","요청 출처를 확인할 수 없습니다.",403);
}
function client() {
  const db = createSupabaseAdminClient();
  if (!db) throw new DomainError("DATABASE_ERROR","Supabase 서버 설정이 없습니다.",503);
  return db;
}
function checkRuntime() {
  if (isPostgresTestRuntime()) throw new DomainError("DATABASE_ERROR","순위투표 PostgreSQL 테스트 어댑터가 아직 지원되지 않습니다.",503);
  return isMockRuntime();
}
async function readState(token:string, requestedEvent?:string):Promise<{state:State;teams:TeamView[];eventId:string}> {
  if (checkRuntime()) {
    const ev=await getEventControlRepository().getSnapshot(requestedEvent);
    const all=await getTeamRepository().getTeams(ev.eventId);
    const key=`${ev.eventId}:${token}`;
    const store=mockStore();
    return {state:{registered:store.registrations.has(key),submitted:store.ballots.has(key),votingStatus:ev.votingStatus,votingOpensAt:"2026-11-04T17:00:00+09:00",votingAvailable:ev.votingStatus === "OPEN" && Date.now() >= Date.parse("2026-11-04T17:00:00+09:00"),choices:store.ballots.get(key)??[]},
      teams:all.filter(t=>t.active&&t.name).map(t=>({id:t.id,name:t.name!,category:t.category,order:t.order})),eventId:ev.eventId};
  }
  const db=client();
  let q=db.from("events").select("id, voting_status, ranked_voting_opens_at");
  q=requestedEvent?q.eq("id",requestedEvent):q.order("starts_at",{ascending:false}).limit(1);
  const ev=await q.single();
  if(ev.error||!ev.data) throw new DomainError("NOT_FOUND","행사를 찾을 수 없습니다.",404);
  const [stateResult,teamResult]=await Promise.all([
    db.rpc("get_pcu_ballot_state",{p_event_id:ev.data.id,p_session_token:token}),
    db.from("teams").select("id, name, category, presentation_order").eq("event_id",ev.data.id).eq("active",true).order("presentation_order")
  ]);
  if(stateResult.error||teamResult.error) throw new DomainError("DATABASE_ERROR","순위 투표 정보를 확인할 수 없습니다. 016 마이그레이션을 확인해주세요.",503);
  const state=stateResult.data as State;
  state.votingOpensAt = ev.data.ranked_voting_opens_at ?? null;
  state.votingAvailable = state.votingStatus === "OPEN" && Boolean(state.votingOpensAt) && Date.now() >= Date.parse(state.votingOpensAt!);
  return {state,teams:(teamResult.data??[]).filter(t=>t.name).map(t=>({id:t.id,name:t.name!,category:t.category as Category,order:t.presentation_order})),eventId:ev.data.id};
}

export async function GET(request:Request) {
  try {
    const value=new URL(request.url).searchParams.get("eventId")??undefined;
    const parsed=eventId.safeParse(value);
    if(!parsed.success) throw new DomainError("VALIDATION_ERROR","행사 ID가 올바르지 않습니다.",422);
    const token=readAudienceSessionToken(request)??crypto.randomUUID();
    const data=await readState(token,parsed.data);
    const res=NextResponse.json({ok:true,data},{headers:{"Cache-Control":"no-store"}});
    res.cookies.set(AUDIENCE_SESSION_COOKIE,token,{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*24*30});
    return res;
  } catch(e) {return toErrorResponse(e);}
}

export async function POST(request:Request) {
  try {
    originGuard(request);
    const token=readAudienceSessionToken(request);
    if(!token) throw new DomainError("FORBIDDEN","화면을 새로고침해 주세요.",403);
    const payload=registration.safeParse(await request.json().catch(()=>null));
    if(!payload.success) throw new DomainError("VALIDATION_ERROR","학과, 학번, 이름, PCU-101~220 번호를 확인해주세요.",422);
    const v=payload.data;
    if(checkRuntime()) {
      const ev=await getEventControlRepository().getSnapshot(v.eventId);
      const key=`${ev.eventId}:${token}`,s=mockStore();
      const existing=s.registrations.get(key);
      if(existing&&(existing.studentNumber!==v.studentNumber||existing.pcuCode!==v.pcuCode)) throw new DomainError("DUPLICATE","이미 다른 정보로 등록됐습니다.",409);
      for(const [k,x] of s.registrations) if(k!==key&&(x.studentNumber===v.studentNumber||x.pcuCode===v.pcuCode)) throw new DomainError("DUPLICATE","이미 사용된 학번 또는 PCU 번호입니다.",409);
      s.registrations.set(key,{studentNumber:v.studentNumber,pcuCode:v.pcuCode});
    } else {
      const {error}=await client().rpc("register_pcu_audience_voter",{p_event_id:v.eventId??null,p_session_token:token,p_department:v.department,p_student_number:v.studentNumber,p_full_name:v.fullName,p_pcu_code:v.pcuCode});
      if(error) {
        if(/ALREADY_REGISTERED|CODE_OR_STUDENT_ALREADY_USED/.test(error.message)) throw new DomainError("DUPLICATE","이미 사용된 학번 또는 PCU 번호입니다.",409);
        if(/INVALID_PCU_CODE|INVALID_PROFILE/.test(error.message)) throw new DomainError("VALIDATION_ERROR","등록 정보를 확인해주세요.",422);
        throw new DomainError("DATABASE_ERROR","등록을 완료하지 못했습니다.",503);
      }
    }
    return Response.json({ok:true,data:await readState(token,v.eventId)});
  } catch(e) {return toErrorResponse(e);}
}

export async function PUT(request:Request) {
  try {
    originGuard(request);
    const token=readAudienceSessionToken(request);
    if(!token) throw new DomainError("FORBIDDEN","등록 세션이 없습니다.",403);
    const payload=ballot.safeParse(await request.json().catch(()=>null));
    if(!payload.success) throw new DomainError("VALIDATION_ERROR","각 부문에서 1·2등을 선택해주세요.",422);
    const v=payload.data, ranks=new Set(v.choices.map(c=>`${c.category}:${c.rank}`)), ids=new Set(v.choices.map(c=>c.teamId));
    if(ranks.size!==4||ids.size!==4) throw new DomainError("VALIDATION_ERROR","한 팀을 중복 선택할 수 없습니다.",422);
    if(checkRuntime()) {
      const current=await readState(token,v.eventId);
      const key=`${current.eventId}:${token}`;
      if(!current.state.registered) throw new DomainError("FORBIDDEN","청중평가단 등록이 필요합니다.",403);
      if(current.state.submitted) throw new DomainError("ALREADY_SUBMITTED","이미 제출했습니다.",409);
      if(Date.now() < Date.parse("2026-11-04T17:00:00+09:00")) throw new DomainError("EVENT_CLOSED","청중평가는 11월 4일 오후 5시부터 가능합니다.",409);
      if(current.state.votingStatus!=="OPEN") throw new DomainError("EVENT_CLOSED","투표가 아직 열리지 않았습니다.",409);
      for(const c of v.choices) if(!current.teams.some(t=>t.id===c.teamId&&t.category===c.category)) throw new DomainError("VALIDATION_ERROR","부문과 팀 정보가 일치하지 않습니다.",422);
      mockStore().ballots.set(key,v.choices);
    } else {
      const current = await readState(token,v.eventId);
      if (!current.state.votingOpensAt || Date.now() < Date.parse(current.state.votingOpensAt)) {
        throw new DomainError("EVENT_CLOSED","청중평가는 11월 4일 오후 5시부터 가능합니다.",409);
      }
      const {error}=await client().rpc("submit_pcu_ranked_ballot",{p_event_id:v.eventId??null,p_session_token:token,p_choices:v.choices});
      if(error) {
        if(/ALREADY_SUBMITTED/.test(error.message)) throw new DomainError("ALREADY_SUBMITTED","이미 제출했습니다.",409);
        if(/VOTING_CLOSED/.test(error.message)) throw new DomainError("EVENT_CLOSED","투표가 열리지 않았습니다.",409);
        if(/NOT_ELIGIBLE/.test(error.message)) throw new DomainError("FORBIDDEN","평가단 등록이 필요합니다.",403);
        if(/INVALID_BALLOT|INVALID_TEAM|DUPLICATE_CHOICE/.test(error.message)) throw new DomainError("VALIDATION_ERROR","선택한 팀과 순위를 확인해주세요.",422);
        throw new DomainError("DATABASE_ERROR","투표 저장에 실패했습니다.",503);
      }
    }
    return Response.json({ok:true,data:await readState(token,v.eventId)});
  } catch(e) {return toErrorResponse(e);}
}
