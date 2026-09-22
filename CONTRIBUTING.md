# Contributing Guide

## 기본 원칙

- 모든 작업은 GitHub Issue에서 시작한다.
- 하나의 Issue에는 하나의 검증 가능한 결과만 둔다.
- `main` 브랜치에 직접 push하지 않는다.
- 기능 구현과 함께 테스트 또는 확인 절차를 남긴다.
- 행사 규정과 점수 계산식은 임의로 변경하지 않는다.

## 작업 흐름

1. Issue에서 요구사항과 완료 기준을 확인한다.
2. 최신 `main`에서 작업 브랜치를 만든다.
3. 작은 단위로 구현하고 커밋한다.
4. 본인이 직접 실행·테스트한다.
5. Pull Request를 열고 Issue를 연결한다.
6. 리뷰 의견을 반영한다.
7. 승인 후 병합한다.

## 브랜치 이름

```text
feature/<issue-number>-<short-name>
fix/<issue-number>-<short-name>
docs/<issue-number>-<short-name>
test/<issue-number>-<short-name>
hotfix/<issue-number>-<short-name>
```

예시:

```text
feature/12-qr-check-in
fix/27-duplicate-vote
docs/31-rehearsal-guide
```

## 커밋 메시지

```text
feat: QR 입장 처리 추가
fix: 팀별 중복 투표 차단
docs: 현장 리허설 절차 작성
test: 점수 환산 테스트 추가
refactor: 평가 집계 로직 분리
chore: 개발환경 설정 갱신
```

## Pull Request 필수 내용

- 해결하려는 문제
- 구현 내용
- 테스트 방법과 결과
- 화면 변경 시 스크린샷
- 개인정보·권한·점수 계산 영향
- 남아 있는 제한사항
- 연결된 Issue 번호

## 리뷰 기준

- 요구사항을 정확히 구현했는가
- 중복 입장·중복 투표·재제출 예외를 처리했는가
- 권한 검사를 화면이 아닌 서버·DB 수준에서도 수행하는가
- 점수 계산 결과를 테스트로 재현할 수 있는가
- 관리자 변경과 최종 확정 기록이 남는가
- 다른 개발자가 코드를 이해하고 실행할 수 있는가

## 금지 사항

- 실제 참가자 학번, 연락처 또는 심사 점수를 저장소에 올리지 않는다.
- 비밀번호, API 키, DB 주소 등 비밀정보를 커밋하지 않는다.
- 승인되지 않은 평가 규칙을 코드에 고정하지 않는다.
- 테스트 없이 행사 당일 기능을 즉시 배포하지 않는다.
- AI가 생성한 코드를 검토·실행하지 않은 채 병합하지 않는다.

## 환경변수

실제 값은 로컬 환경과 배포 서비스에 저장하고, 저장소에는 변수 이름만 포함한 `.env.example`을 둔다.

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_BASE_URL=
```

`SUPABASE_SERVICE_ROLE_KEY`와 같은 관리자 키는 브라우저 코드에서 사용하지 않는다.

## 긴급 수정

행사 직전 또는 당일의 긴급 수정도 가능하면 Issue와 Pull Request를 남긴다. 긴급 배포 후에는 변경 이유, 영향 범위와 검증 결과를 반드시 기록한다.
