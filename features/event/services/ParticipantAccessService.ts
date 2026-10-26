export type ParticipantAccessContext = {
  eventId: string;
  participantId: string;
  participantCode: string;
};

export type ParticipantAccessResult =
  | { status: "VERIFIED"; participant: ParticipantAccessContext }
  | { status: "NOT_FOUND" | "INACTIVE" | "INVALID_CREDENTIAL" | "NOT_CHECKED_IN" };

/**
 * Adapter boundary for participant authentication.
 * RULE_NOT_CONFIRMED: no production credential policy has been approved yet.
 * Do not couple voting repositories to participant_code or a particular ticket format.
 */
export interface ParticipantAccessService {
  verifyAccessCredential(eventId: string, credential: string): Promise<ParticipantAccessResult>;
  getCurrentParticipant(): Promise<ParticipantAccessContext | null>;
}
