"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import { EMPTY_EVENT_STATE, INITIAL_EVENT_STATE } from "@/features/event/data/mockEventStore";
import { canSubmitVote, nextPrizeWinner } from "@/features/event/lib/mockOperations";
import type { DisplayMode, EventMode, EventStatus, NetworkState, ResultStatus } from "@/types/event";
import type { CheckInRecord, CheckInResult } from "@/types/check-in";
import type { EventOpsState } from "@/types/operations";
import type { VotingStatus } from "@/types/voting";
import type { PrizeDefinition, PrizeDefinitionUpdate, PrizeRecord } from "@/types/prize";
import type { Team, TeamUpdate } from "@/types/team";
import type { RuntimeMode } from "@/lib/config/runtimePolicy";

type EventOpsAction =
  | { type: "CHECK_IN_PENDING" }
  | { type: "CHECK_IN_RESULT"; result: CheckInResult }
  | {
      type: "HYDRATE_SERVER_STATE";
      eventId: string;
      mode: EventMode;
      status: EventStatus;
      votingStatus: VotingStatus;
      version: number;
      serverTime: string;
      activeTeamId: string | null;
      displayMode: DisplayMode;
      resultStatus: ResultStatus;
      revealStep: number;
      registeredCount: number;
      checkInCount: number;
      voteCount: number;
      voteByTeam: EventOpsState["voteByTeam"];
      checkIns: CheckInRecord[];
      prizeHistory: PrizeRecord[];
      prizeCatalog: PrizeDefinition[];
      teams: Team[];
      judgeProgress: EventOpsState["judgeProgress"];
    }
  | { type: "SNAPSHOT_FAILED" }
  | { type: "SET_VOTING"; status: VotingStatus }
  | { type: "SUBMIT_VOTE"; teamId: string }
  | { type: "SUBMIT_JUDGE" }
  | { type: "DRAW_PRIZE" }
  | { type: "SET_MODE"; mode: EventMode }
  | { type: "SET_STATUS"; status: EventStatus }
  | { type: "SET_NETWORK"; network: NetworkState }
  | { type: "SET_QA_SCENARIO"; scenario: string | null }
  | { type: "RESET_REHEARSAL" };

function clockTime() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function activityTime() {
  return clockTime().slice(0, 5);
}

function formatSeoulTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function eventOpsReducer(state: EventOpsState, action: EventOpsAction): EventOpsState {
  switch (action.type) {
    case "CHECK_IN_PENDING":
      return { ...state, checkInResult: { status: "SCANNING" } };
    case "CHECK_IN_RESULT": {
      if (action.result.status !== "SUCCESS") return { ...state, checkInResult: action.result };
      const participantId = action.result.participantId ?? "UNKNOWN";
      return {
        ...state,
        checkInResult: action.result,
        activities: [
          { id: crypto.randomUUID(), time: activityTime(), category: "CHECK-IN", message: `Participant ${participantId} 입장` },
          ...state.activities,
        ],
      };
    }
    case "HYDRATE_SERVER_STATE":
      return {
        ...state,
        eventId: action.eventId,
        mode: action.mode,
        status: action.status,
        votingStatus: action.votingStatus,
        snapshotVersion: action.version,
        serverTime: action.serverTime,
        activeTeamId: action.activeTeamId,
        displayMode: action.displayMode,
        resultStatus: action.resultStatus,
        revealStep: action.revealStep,
        registeredCount: action.registeredCount,
        checkInCount: action.checkInCount,
        voteCount: action.voteCount,
        voteByTeam: action.voteByTeam,
        snapshotReady: true,
        snapshotError: false,
        checkIns: action.checkIns,
        prizeHistory: action.prizeHistory,
        prizeCatalog: action.prizeCatalog,
        teams: action.teams,
        judgeProgress: action.judgeProgress,
      };
    case "SNAPSHOT_FAILED":
      return { ...state, snapshotError: true };
    case "SET_VOTING":
      return {
        ...state,
        votingStatus: action.status,
        status: action.status === "OPEN" ? "VOTING_OPEN" : action.status === "CLOSED" ? "VOTING_CLOSED" : "VOTING_READY",
        activities: [
          { id: crypto.randomUUID(), time: activityTime(), category: "SYSTEM", message: `청중평가 ${action.status}` },
          ...state.activities,
        ],
      };
    case "SUBMIT_VOTE":
      if (!canSubmitVote(state.votingStatus, state.myVotedTeamIds, action.teamId)) return state;
      return {
        ...state,
        voteCount: state.voteCount + 1,
        myVotedTeamIds: [...state.myVotedTeamIds, action.teamId],
        activities: [
          { id: crypto.randomUUID(), time: activityTime(), category: "AUDIENCE VOTE", message: `${action.teamId} 평가 제출` },
          ...state.activities,
        ],
      };
    case "SUBMIT_JUDGE": {
      const targetIndex = state.judgeProgress.findIndex((judge) => judge.completed < judge.total);
      if (targetIndex < 0) return state;
      const judgeProgress = state.judgeProgress.map((judge, index) =>
        index === targetIndex ? { ...judge, completed: judge.total } : judge,
      );
      return {
        ...state,
        judgeProgress,
        activities: [
          { id: crypto.randomUUID(), time: activityTime(), category: "JUDGING", message: `${judgeProgress[targetIndex].id} 제출 완료` },
          ...state.activities,
        ],
      };
    }
    case "DRAW_PRIZE": {
      const participantId = nextPrizeWinner(state.prizeHistory.map((record) => record.participantId));
      if (!participantId) return state;
      const record = { round: state.prizeHistory.length + 1, participantId, drawnAt: clockTime() };
      return {
        ...state,
        prizeHistory: [...state.prizeHistory, record],
        activities: [
          { id: crypto.randomUUID(), time: activityTime(), category: "PRIZE", message: `${participantId} 당첨` },
          ...state.activities,
        ],
      };
    }
    case "SET_MODE":
      return { ...state, mode: action.mode };
    case "SET_STATUS":
      return { ...state, status: action.status };
    case "SET_NETWORK":
      return { ...state, networkOverride: action.network };
    case "SET_QA_SCENARIO":
      return { ...state, qaScenario: action.scenario };
    case "RESET_REHEARSAL":
      return structuredClone(INITIAL_EVENT_STATE);
    default:
      return state;
  }
}

