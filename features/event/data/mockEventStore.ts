import type { EventOpsState } from "@/types/operations";
import { createEmptyTeamSlots } from "@/features/event/data/teamSlots";

export const INITIAL_EVENT_STATE: EventOpsState = {
  eventId: "00000000-0000-4000-8000-000000000100",
  mode: "REHEARSAL",
  status: "VOTING_OPEN",
  networkOverride: "ONLINE",
  registeredCount: 320,
  checkInCount: 241,
  voteCount: 187,
  votingStatus: "OPEN",
  snapshotVersion: 1,
  serverTime: null,
  activeTeamId: null,
  displayMode: "HOLDING",
  resultStatus: "LOCKED",
  revealStep: 0,
  checkIns: [
    { participantId: "#0003", time: "13:04:27" },
    { participantId: "#0002", time: "13:03:18" },
    { participantId: "#0001", time: "13:02:11" },
  ],
  checkInResult: { status: "IDLE" },
  myVotedTeamIds: [],
  judgeProgress: Array.from({ length: 6 }, (_, index) => ({ id: `Judge ${String(index + 1).padStart(2, "0")}`, completed: 0, total: 19 })),
  teams: createEmptyTeamSlots(),
  scoreInputs: [],
  prizeHistory: [],
  prizeCatalog: Array.from({ length: 11 }, (_, index) => ({ id: `PRIZE-${index + 2}`, rank: index + 2, name: null, imageUrl: null, quantity: null, winnerCount: null, status: "UNCONFIRMED" as const, drawStatus: "READY" as const })),
  activities: [
    { id: "a1", time: "13:12", category: "SYSTEM", message: "청중평가 OPEN" },
    { id: "a2", time: "13:07", category: "JUDGING", message: "Judge 01 제출 완료" },
    { id: "a3", time: "13:05", category: "AUDIENCE VOTE", message: "평가 제출" },
    { id: "a4", time: "13:02", category: "CHECK-IN", message: "Participant #0001 입장" },
  ],
  qaScenario: null,
};
