import { z } from "zod";
import { authorizeRoles } from "@/lib/auth/authorize";
import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getEventControlRepository, getTeamRepository } from "@/lib/repositories/repositoryFactory";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const categorySchema = z.enum(["BUSINESS_ANALYSIS", "STARTUP"]);
const patchSchema = z.object({
  eventId: z.string().uuid(),
  category: categorySchema,
  status: z.enum(["OPEN", "CLOSED"]),
});

type MockSession = { eventId: string; category: z.infer<typeof categorySchema> | null; votingStatus: "READY" | "OPEN" | "CLOSED" };
const mockGlobal = globalThis as typeof globalThis & { __mockCategoryVoteSession?: MockSession };

export async function GET(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const requestedEventId = new URL(request.url).searchParams.get("eventId");
    if (isMockRuntime()) {
      const event = await getEventControlRepository().getSnapshot(requestedEventId ?? undefined);
      const stored = mockGlobal.__mockCategoryVoteSession;
      return Response.json({ ok: true, data: stored?.eventId === event.eventId ? stored : { eventId: event.eventId, category: null, votingStatus: event.votingStatus } });
    }
    const client = await createSupabaseServerClient();
    if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
    let query = client.from("events").select("id, active_vote_category, voting_status");
    query = requestedEventId ? query.eq("id", requestedEventId) : query.order("starts_at", { ascending: false }).limit(1);
    const { data, error } = await query.single();
    if (error || !data) throw new DomainError("DATABASE_ERROR", "청중평가 세션을 조회하지 못했습니다.", 500);
    return Response.json({ ok: true, data: { eventId: data.id, category: data.active_vote_category, votingStatus: data.voting_status } });
  } catch (error) { return toErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    await authorizeRoles(["ADMIN", "STAFF"]);
    const input = patchSchema.parse(await request.json());
    if (isMockRuntime()) {
      const eventRepository = getEventControlRepository();
      const teams = await getTeamRepository().getTeams(input.eventId);
      const anchor = teams.find((team) => team.active && team.name && team.category === input.category);
      if (!anchor) throw new DomainError("INVALID_STATE", "해당 부문의 본선 팀이 없습니다.", 409);
      if (input.status === "OPEN") await eventRepository.setActiveTeam(input.eventId, anchor.id);
      await eventRepository.setVotingStatus(input.eventId, input.status);
      const data = { eventId: input.eventId, category: input.category, votingStatus: input.status } as MockSession;
      mockGlobal.__mockCategoryVoteSession = data;
      return Response.json({ ok: true, data });
    }
    const client = await createSupabaseServerClient();
    if (!client) throw new DomainError("DATABASE_ERROR", "Supabase 설정을 확인해주세요.", 503);
    const { data, error } = await client.rpc("set_audience_category_voting_status", {
      p_event_id: input.eventId, p_category: input.category, p_status: input.status,
    });
    if (error || !data) throw new DomainError("DATABASE_ERROR", "청중평가 세션 상태를 변경하지 못했습니다.", 500);
    return Response.json({ ok: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) return toErrorResponse(new DomainError("VALIDATION_ERROR", "부문과 시작·마감 상태를 확인해주세요.", 422));
    return toErrorResponse(error);
  }
}
