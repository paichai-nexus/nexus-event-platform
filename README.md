# NEXUS Event Platform

배재대학교 학술제와 교내 행사의 QR 입장, 청중평가, 심사, 점수 집계와 결과 관리를 하나의 흐름으로 연결하는 모바일 웹 기반 행사 운영 플랫폼입니다.

<!-- NEXUS_PROJECT_META_START -->

## Project Management

| Field            | Value                                                                             |
| ---------------- | --------------------------------------------------------------------------------- |
| Status           | 🟢 Active — MVP Development                                                       |
| Project Lead     | 이영준                                                                               |
| Team / Support   | PAICHAI NEXUS × 배재대학교 경영대학                                                        |
| First Deployment | 제24회 배재대학교 경영대학 학술제                                                               |
| Event Date       | 2026년 11월 4일                                                                      |
| Next Milestone   | 요구사항 확정 및 QR 입장·청중평가 MVP 구현                                                       |
| Registry         | [NEXUS Project Registry](https://github.com/paichai-nexus/nexus-project-registry) |

<!-- NEXUS_PROJECT_META_END -->

## 프로젝트 개요

NEXUS Event Platform은 별도 앱 설치 없이 스마트폰 웹 브라우저에서 이용할 수 있는 행사 운영 시스템입니다.

첫 운영 대상은 제24회 배재대학교 경영대학 학술제이며, 학생·심사위원·행사 담당자가 동일한 데이터를 기반으로 각자 필요한 기능을 사용하도록 구성합니다.

## 첫 공식 적용

### 제24회 배재대학교 경영대학 학술제

* 행사명: 제24회 경영대학 학술제 창업경진대회 및 기업분석공모전
* 일시: 2026년 11월 4일 13:00-17:30
* 장소: 배재대학교 21세기관 콘서트홀 및 P 갤러리
* 협업: 배재대학교 경영대학 × PAICHAI NEXUS

## MVP 기능

* QR 기반 참가자 입장 확인
* 참가자 인증과 중복 입장 방지
* 입장 인증자 대상 현장 청중평가
* 팀별 1인 1회 투표 제한
* 심사위원 전용 평가 입력
* 전문 심사와 청중평가 자동 환산
* 입장·투표·심사 현황 대시보드
* 참석자 대상 경품 추첨
* 참석·평가·최종 결과 내보내기
* 리허설 데이터와 본행사 데이터 분리

## 이번 버전에서 제외하는 기능

* 위치 센서를 이용한 참가자 이동 추적
* 개인별 체류시간 분석
* 군중흐름 AI 예측
* AI를 이용한 자동 탈락 또는 감점
* 다기관 과금과 결제를 포함한 범용 SaaS 기능

체류시간 기반 에이전트 시뮬레이션은 별도의 연구 모델로 검증한 뒤 후속 프로젝트에서 연동 여부를 검토합니다.

## 사용자

| 사용자     | 주요 기능                          |
| ------- | ------------------------------ |
| 참가 학생   | QR 입장, 행사 정보 확인, 청중평가          |
| 심사위원    | 평가 항목별 점수 입력과 제출               |
| 행사 담당자  | 진행 현황, 투표 개폐, 집계 승인, 추첨과 결과 출력 |
| 시스템 관리자 | 행사 설정, 계정·데이터 관리와 장애 대응        |

## 예정 기술 스택

애플리케이션 코드 초기화 전 단계이며, 아래 기술 스택은 개발회의와 요구사항 검토 후 최종 확정합니다.

| 영역                             | 예정 기술                             |
| ------------------------------ | --------------------------------- |
| Frontend                       | Next.js, TypeScript               |
| UI                             | Tailwind CSS                      |
| Backend / Database             | Supabase, PostgreSQL              |
| Authentication / Authorization | Supabase Auth, Row Level Security |
| Validation                     | Zod                               |
| QR                             | Browser-based QR library          |
| Export                         | CSV, XLSX                         |
| Unit Test                      | Vitest                            |
| E2E Test                       | Playwright                        |
| Deployment                     | Vercel, Supabase                  |

## 프로젝트 팀

| 역할                         | 담당자 | 주요 책임                          |
| -------------------------- | --- | ------------------------------ |
| Project Lead / Integration | 이영준 | 요구사항 통합, 기술 의사결정, 배포와 현장 기술 총괄 |
| Development Lead           | 이서율 | 개발환경, GitHub, 코드 리뷰와 기술문서      |
| PMO                        | 구민우 | 일정, 업무 현황과 협업 조정               |
| Internal Review / QA       | 심승준 | 테스트, 공정성, 보안과 위험요소 검토          |
| Design / UX                | 박하음 | 모바일·관리자 화면과 현장 시각자료            |
| Business College Liaison   | 문시우 | 행사 규정 확인과 경영대학 의견 전달           |

실제 기능별 개발 담당자는 참여 가능 시간과 기술 수준을 확인한 뒤 GitHub Issue 단위로 배정합니다.

## 자문

정식 지도·자문 담당은 협의가 완료된 뒤 기재합니다.

## 개발 단계

* [x] 문제 정의
* [x] 프로젝트 범위와 초기 운영안 작성
* [x] 개발팀·협업 규칙 문서화
* [ ] 행사 규정과 요구사항 최종 확정
* [ ] 애플리케이션 개발환경 구축
* [ ] QR 입장·청중평가 시제품
* [ ] 심사·점수 집계·관리자 기능 통합
* [ ] 현장 리허설과 장애 대응 점검
* [ ] 2026년 11월 4일 본행사 운영
* [ ] 운영 결과와 회고 작성

## 문서

* [프로젝트 팀과 역할](./docs/TEAM.md)
* [개발계획과 MVP 범위](./docs/DEVELOPMENT_PLAN.md)
* [기여 및 협업 규칙](./CONTRIBUTING.md)
* [전체 문서 목록](./docs/README.md)
* [NEXUS Project Registry](https://github.com/paichai-nexus/nexus-project-registry)

## 개발 원칙

* 모든 작업은 GitHub Issue에서 시작합니다.
* `main` 브랜치에 직접 작업하지 않습니다.
* 실제 개인정보, 심사 점수와 비밀정보를 공개 저장소에 올리지 않습니다.
* 평가 규칙과 점수 계산식은 경영대학의 승인 없이 변경하지 않습니다.
* 구현한 기능은 테스트와 Pull Request 리뷰 후 병합합니다.
* 행사 현장에서 안정적으로 작동하는 MVP 완성을 최우선으로 합니다.

## Organization

**PAICHAI NEXUS — 배재대학교 학생주도 융합 프로젝트 네트워크**

https://github.com/paichai-nexus
