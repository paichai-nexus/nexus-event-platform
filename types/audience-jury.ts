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
  "IT경영정보학과": { start: 121, end: 140 },
  "관광경영학과": { start: 141, end: 160 },
  "항공서비스학과": { start: 161, end: 180 },
  "글로벌비즈니스학과": { start: 181, end: 200 },
  "호텔항공경영학과": { start: 201, end: 220 },
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
