import { z } from "zod";
import { readAudienceJuryAuthToken } from "@/lib/audience-jury/authCookie";
import { getMockAudienceBallots, submitMockAudienceBallot } from "@/lib/audience-jury/mockAudienceBallotStore";
import { verifyMockAudienceJuryAuth } from "@/lib/audience-jury/mockAudienceJuryStore";
import { getSupabaseAudienceBallotState, submitSupabaseAudienceBallot } from "@/lib/audience-jury/supabaseAudienceBallotStore";
import { isMockRuntime } from "@/lib/config/runtime";
import { DomainError, toErrorResponse } from "@/lib/errors/domainError";
import { getEventControlRepository, getTeamRepository } from "@/lib/repositories/repositoryFactory";

const submissionSchema = z.object({
  eventId: z.string().uuid().optional(),
  category: z.enum(["STARTUP", "BUSINESS_ANALYSIS"]),
  firstTeamId: z.string().min(1),
  secondTeamId: z.string().min(1),
});

async function mockContext(request: Request) {
  const authToken = readAudienceJuryAuthToken(request);
  const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
  if (!authToken) throw new DomainError("UNAUTHORIZED", "청중평가단 본인 인증이 필요합니다.", 401);
  if (!verifyMockAudienceJuryAuth(authToken, eventId)) throw new DomainError("UNAUTHORIZED", "청중평가단 본인 인증이 필요합니다.", 401);
  const event = await getEventControlRepository().getSnapshot();
  const teams = (await getTeamRepository().getTeams(event.eventId)).filter((team) => team.active && team.name);
  const activeTeam = teams.find((team) => team.id === event.activeTeamId) ?? null;
  const openCategory = event.votingStatus === "OPEN" ? activeTeam?.category ?? null : null;
  return { authToken, event, teams, openCategory };
}

export async function GET(request: Request) {
  try {
    const authToken = readAudienceJuryAuthToken(request);
    const eventId = new URL(request.url).searchParams.get("eventId") ?? undefined;
    if (!authToken) throw new DomainError("UNAUTHORIZED", "청중평가단 본인 인증이 필요합니다.", 401);
    if (!isMockRuntime()) {
      const state = await getSupabaseAudienceBallotState(authToken, eventId);
      return Response.json({ ok: true, storage: "SUPABASE", data: state });
    }
    const { event, teams, openCategory } = await mockContext(request);
    return Response.json({ ok: true, storage: "MOCK", data: {
      openCategory,
      votingStatus: event.votingStatus,
      teams: teams.map((team) => ({ id: team.id, name: team.name as string, order: team.order, category: team.category })),
      submissions: getMockAudienceBallots(event.eventId, authToken),
    } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = submissionSchema.parse(await request.json());
    const authToken = readAudienceJuryAuthToken(request);
    const eventId = input.eventId ?? new URL(request.url).searchParams.get("eventId") ?? undefined;
    if (!authToken) throw new DomainError("UNAUTHORIZED", "청중평가단 본인 인증이 필요합니다.", 401);
    if (!isMockRuntime()) {
      const submission = await submitSupabaseAudienceBallot({
        ...input,
        eventId,
        authToken,
      });
      return Response.json({ ok: true, storage: "SUPABASE", data: submission });
    }
    const { event, teams, openCategory } = await mockContext(request);
    if (openCategory !== input.category) throw new DomainError("VOTING_CLOSED", "현재 해당 부문의 청중평가 시간이 아닙니다.", 409);
    const first = teams.find((team) => team.id === input.firstTeamId && team.category === input.category);
    const second = teams.find((team) => team.id === input.secondTeamId && team.category === input.category);
    if (!first || !second) throw new DomainError("VALIDATION_ERROR", "해당 부문 참가팀만 선택할 수 있습니다.", 422);
    const submission = submitMockAudienceBallot({ eventId: event.eventId, authToken, ...input });
    return Response.json({ ok: true, storage: "MOCK", data: submission });
  } catch (error) {
    if (error instanceof z.ZodError) return toErrorResponse(new DomainError("VALIDATION_ERROR", "1등과 2등 팀을 모두 선택해주세요.", 422));
    return toErrorResponse(error);
  }
}
