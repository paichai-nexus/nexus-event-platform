import type { TeamCategory } from "../../../types/team.ts";

export type FinalistCandidate = {
  name: string;
  category: TeamCategory;
  topic: string;
  /** Personal data is intentionally absent from the Git-tracked catalog. */
  leaderName?: string;
  memberNames?: string[];
};

// 공개 홍보가 가능한 팀 정보만 소스에 둔다. 참가자 실명은 운영 DB에서만 관리한다.
export const FINALIST_CANDIDATES: FinalistCandidate[] = [
  { name: "EVER OASIS", category: "STARTUP", topic: "독립적 GPS를 내장 시킨 세련된 디자인 형 목걸이" },
  { name: "밋턴", category: "STARTUP", topic: "로테이션소개팅" },
  { name: "시너지", category: "BUSINESS_ANALYSIS", topic: "광통신 산업의 성장 사이클과 성호전자의 사업 다각화 전략이 기업 가치에 미치는 영향" },
  { name: "밸류루트", category: "STARTUP", topic: "밥픽(BABPICK, 가칭) - 예산 안에서 여러 식당의 메뉴와 가격을 한눈에 비교하는 식당 탐색 웹서비스" },
  { name: "TEAM:HOTEL", category: "STARTUP", topic: "고객 맞춤형 티타임 설계 기반 카페&바 및 MICE 연계 서비스" },
  { name: "관광ON", category: "STARTUP", topic: "야간관광활성화" },
  { name: "가치로", category: "BUSINESS_ANALYSIS", topic: "에어로케이 기업분석" },
  { name: "TOUCHPOINT", category: "BUSINESS_ANALYSIS", topic: "항공산업 구조 개편에 따른 기업 분석" },
  { name: "타겟", category: "STARTUP", topic: "센서와 영상을 활용해 양궁 훈련 데이터를 분석하고, 선수·지도자·이용자를 연결하는 양궁 전문 훈련 플랫폼" },
  { name: "어프로치", category: "BUSINESS_ANALYSIS", topic: "고성장 이후의 APR: 글로벌 뷰티테크 기업의 지속성장 전략" },
  { name: "분석할계룡", category: "BUSINESS_ANALYSIS", topic: "기업분석" },
  { name: "김성근", category: "STARTUP", topic: "온도 반응형 색 변화 기술을 활용한 식품 안전 용기 개발" },
  { name: "이면", category: "BUSINESS_ANALYSIS", topic: "매출은 늘었는데 이익은 왜 줄었을까?" },
  { name: "이어봄", category: "STARTUP", topic: "장도 공예를 활용한 K-리빙 브랜드 사업화" },
  { name: "조선제일주", category: "BUSINESS_ANALYSIS", topic: "(주)선양소주 기업분석 및 미래전략 제안" },
];

export function finalistProfileForName(name: string | null) {
  return name ? FINALIST_CANDIDATES.find((candidate) => candidate.name === name) : undefined;
}
