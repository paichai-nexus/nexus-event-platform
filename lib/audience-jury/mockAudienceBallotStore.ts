import { DomainError } from "@/lib/errors/domainError";
import type { AudienceRankSubmission } from "@/types/audience-ballot";
import type { TeamCategory } from "@/types/team";
import { getMockTeamSnapshot } from "@/lib/repositories/mockTeamRepository";
import { getMockAudienceJuryDrawPool } from "@/lib/audience-jury/mockAudienceJuryStore";
import type { AudienceBallotAggregate } from "@/types/audience-ballot-aggregate";

type StoredBallot = AudienceRankSubmission & { eventId: string; authToken: string };
const ballotGlobal = globalThis as typeof globalThis & { __mockAudienceRankBallots?: StoredBallot[] };

function ballots() {
  ballotGlobal.__mockAudienceRankBallots ??= [];
  return ballotGlobal.__mockAudienceRankBallots;
}

export function resetMockAudienceBallots() {
  ballotGlobal.__mockAudienceRankBallots = [];
}

export function getMockAudienceBallots(eventId: string, authToken: string) {
  return ballots().filter((item) => item.eventId === eventId && item.authToken === authToken)
    .map(({ category, firstTeamId, secondTeamId, submittedAt }) => ({ category, firstTeamId, secondTeamId, submittedAt }));
}

export function submitMockAudienceBallot(input: {
  eventId: string;
  authToken: string;
  category: TeamCategory;
  firstTeamId: string;
  secondTeamId: string;
}) {
  if (input.firstTeamId === input.secondTeamId) throw new DomainError("VALIDATION_ERROR", "1등과 2등은 서로 다른 팀을 선택해야 합니다.", 422);
  if (ballots().some((item) => item.eventId === input.eventId && item.authToken === input.authToken && item.category === input.category)) {
    throw new DomainError("ALREADY_SUBMITTED", "이미 해당 부문 평가를 제출했습니다.", 409);
  }
  const saved: StoredBallot = { ...input, submittedAt: new Date().toISOString() };
  ballots().push(saved);
  return { category: saved.category, firstTeamId: saved.firstTeamId, secondTeamId: saved.secondTeamId, submittedAt: saved.submittedAt };
}

export function getMockAudienceBallotAggregate(eventId: string): AudienceBallotAggregate {
  const eventBallots = ballots().filter((ballot) => ballot.eventId === eventId);
  const teams = getMockTeamSnapshot();
  const categories = (["STARTUP", "BUSINESS_ANALYSIS"] as const).map((category) => {
    const categoryBallots = eventBallots.filter((ballot) => ballot.category === category);
    return {
      category,
      submittedBallots: categoryBallots.length,
      teams: teams.filter((team) => team.category === category && team.active && team.name).map((team) => ({
        teamId: team.id,
        teamName: team.name!,
        order: team.order,
        category,
        firstVotes: categoryBallots.filter((ballot) => ballot.firstTeamId === team.id).length,
        secondVotes: categoryBallots.filter((ballot) => ballot.secondTeamId === team.id).length,
      })),
    };
  });
  return { acceptedJuryCount: getMockAudienceJuryDrawPool(eventId).length, categories, updatedAt: new Date().toISOString(), officialScoresAvailable: false };
}
