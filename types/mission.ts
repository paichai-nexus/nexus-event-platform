export type MissionType = "DEPARTMENT_INTRO" | "TEAM_SUPPORT" | "BUSINESS_QUIZ" | "OX_QUIZ" | "APPLAUSE_EXPERIMENT";
export type MissionStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type ParticipationStatus = "PENDING" | "APPROVED" | "REJECTED";

export type CheerMission = {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  points: number;
  status: MissionStatus;
  experimental: boolean;
};

export type MissionParticipation = {
  id: string;
  missionId: string;
  participantId: string;
  status: ParticipationStatus;
  awardedPoints: number;
  createdAt: string;
};
