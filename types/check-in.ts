export type CheckInStatus =
  | "IDLE"
  | "SCANNING"
  | "SUCCESS"
  | "ALREADY_CHECKED_IN"
  | "NOT_FOUND"
  | "INACTIVE"
  | "INVALID_EVENT"
  | "ERROR";

export type CheckInRecord = {
  participantId: string;
  time: string;
};

export type CheckInResult = {
  status: CheckInStatus;
  participantId?: string;
  time?: string;
  previousTime?: string;
};
