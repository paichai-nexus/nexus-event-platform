export const AUDIENCE_JURY_DEPARTMENTS = [
  "경영학과",
  "IT경영정보학과",
  "관광경영학과",
  "항공서비스학과",
  "글로벌비즈니스학과",
  "호텔항공경영학과",
] as const;

export type AudienceJuryDepartment = typeof AUDIENCE_JURY_DEPARTMENTS[number];

export const AUDIENCE_JURY_PCU_RANGES: Record<AudienceJuryDepartment, { start: number; end: number }> = {
  "경영학과": { start: 101, end: 120 },
  "IT경영정보학과": { start: 201, end: 220 },
  "관광경영학과": { start: 401, end: 420 },
  "항공서비스학과": { start: 501, end: 520 },
  "글로벌비즈니스학과": { start: 301, end: 320 },
  "호텔항공경영학과": { start: 601, end: 620 },
};

export function formatAudienceJuryPcuCode(value: number) {
  return `PCU-${String(value).padStart(3, "0")}`;
}

export type AudienceJuryRegistration = {
  department: AudienceJuryDepartment;
  name: string;
  studentNumber: string;
  serialNumber: string;
  position: number;
  capacity: number;
  acceptedAt: string;
};

export type AudienceJuryCapacity = {
  department: AudienceJuryDepartment;
  accepted: number;
  remaining: number;
  capacity: number;
  pcuStart: string;
  pcuEnd: string;
};

export type AudienceJuryState = {
  registration: AudienceJuryRegistration | null;
  departments: AudienceJuryCapacity[];
  totalAccepted: number;
  totalCapacity: number;
};
