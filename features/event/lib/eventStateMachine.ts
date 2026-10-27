import type { EventStatus } from "@/types/event";

export const EVENT_TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  SETUP: ["CHECK_IN_OPEN"],
  CHECK_IN_OPEN: ["VOTING_READY", "ENDED"],
  VOTING_READY: ["CHECK_IN_OPEN", "VOTING_OPEN", "ENDED"],
  VOTING_OPEN: ["VOTING_CLOSED"],
  VOTING_CLOSED: ["VOTING_OPEN", "JUDGING", "ENDED"],
  JUDGING: ["VOTING_CLOSED", "SCORING", "ENDED"],
  SCORING: ["JUDGING", "FINALIZED"],
  FINALIZED: ["ENDED"],
  ENDED: [],
};

export function canTransitionEvent(from: EventStatus, to: EventStatus) {
  return from === to || EVENT_TRANSITIONS[from].includes(to);
}
