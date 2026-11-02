export const FINALIST_AWARDS = [
  { title: "대상", amount: 450_000, count: 2 },
  { title: "최우수상", amount: 200_000, count: 2 },
  { title: "우수상", amount: 150_000, count: 4 },
  { title: "Challenge 학장상", amount: null, count: 4 },
] as const;

export const LUCKY_DRAW_PRIZES = [
  { pool: "청중평가단", name: "아웃백 상품권", amount: 80_000, count: 2 },
  { pool: "청중평가단", name: "커피 쿠폰", amount: 10_000, count: 6 },
  { pool: "전체 참여자", name: "에어팟", amount: 250_000, count: 1 },
  { pool: "전체 참여자", name: "커피 쿠폰", amount: 10_000, count: 14 },
  { pool: "전체 참여자", name: "올리브영 상품권", amount: 30_000, count: 6 },
  { pool: "전체 참여자", name: "올리브영 상품권", amount: 20_000, count: 6 },
] as const;

export const BEST_REVIEWER_POLICY = {
  eligibility: "청중평가에서 실제 1위 수상팀을 맞힌 참여자",
  prize: "최종 확인 예정 · 2등 경품 해당 예정",
} as const;

export const CEREMONY_RUN_OF_SHOW = [
  { order: 12, title: "청중평가", detail: "각 부문에서 1위 후보 2팀 선정", status: "확정" },
  { order: 14, title: "2차 럭키드로우", detail: "3부 시작 전 · 2부 참석자 대상 · 4등·3등 경품", status: "상품 연결 확인 예정" },
  { order: 15, title: "심사평·심사결과 공개", detail: "전광판 SHOW · 승인된 결과만 공개", status: "공식 결과 잠금 유지" },
  { order: 16, title: "시상식", detail: "본선 시상 · 베스트 리뷰어 시상(2등상) · 3차 럭키드로우(1등)", status: "확정" },
] as const;
