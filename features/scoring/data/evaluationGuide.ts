export type EvaluationCriterion = { name: string; points: number };

export const DOCUMENT_CRITERIA: EvaluationCriterion[] = [
  { name: "문제 정의 및 분석 논리", points: 10 },
  { name: "분석·아이디어의 독창성", points: 10 },
  { name: "내용 충실도 및 완성도", points: 10 },
  { name: "현실성 및 실현 가능성", points: 10 },
  { name: "이해도 및 기여도", points: 10 },
];

export const PRESENTATION_CRITERIA = {
  STARTUP: [
    { name: "아이템의 문제 해결성·혁신성", points: 20 },
    { name: "시장성 및 수익 모델", points: 15 },
    { name: "사업화 가능성", points: 15 },
    { name: "실행 전략 및 팀 역량", points: 20 },
    { name: "성장성 및 지속 가능성", points: 15 },
    { name: "발표 구성 및 전달력", points: 15 },
  ],
  BUSINESS_ANALYSIS: [
    { name: "기업·산업 이해 및 핵심 이슈", points: 20 },
    { name: "자료 및 분석의 타당성", points: 15 },
    { name: "분석의 깊이 및 통찰력", points: 15 },
    { name: "전략 대안의 창의성", points: 20 },
    { name: "전략의 실현 가능성 및 기대 효과", points: 15 },
    { name: "발표 구성·전문성·설득력", points: 15 },
  ],
} satisfies Record<string, EvaluationCriterion[]>;

export const QNA_CRITERIA: EvaluationCriterion[] = [
  { name: "핵심 내용 이해도", points: 10 },
  { name: "질문 이해의 정확성 및 답변 논리", points: 10 },
  { name: "전문성 및 근거 제시", points: 10 },
  { name: "비판적 사고 및 대응력", points: 10 },
  { name: "실행력 및 문제 해결력", points: 10 },
];

export const SCORE_BANDS = [
  { maximum: 20, bands: ["17–20 매우 우수", "14–16 우수", "10–13 보통", "6–9 미흡", "0–5 매우 미흡"] },
  { maximum: 15, bands: ["13–15 매우 우수", "10–12 우수", "8–9 보통", "5–7 미흡", "0–4 매우 미흡"] },
  { maximum: 10, bands: ["9–10 매우 우수", "7–8 우수", "5–6 보통", "3–4 미흡", "0–2 매우 미흡"] },
] as const;

export const SCORING_SUMMARY = {
  judgeCount: 3,
  pointsPerJudge: 200,
  judgeRawMaximum: 600,
  audienceCount: 120,
  audiencePointsPerPerson: 2,
  audienceRawMaximum: 240,
  statedRawTotal: 840,
  statedWeight: "전문심사 70% · 청중평가 30%",
  policyStatus: "POLICY_APPROVAL_REQUIRED",
} as const;
