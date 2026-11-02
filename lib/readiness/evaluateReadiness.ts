import type { ReadinessCheck, ReadinessInput } from "@/types/readiness";
export function evaluateReadiness(input: ReadinessInput): ReadinessCheck[] {
  return [
    { id: "runtime", label: "운영 저장소", level: input.runtimeMode === "staging" || input.runtimeMode === "production" ? "PASS" : "BLOCK", detail: input.runtimeMode === "mock" ? "현재 Mock입니다. 리허설은 가능하지만 실제 운영 데이터로 사용할 수 없습니다." : `${input.runtimeMode.toUpperCase()} 영구 저장소`, href: "/admin/settings" },
    { id: "backend", label: "서버·DB 연결", level: input.backendReady ? "PASS" : "BLOCK", detail: input.backendReady ? "Readiness 응답 정상" : "서버 또는 데이터베이스 연결 확인 필요" },
    { id: "snapshot", label: "관리자 Snapshot", level: input.snapshotReady ? "PASS" : "BLOCK", detail: input.snapshotReady ? "운영 화면 동기화 정상" : "운영 Snapshot을 받지 못했습니다.", href: "/admin/dashboard" },
    { id: "teams", label: "본선팀 소개 정보", level: input.teamCount > 0 && input.completeTeamProfiles === input.teamCount ? "PASS" : "WARN", detail: `${input.completeTeamProfiles}/${input.teamCount}팀 · 팀명·학과·대표자·지도교수·발표주제`, href: "/admin/teams" },
    { id: "audience", label: "청중평가 예약·서명", level: input.reservationCount >= 120 ? "PASS" : "WARN", detail: `예약 ${input.reservationCount}/120명 · 종이 서명 ${input.signedCount}명`, href: "/admin/audience" },
    { id: "draw-second", label: "2차 추첨 대상자", level: input.secondDrawLocked ? "PASS" : "BLOCK", detail: input.secondDrawLocked ? "대상자 Snapshot 봉인 완료" : "2부 참석자 기준 대상자 봉인 필요", href: "/admin/prize" },
    { id: "draw-third", label: "3차 추첨 대상자", level: input.thirdDrawLocked ? "PASS" : "BLOCK", detail: input.thirdDrawLocked ? "대상자 Snapshot 봉인 완료" : "시상식 전 대상자 봉인 필요", href: "/admin/prize" },
    { id: "result-show", label: "심사평·결과 SHOW", level: input.resultShowApproved ? "PASS" : "BLOCK", detail: input.resultShowApproved ? "ADMIN 승인 자료 준비 완료" : "초안 입력 및 ADMIN 승인 필요", href: "/admin/results" },
    { id: "best-reviewer", label: "베스트 리뷰어", level: input.bestReviewerReady ? "PASS" : "WARN", detail: input.bestReviewerReady ? "승인 자료에 수상자 포함" : "수상자 확정 후 결과 자료에 입력 필요", href: "/admin/results" },
    { id: "scoring-document", label: "평가정책 문서", level: input.scoringPolicyDocumentApproved ? "PASS" : "BLOCK", detail: input.scoringPolicyDocumentApproved ? "ADMIN 승인 정책 문서 준비 완료" : "비율·환산식·동점·부문별 규칙 입력 후 ADMIN 승인 필요", href: "/admin/scoring" },
    { id: "scoring", label: "공식 산식 활성화", level: input.scoringPolicyReady ? "PASS" : "BLOCK", detail: input.scoringPolicyReady ? "검증된 공식 산식이 활성화되었습니다." : "정책 문서 승인과 별도로 산식 코드·회귀 테스트·운영 승인 필요", href: "/admin/scoring" },
  ];
}
