export type ProgramItem = {
  id: string;
  time?: string;
  category?: string;
  title: string;
  description?: string;
};

export type FinalistCategory = "전체" | "창업 부문" | "기업분석 부문";

export type Finalist = {
  id: string;
  name: string;
  category: Exclude<FinalistCategory, "전체">;
  department: string;
  description: string;
  members: string[];
  advisors: string[];
  coverImage: string;
  materialUrl: string;
  materialFormat: "PDF" | "PPTX";
  isPlaceholder: boolean;
};

export type Award = {
  title: string;
  prize: string;
  count: string;
  icon: string;
};

export type Partner = {
  name: string;
  englishName: string;
};

export type ProjectTeamMember = {
  role: string;
  name: string;
};
