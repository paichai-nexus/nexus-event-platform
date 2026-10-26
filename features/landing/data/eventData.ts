import type {
  Award,
  Finalist,
  Partner,
  ProgramItem,
  ProjectTeamMember,
} from "@/features/landing/types/landing";

export const EVENT_INFO = {
  name: "제24회 배재대학교 경영대학 학술제",
  date: "2026. 11. 04. (수)",
  dateTime: "2026-11-04T13:00:00+09:00",
  time: "13:00 ~ 17:30",
  venue: "배재대학교 21세기관",
  mapUrl: null as string | null,
  phases: [
    ["1부", "기업 설명회 / CEO 특강"],
    ["2부", "창업·기업분석 본선"],
    ["3부", "시상식"],
  ],
};

export const NAV_ITEMS = [
  { label: "행사 안내", href: "#info" },
  { label: "프로그램", href: "#program" },
  { label: "본선 참가팀", href: "#finalists" },
  { label: "청중평가", href: "#vote" },
  { label: "시상 안내", href: "#awards" },
  { label: "오시는 길", href: "#info" },
];

export const PROGRAM_ITEMS: ProgramItem[] = [
  { id: "01", time: "13:00 – 13:40", category: "지역 주요기업 설명회", title: "계룡건설" },
  { id: "02", time: "13:50 – 14:30", category: "지역 주요기업 설명회", title: "에어로케이항공" },
  { id: "03", time: "14:40 – 15:30", category: "CEO 특강", title: "조웅래 회장" },
  { id: "04", time: "15:40 – 16:40", title: "창업 부문 본선" },
  { id: "05", time: "16:50 – 17:20", title: "기업분석 부문 본선" },
  { id: "06", time: "17:20 – 17:30", title: "청중평가 집계" },
  { id: "07", time: "17:30 – 18:00", title: "시상식" },
];

export const FINALISTS: Finalist[] = Array.from({ length: 19 }, (_, index) => ({
  id: String(index + 1).padStart(2, "0"),
  name: "팀명 미등록",
  category: index < 10 ? "창업 부문" : "기업분석 부문",
  description: "공식 참가팀 명단 확보 후 등록 예정",
  isPlaceholder: true,
}));

export const AWARDS: Award[] = [
  { title: "대상", prize: "450,000원", count: "× 2팀", icon: "🏆" },
  { title: "최우수상", prize: "200,000원", count: "× 2팀", icon: "🥇" },
  { title: "우수상", prize: "150,000원", count: "× 4팀", icon: "★" },
  { title: "Challenge 학장상", prize: "", count: "× 4팀", icon: "✹" },
];

export const PARTNERS: Partner[] = [
  { name: "배재대학교 경영대학", englishName: "COLLEGE OF BUSINESS · PAI CHAI UNIVERSITY" },
];

export const COLLABORATION_AREAS = ["기획·운영", "시스템 개발", "디자인", "홍보", "현장 운영"];

export const PROJECT_TEAM: ProjectTeamMember[] = [
  { role: "PROJECT LEAD", name: "운영 책임자" },
  { role: "DEVELOPMENT", name: "개발팀" },
  { role: "DESIGN", name: "디자인팀" },
  { role: "EVENT OPERATION", name: "경영대학 운영팀" },
];
