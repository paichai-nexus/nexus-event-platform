import { MOCK_PARTICIPANT_IDS } from "../data/mockParticipants.ts";

export function normalizeParticipantId(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits || digits.length > 4) return null;
  return `#${digits.padStart(4, "0")}`;
}

export function isDuplicateCheckIn(existingIds: string[], participantId: string) {
  return existingIds.includes(participantId);
}

export function canSubmitVote(votingStatus: string, submittedTeamIds: string[], teamId: string) {
  return votingStatus === "OPEN" && !submittedTeamIds.includes(teamId);
}

export function nextPrizeWinner(historyIds: string[]) {
  return MOCK_PARTICIPANT_IDS.find((id) => !historyIds.includes(id)) ?? null;
}
