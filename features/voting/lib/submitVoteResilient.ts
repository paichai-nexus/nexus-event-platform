import { isAmbiguousMutationFailure, RequestFailure, retryRead } from "../../../lib/network/resilientFetch";
import type { AudienceVoteState } from "../../../types/voting";

type VoteResult = { data: AudienceVoteState; storage: "DATABASE" | "MOCK" };

class VoteNotConfirmed extends Error {}

export async function submitVoteResilient(
  expectedTeamId: string,
  operations: {
    submit: () => Promise<VoteResult>;
    readState: () => Promise<VoteResult>;
  },
) {
  try {
    const result = await operations.submit();
    return { ...result, recovered: false };
  } catch (error) {
    const alreadySubmitted = error instanceof RequestFailure && error.code === "ALREADY_SUBMITTED";
    if (!alreadySubmitted && !isAmbiguousMutationFailure(error)) throw error;

    try {
      const result = await retryRead(async () => {
        const current = await operations.readState();
        if (!current.data.submissionId || current.data.teamId !== expectedTeamId) throw new VoteNotConfirmed();
        return current;
      });
      return { ...result, recovered: true };
    } catch {
      throw error;
    }
  }
}
