import type { TeamCategory } from "../../../types/team.ts";

export type FinalistCandidate = {
  name: string;
  category: TeamCategory;
  topic: string;
  department: string;
  advisorName?: string;
  /** Personal data is intentionally absent from the Git-tracked catalog. */
  leaderName?: string;
  memberNames?: string[];
};

// 공개 홍보가 가능한 팀 정보만 소스에 둔다. 참가자 실명은 운영 DB에서만 관리한다.
export const FINALIST_CANDIDATES: FinalistCandidate[] = [
  { name: "관광ON", department: "관광경영학과", category: "STARTUP", topic: "체류형 야간관광 서비스 '진주 밤 패스' 사업 제안" },
  { name: "TEA:MATE", department: "호텔항공경영학과", category: "STARTUP", topic: "고객 맞춤형 티타임 설계 기반 카페·바 및 MICE 연계 서비스", memberNames: ["김소윤", "김민건", "성지민", "장지한"], advisorName: "곽용섭, 박근수" },
  { name: "연애하자", department: "경영학과", category: "STARTUP", topic: "대전 대학생을 위한 취미 활동 기반 로테이션 소개팅 '밋턴'", memberNames: ["안성열", "최병현", "홍경훈"] },
  { name: "EVER OASIS", department: "항공서비스학과", category: "STARTUP", topic: "독립형 GPS 비상목걸이 EverOasis" },
  { name: "타겟", department: "IT경영정보학과", category: "STARTUP", topic: "센서 기반 양궁 트래킹 플랫폼 Release Pro", memberNames: ["서세은", "이미란", "임이안"] },
  { name: "김성근", department: "글로벌비즈니스학과", category: "STARTUP", topic: "홍삼·꿀 프리미엄 그릭요거트 K-웰니스 사업", memberNames: ["조범근", "김동현", "홍성빈"] },
  { name: "가치로", department: "글로벌비즈니스학과", category: "BUSINESS_ANALYSIS", topic: "메가 LCC 시대, 에어부산의 경쟁 전략", memberNames: ["신예준", "김지원", "김혜원"] },
  { name: "조선제일주", department: "경영학과", category: "BUSINESS_ANALYSIS", topic: "재무분석을 통한 선양소주 브랜드 향상 전략", memberNames: ["전도언", "이윤석", "장재진", "김성혁"] },
  { name: "어프로치", department: "호텔항공경영학과", category: "BUSINESS_ANALYSIS", topic: "고성장 이후의 APR, 글로벌 뷰티테크 기업의 지속성장 전략", memberNames: ["표민기", "최유현", "전현정", "최벼리", "김태연"] },
  { name: "분석할계룡", department: "경영학과", category: "BUSINESS_ANALYSIS", topic: "이익 회복을 넘어 현금과 기업가치의 지속가능성을 분석한 계룡건설산업 보고서", memberNames: ["소명", "한예지", "성현경", "이현승"] },
  { name: "시너지", department: "IT경영정보학과", category: "BUSINESS_ANALYSIS", topic: "광통신 성장과 성호전자의 투자 가치" },
  { name: "TOUCHPOINT", department: "항공서비스학과", category: "BUSINESS_ANALYSIS", topic: "항공산업 기업분석에 따른 객실승무원 취업 전략" },
];

export function finalistProfileForName(name: string | null) {
  return name ? FINALIST_CANDIDATES.find((candidate) => candidate.name === name) : undefined;
}