type EventOpsContextValue = {
  state: EventOpsState;
  checkIn: (code: string) => Promise<CheckInResult>;
  refreshOperations: () => Promise<void>;
  setVotingStatus: (status: VotingStatus) => Promise<boolean>;
  submitVote: (teamId: string) => boolean;
  submitJudge: () => void;
  drawPrize: () => Promise<PrizeRecord | null>;
  updateTeam: (update: Omit<TeamUpdate, "eventId">) => Promise<boolean>;
  updatePrizeDefinition: (update: Omit<PrizeDefinitionUpdate, "eventId">) => Promise<boolean>;
  setMode: (mode: EventMode) => Promise<boolean>;
  setEventStatus: (status: EventStatus) => Promise<boolean>;
  activateTeam: (teamId: string) => Promise<boolean>;
  completeActiveTeam: () => Promise<boolean>;
  setDisplayMode: (displayMode: DisplayMode) => Promise<boolean>;
  setNetwork: (network: NetworkState) => void;
  setQaScenario: (scenario: string | null) => void;
  resetRehearsal: () => Promise<boolean>;
};

const EventOpsContext = createContext<EventOpsContextValue | null>(null);

export function EventOpsProvider({ children, runtimeMode }: { children: React.ReactNode; runtimeMode: RuntimeMode }) {
  const initialState = runtimeMode === "mock" ? INITIAL_EVENT_STATE : { ...EMPTY_EVENT_STATE, runtimeMode };
  const [state, dispatch] = useReducer(eventOpsReducer, initialState);
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const latestVersionRef = useRef(0);
  const refreshOperations = useCallback(async () => {
    if (inFlightRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    inFlightRef.current = true;
    try {
      const response = await fetch("/api/event/snapshot", { cache: "no-store", signal: controller.signal });
      if (!response.ok) {
        dispatch({ type: "SNAPSHOT_FAILED" });
        return;
      }
      const payload = await response.json();
      if (payload.runtimeMode !== runtimeMode) {
        dispatch({ type: "SNAPSHOT_FAILED" });
        return;
      }
      if (payload.data.version < latestVersionRef.current) return;
      latestVersionRef.current = payload.data.version;
      dispatch({
        type: "HYDRATE_SERVER_STATE",
        eventId: payload.data.eventId,
        mode: payload.data.mode,
        status: payload.data.status,
        votingStatus: payload.data.votingStatus,
        version: payload.data.version,
        serverTime: payload.data.serverTime,
        activeTeamId: payload.data.activeTeamId,
        displayMode: payload.data.displayMode,
        resultStatus: payload.data.resultStatus,
        revealStep: payload.data.revealStep,
        registeredCount: payload.data.registeredCount,
        checkInCount: payload.data.checkInCount,
        voteCount: payload.data.voteCount,
        voteByTeam: payload.data.voteByTeam,
        judgeProgress: payload.data.judgeProgress,
        checkIns: payload.data.checkIns.map((record: CheckInRecord) => ({ ...record, time: formatSeoulTime(record.time) })),
        prizeHistory: payload.data.prizeHistory.map((record: PrizeRecord) => ({ ...record, drawnAt: formatSeoulTime(record.drawnAt) })),
        prizeCatalog: payload.data.prizeCatalog,
        teams: payload.data.teams,
      });
    } catch {
      dispatch({ type: "SNAPSHOT_FAILED" });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      inFlightRef.current = false;
    }
  }, [runtimeMode]);

  useEffect(() => {
    void refreshOperations();
  }, [refreshOperations]);

  useEffect(() => {
    if (!window.location.pathname.startsWith("/admin")) return;
    const refresh = () => void refreshOperations();
    const timer = window.setInterval(refresh, 3_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      abortRef.current?.abort();
    };
  }, [refreshOperations]);

  const mutateEventControl = useCallback(async (body: Record<string, string>) => {
    try {
      const response = await fetch("/api/event/control", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) return false;
      await refreshOperations();
      return true;
    } catch {
      return false;
    }
  }, [refreshOperations]);

  const value = useMemo<EventOpsContextValue>(() => ({
    state,
    checkIn: async (code) => {
      if (!state.snapshotReady) return { status: "ERROR" };
      dispatch({ type: "CHECK_IN_PENDING" });
      try {
        const response = await fetch("/api/check-ins", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ participantCode: code, source: "MANUAL" }),
        });
        const payload = await response.json();
        if (!response.ok) {
          const result: CheckInResult = { status: "ERROR" };
          dispatch({ type: "CHECK_IN_RESULT", result });
          return result;
        }
        const data = payload.data as {
          status: CheckInResult["status"];
          participantCode?: string;
          checkedInAt?: string;
        };
        const displayedTime = data.checkedInAt ? formatSeoulTime(data.checkedInAt) : undefined;
        const result: CheckInResult = {
          status: data.status,
          participantId: data.participantCode,
          time: data.status === "SUCCESS" ? displayedTime : undefined,
          previousTime: data.status === "ALREADY_CHECKED_IN" ? displayedTime : undefined,
        };
        dispatch({ type: "CHECK_IN_RESULT", result });
        await refreshOperations();
        return result;
      } catch {
        const result: CheckInResult = { status: "ERROR" };
        dispatch({ type: "CHECK_IN_RESULT", result });
        return result;
      }
    },
    refreshOperations,
    setVotingStatus: async (status) => state.snapshotReady && mutateEventControl({ action: "SET_VOTING", eventId: state.eventId, status }),
    submitVote: (teamId) => {
      if (state.runtimeMode !== "mock") return false;
      const accepted = canSubmitVote(state.votingStatus, state.myVotedTeamIds, teamId);
      if (accepted) dispatch({ type: "SUBMIT_VOTE", teamId });
      return accepted;
    },
    submitJudge: () => {
      if (state.runtimeMode === "mock") dispatch({ type: "SUBMIT_JUDGE" });
    },
    drawPrize: async () => {
      if (!state.snapshotReady) return null;
      try {
        const response = await fetch("/api/prizes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId: state.eventId }),
        });
        if (!response.ok) return null;
        const payload = await response.json();
        await refreshOperations();
        return { ...payload.data, drawnAt: formatSeoulTime(payload.data.drawnAt) } as PrizeRecord;
      } catch {
        return null;
      }
    },
    updateTeam: async (update) => {
      if (!state.snapshotReady) return false;
      try {
        const response = await fetch("/api/teams", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...update, eventId: state.eventId }),
        });
        if (!response.ok) return false;
        await refreshOperations();
        return true;
      } catch {
        return false;
      }
    },
    updatePrizeDefinition: async (update) => {
      if (!state.snapshotReady) return false;
      try {
        const response = await fetch("/api/prize-catalog", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...update, eventId: state.eventId }),
        });
        if (!response.ok) return false;
        await refreshOperations();
        return true;
      } catch {
        return false;
      }
    },
    setMode: async (mode) => state.snapshotReady && mutateEventControl({ action: "SET_MODE", eventId: state.eventId, mode }),
    setEventStatus: async (status) => state.snapshotReady && mutateEventControl({ action: "SET_STATUS", eventId: state.eventId, status }),
    activateTeam: async (teamId) => state.snapshotReady && mutateEventControl({ action: "ACTIVATE_TEAM", eventId: state.eventId, teamId }),
    completeActiveTeam: async () => state.snapshotReady && mutateEventControl({ action: "COMPLETE_TEAM", eventId: state.eventId }),
    setDisplayMode: async (displayMode) => state.snapshotReady && mutateEventControl({ action: "SET_DISPLAY", eventId: state.eventId, displayMode }),
    setNetwork: (network) => dispatch({ type: "SET_NETWORK", network }),
    setQaScenario: (scenario) => dispatch({ type: "SET_QA_SCENARIO", scenario }),
    resetRehearsal: async () => {
      const accepted = await mutateEventControl({ action: "RESET_REHEARSAL", eventId: state.eventId });
      if (accepted) await refreshOperations();
      return accepted;
    },
  }), [mutateEventControl, refreshOperations, state]);

  return <EventOpsContext.Provider value={value}>{children}</EventOpsContext.Provider>;
}

export function useEventOps() {
  const context = useContext(EventOpsContext);
  if (!context) throw new Error("useEventOps must be used within EventOpsProvider");
  return context;
}
