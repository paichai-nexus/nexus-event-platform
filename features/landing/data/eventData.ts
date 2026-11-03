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
  { label: "프로그램", href: "#program" },
  { label: "본선 참가팀", href: "#finalists" },
  { label: "청중평가", href: "#vote" },
  { label: "시상 안내", href: "#awards" },
];

export const PROGRAM_ITEMS: ProgramItem[] = [
  { id: "01", time: "13:00 – 13:40", category: "지역 주요기업 설명회", title: "호텔ICC" },
  { id: "02", time: "13:50 – 14:30", category: "지역 주요기업 설명회", title: "계룡건설" },
  { id: "03", time: "14:40 – 15:30", category: "CEO 특강", title: "선양 소주 조웅래 회장" },
  { id: "04", time: "15:40 – 16:40", title: "창업 부문 본선" },
  { id: "05", time: "16:50 – 17:20", title: "기업분석 부문 본선" },
  { id: "06", time: "17:20 – 17:30", title: "청중평가 집계" },
  { id: "07", time: "17:30 – 18:00", title: "시상식" },
];

export const FINALISTS: Finalist[] = [
  {
    id: "S01", name: "관광ON", category: "창업 부문", department: "관광경영학과",
    description: "체류형 야간관광 서비스 '진주 밤 패스' 사업 제안",
    members: [], advisors: [], coverImage: "/team-materials/covers/startup-01.png",
    materialUrl: "/team-materials/startup-01-tourism-night-pass.pptx", materialFormat: "PPTX", isPlaceholder: false,
  },
  {
    id: "S02", name: "TEA:MATE", category: "창업 부문", department: "호텔항공경영학과",
    description: "고객 맞춤형 티타임 설계 기반 카페·바 및 MICE 연계 서비스",
    members: ["김소윤", "김민건", "성지민", "장지한"], advisors: ["곽용섭", "박근수"],
    coverImage: "/team-materials/covers/startup-02.png", materialUrl: "/team-materials/startup-02-team-hotel.pdf", materialFormat: "PDF", isPlaceholder: false,
  },
  {
    id: "S03", name: "연애하자", category: "창업 부문", department: "경영학과",
    description: "대전 대학생을 위한 취미 활동 기반 로테이션 소개팅 '밋턴'",
    members: ["안성열", "최병현", "홍경훈"], advisors: [], coverImage: "/team-materials/covers/startup-03.png",
    materialUrl: "/team-materials/startup-03-meeturn.pptx", materialFormat: "PPTX", isPlaceholder: false,
  },
  {
    id: "S04", name: "EVER OASIS", category: "창업 부문", department: "항공서비스학과",
    description: "독립형 GPS 비상목걸이 EverOasis",
    members: [], advisors: [], coverImage: "/team-materials/covers/startup-04.png",
    materialUrl: "/team-materials/startup-04-ever-oasis.pdf", materialFormat: "PDF", isPlaceholder: false,
  },
  {
    id: "S05", name: "타겟", category: "창업 부문", department: "IT경영정보학과",
    description: "센서 기반 양궁 트래킹 플랫폼 Release Pro",
    members: ["서세은", "이미란", "임이안"], advisors: [], coverImage: "/team-materials/covers/startup-05.png",
    materialUrl: "/team-materials/startup-05-target.pptx", materialFormat: "PPTX", isPlaceholder: false,
  },
  {
    id: "S06", name: "김성근", category: "창업 부문", department: "글로벌비즈니스학과",
    description: "홍삼·꿀 프리미엄 그릭요거트 K-웰니스 사업",
    members: ["조범근", "김동현", "홍성빈"], advisors: [], coverImage: "/team-materials/covers/startup-06.png",
    materialUrl: "/team-materials/startup-06-k-wellness-yogurt.pptx", materialFormat: "PPTX", isPlaceholder: false,
  },
  {
    id: "B01", name: "가치로", category: "기업분석 부문", department: "글로벌비즈니스학과",
    description: "메가 LCC 시대, 에어부산의 경쟁 전략",
    members: ["신예준", "김지원", "김혜원"], advisors: [], coverImage: "/team-materials/covers/analysis-01.png",
    materialUrl: "/team-materials/analysis-01-air-busan.pdf", materialFormat: "PDF", isPlaceholder: false,
  },
  {
    id: "B02", name: "조선제일주", category: "기업분석 부문", department: "경영학과",
    description: "재무분석을 통한 선양소주 브랜드 향상 전략",
    members: ["전도언", "이윤석", "장재진", "김성혁"], advisors: [], coverImage: "/team-materials/covers/analysis-02.png",
    materialUrl: "/team-materials/analysis-02-sunyang-soju.pptx", materialFormat: "PPTX", isPlaceholder: false,
  },
  {
    id: "B03", name: "어프로치", category: "기업분석 부문", department: "호텔항공경영학과",
    description: "고성장 이후의 APR, 글로벌 뷰티테크 기업의 지속성장 전략",
    members: ["표민기", "최유현", "전현정", "최벼리", "김태연"], advisors: [], coverImage: "/team-materials/covers/analysis-03.png",
    materialUrl: "/team-materials/analysis-03-apr.pdf", materialFormat: "PDF", isPlaceholder: false,
  },
  {
    id: "B04", name: "분석할계룡", category: "기업분석 부문", department: "경영학과",
    description: "이익 회복을 넘어 현금과 기업가치의 지속가능성을 분석한 계룡건설산업 보고서",
    members: ["소명", "한예지", "성현경", "이현승"], advisors: [], coverImage: "/team-materials/covers/analysis-04.png",
    materialUrl: "/team-materials/analysis-04-kyeryong.pdf", materialFormat: "PDF", isPlaceholder: false,
  },
  {
    id: "B05", name: "시너지", category: "기업분석 부문", department: "IT경영정보학과",
    description: "광통신 성장과 성호전자의 투자 가치",
    members: [], advisors: [], coverImage: "/team-materials/covers/analysis-05.png",
    materialUrl: "/team-materials/analysis-05-sungho-electronics.pptx", materialFormat: "PPTX", isPlaceholder: false,
  },
  {
    id: "B06", name: "TOUCHPOINT", category: "기업분석 부문", department: "항공서비스학과",
    description: "항공산업 기업분석에 따른 객실승무원 취업 전략",
    members: [], advisors: [], coverImage: "/team-materials/covers/analysis-06.png",
    materialUrl: "/team-materials/analysis-06-korean-air.pptx", materialFormat: "PPTX", isPlaceholder: false,
  },
];

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
