export type AudienceAttendanceState = {
  known: boolean;
  active: boolean;
  participantId: string;
  enteredAt: string | null;
  activeCount: number;
};
