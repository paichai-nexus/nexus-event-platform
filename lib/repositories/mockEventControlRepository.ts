import "server-only";

import type { EventControlRepository, EventControlSnapshot } from "@/lib/repositories/eventControlRepository";
import { resetMockCheckIns } from "@/lib/repositories/mockCheckInRepository";
import { resetMockPrizes } from "@/lib/repositories/mockPrizeRepository";
import { activateMockTeam, completeMockTeam, resetMockTeams } from "@/lib/repositories/mockTeamRepository";
import { resetMockPrizeCatalog } from "@/lib/repositories/mockPrizeCatalogRepository";
import { resetMockMissions } from "@/lib/repositories/mockMissionRepository";
import type { EventMode, EventStatus } from "@/types/event";
import type { VotingStatus } from "@/types/voting";
import { DomainError } from "@/lib/errors/domainError";

const MOCK_EVENT_ID = "00000000-0000-4000-8000-000000000100";
const globalForEvent = globalThis as typeof globalThis & { __eventControl?: EventControlSnapshot };

function getState() {
  globalForEvent.__eventControl ??= {
    eventId: MOCK_EVENT_ID,
    mode: "REHEARSAL",
    status: "VOTING_OPEN",
    votingStatus: "OPEN",
    version: 1,
    activeTeamId: null,
    displayMode: "HOLDING",
    resultStatus: "LOCKED",
    revealStep: 0,
  };
  return globalForEvent.__eventControl;
}

function changed() {
  getState().version += 1;
  return { ...getState() };
}

function assertEvent(eventId?: string) {
  if (eventId && eventId !== MOCK_EVENT_ID) throw new DomainError("NOT_FOUND", "행사를 찾을 수 없습니다.", 404);
}

export class MockEventControlRepository implements EventControlRepository {
  async getSnapshot(eventId?: string) {
    assertEvent(eventId);
    return { ...getState() };
  }

  async setVotingStatus(eventId: string, status: VotingStatus) {
    assertEvent(eventId);
    const state = getState();
    state.votingStatus = status;
    state.status = status === "OPEN" ? "VOTING_OPEN" : status === "CLOSED" ? "VOTING_CLOSED" : "VOTING_READY";
    return changed();
  }

  async setMode(eventId: string, mode: EventMode) {
    assertEvent(eventId);
    getState().mode = mode;
    return changed();
  }

  async setStatus(eventId: string, status: EventStatus) {
    assertEvent(eventId);
    getState().status = status;
    return changed();
  }

  async setActiveTeam(eventId: string, teamId: string | null) {
    assertEvent(eventId);
    if (!teamId) throw new DomainError("VALIDATION_ERROR", "발표팀을 선택해주세요.", 422);
    activateMockTeam(teamId);
    const state = getState();
    state.activeTeamId = teamId;
    state.displayMode = "SPOTLIGHT";
    state.votingStatus = "READY";
    state.status = "VOTING_READY";
    return changed();
  }

  async completeActiveTeam(eventId: string) {
    assertEvent(eventId);
    const state = getState();
    if (!state.activeTeamId) throw new DomainError("INVALID_STATE", "현재 발표 중인 팀이 없습니다.", 409);
    completeMockTeam(state.activeTeamId);
    state.activeTeamId = null;
    state.votingStatus = "CLOSED";
    state.status = "VOTING_CLOSED";
    state.displayMode = "HOLDING";
    return changed();
  }

  async setDisplayMode(eventId: string, displayMode: EventControlSnapshot["displayMode"]) {
    assertEvent(eventId);
    getState().displayMode = displayMode;
    return changed();
  }

  async setRevealStep(eventId: string, revealStep: number) {
    assertEvent(eventId);
    const state = getState();
    state.revealStep = revealStep;
    state.displayMode = "AWARD_REVEAL";
    state.resultStatus = revealStep > 0 ? "REVEALING" : "LOCKED";
    return changed();
  }

  async resetRehearsal(eventId: string) {
    assertEvent(eventId);
    if (getState().mode === "LIVE") throw new DomainError("FORBIDDEN", "LIVE 데이터는 초기화할 수 없습니다.", 403);
    globalForEvent.__eventControl = {
      eventId: MOCK_EVENT_ID,
      mode: "REHEARSAL",
      status: "SETUP",
      votingStatus: "READY",
      version: getState().version + 1,
      activeTeamId: null,
      displayMode: "HOLDING",
      resultStatus: "LOCKED",
      revealStep: 0,
    };
    resetMockCheckIns();
    resetMockPrizes();
    resetMockTeams();
    resetMockPrizeCatalog();
    resetMockMissions();
    return { ...globalForEvent.__eventControl };
  }
}
