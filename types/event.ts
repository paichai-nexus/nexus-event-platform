export type EventMode = "REHEARSAL" | "LIVE";

export type EventStatus =
  | "SETUP"
  | "CHECK_IN_OPEN"
  | "VOTING_READY"
  | "VOTING_OPEN"
  | "VOTING_CLOSED"
  | "JUDGING"
  | "SCORING"
  | "FINALIZED"
  | "ENDED";

export type NetworkState = "ONLINE" | "OFFLINE";

export type DisplayMode = "SPOTLIGHT" | "VOTE_PROGRESS" | "HOLDING" | "AWARD_REVEAL";

export type ResultStatus = "LOCKED" | "FINALIZED" | "REVEALING" | "PUBLISHED";

export const DISPLAY_MODE_LABELS: Record<DisplayMode, string> = {
  SPOTLIGHT: "발표팀 소개",
  VOTE_PROGRESS: "투표 현황",
  HOLDING: "대기 화면",
  AWARD_REVEAL: "수상 발표",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  SETUP: "행사 준비",
  CHECK_IN_OPEN: "입장 진행",
  VOTING_READY: "투표 준비",
  VOTING_OPEN: "청중평가 진행",
  VOTING_CLOSED: "청중평가 마감",
  JUDGING: "심사 진행",
  SCORING: "점수 집계",
  FINALIZED: "결과 확정",
  ENDED: "행사 종료",
};
