export type TeamCategory = "STARTUP" | "BUSINESS_ANALYSIS";

export type Team = {
  id: string;
  name: string | null;
  department: string | null;
  advisorName: string | null;
  leaderName: string | null;
  memberNames: string[];
  topic: string | null;
  promotionEnabled: boolean;
  order: number;
  category: TeamCategory;
  status: "READY" | "PRESENTING" | "DONE";
  active: boolean;
};

export type TeamUpdate = Pick<Team, "id" | "name" | "department" | "advisorName" | "leaderName" | "memberNames" | "topic" | "promotionEnabled" | "order" | "category" | "status" | "active"> & {
  eventId: string;
};
