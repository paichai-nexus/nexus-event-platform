export const EVALUATION_POLICY = [
  { item: "참가자 투표 자격", status: "PARTIAL", rule: "현장 체크인 완료자만 허용", note: "공개 투표 화면과 서버 제출 API의 본인 식별 연결 필요" },
  { item: "유효표", status: "CONFIRMED", rule: "투표 OPEN 중 제출·활성 참가자·활성 팀·점수 범위 충족", note: "DB 범위 검증과 팀별 중복 방지 제약 존재" },
  { item: "무효표", status: "CONFIRMED", rule: "마감 후 제출·중복 제출·비활성 참가자·범위 밖 점수", note: "무효 사유별 감사 기록은 추가 필요" },
  { item: "전문/청중 반영률", status: "PENDING", rule: "시스템 기존안 80/20 · 제공 심사표 70/30", note: "서로 충돌하므로 교수진 승인과 규칙 버전 확정 필요" },
  { item: "팀별 전문심사 점수", status: "PARTIAL", rule: "서류 50 + 발표 100 + 문답 50 = 심사위원 1인당 200점", note: "제공 심사표에서 항목·배점 확인, 운영 적용 승인 필요" },
  { item: "청중평가 환산", status: "PENDING", rule: "원점수를 100점으로 환산하는 방식 미확정", note: "평균/중앙값/절사 여부 결정 필요" },
  { item: "동점 처리", status: "PENDING", rule: "동점 팀은 공동 순위로 표시하고 확정 차단", note: "우선순위 규정 승인 필요" },
  { item: "평가 시간", status: "PARTIAL", rule: "관리자가 READY·OPEN·CLOSED를 수동 제어", note: "자동 시작·종료 시각은 미설정" },
  { item: "관리자 변경 권한", status: "CONFIRMED", rule: "ADMIN·STAFF만 평가 상태 변경", note: "모든 상태 변경은 Audit Log 대상" },
  { item: "확정 이후 변경", status: "PARTIAL", rule: "심사 제출은 읽기 전용, 최종 확정은 현재 차단", note: "공식 기준 확정 후 결과 Snapshot 절차 연결 필요" },
] as const;

export const SCORING_POLICY_READY = false;

export const DOCUMENT_SCORING_POLICY = {
  sourceVersion: "심사평가기준표-03",
  approvalStatus: "CONFLICT_REQUIRES_APPROVAL",
  professionalWeight: 0.7,
  audienceWeight: 0.3,
  judgeCount: 3,
  professionalMaxPerJudge: 200,
  audienceSelectionCount: 2,
  expectedAudienceCount: 120,
  totalMax: 840,
} as const;

export const COMMON_DOCUMENT_CRITERIA = {
  document: [
    "문제 정의 및 분석의 논리성",
    "분석·아이디어의 독창성",
    "내용의 충실성 및 완성도",
    "현실성 및 실행가능성",
    "핵심내용의 이해 및 기여도",
  ].map((name, index) => ({ id: `DOCUMENT-${index + 1}`, phase: "DOCUMENT", name, maxScore: 10 })),
  qa: [
    "핵심내용에 대한 이해도",
    "질문의 정확한 파악 및 논리적 답변",
    "전문지식 및 근거 제시능력",
    "비판적 사고 및 대응능력",
    "실행 및 문제해결 능력",
  ].map((name, index) => ({ id: `QA-${index + 1}`, phase: "QA", name, maxScore: 10 })),
} as const;

export const PRESENTATION_DOCUMENT_CRITERIA = {
  STARTUP: [
    ["아이템의 문제해결력·혁신성", 20],
    ["시장성·수익모델", 15],
    ["사업화 가능성", 15],
    ["실행전략·팀 역량", 20],
    ["성장성·지속가능성", 15],
    ["발표 구성·전달력", 15],
  ],
  BUSINESS_ANALYSIS: [
    ["기업·산업 이해 및 핵심이슈 도출", 20],
    ["자료·분석의 타당성", 15],
    ["분석의 깊이·통찰력", 15],
    ["전략적 대안의 창의성", 20],
    ["전략의 실행가능성·기대효과", 15],
    ["발표 구성·전문성·설득력", 15],
  ],
} as const;
