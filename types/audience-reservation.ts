import type { AudienceJuryDepartment } from "@/types/audience-jury";

export type AudienceReservation = {
  id: string;
  department: AudienceJuryDepartment;
  name: string;
  studentNumber: string;
  reservedAt: string;
  paperSignedAt: string | null;
  qrCheckedInAt: string | null;
  pcuCode: string | null;
};

export type AudienceReservationSummary = {
  total: number;
  signed: number;
  qrCheckedIn: number;
  juryAccepted: number;
};
