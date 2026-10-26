export type Participant = {
  id: string;
  displayName: string;
  checkedIn: boolean;
};

export type DrawHistory = {
  participantId: string;
  displayName: string;
  drawnAt: string;
};

export function getEligibleParticipants(
  participants: Participant[],
  history: DrawHistory[],
): Participant[] {
  const winnerIds = new Set(history.map((item) => item.participantId));

  return participants.filter(
    (participant) =>
      participant.checkedIn && !winnerIds.has(participant.id),
  );
}

export function drawWinner(
  participants: Participant[],
  history: DrawHistory[],
  random = Math.random,
): Participant | null {
  const candidates = getEligibleParticipants(participants, history);

  if (candidates.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(random() * candidates.length);

  return candidates[randomIndex];
}