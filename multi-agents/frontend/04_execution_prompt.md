# 실행 프롬프트: 프론트엔드 프로토타입 빌드

지금부터 확정된 기능 정의를 기반으로 프론트엔드 프로토타입을 빌드합니다.

아래 에이전트들을 지정된 순서로 실행해주세요.
Mode A(순차)가 기본이며, Mode B(병렬)는 명시적으로 요청 시 사용합니다.

───────────────────────────────
[1] UI Expert — oh-my-claudecode:designer (model: sonnet)
───────────────────────────────
작업: 기능 정의 → 와이어프레임 → HTML/CSS 구현
참고 파일:
- ./multi-agents/frontend/01_ui_expert.md (프롬프트 + IO 스키마)
- 기능 정의서 (사용자 제공)
- public/style.css (기존 스타일 참조, 있을 경우)
산출물:
- public/index.html (또는 대상 HTML)
- public/style.css (또는 대상 CSS)
- component_map (다음 에이전트에 전달)
필수 조건:
- 시맨틱 HTML5 + CSS 변수 기반 테마
- 로딩/에러/빈 상태 placeholder 포함
- `js-` 접두사 클래스로 JavaScript hook 포인트 명시
- `data-component` 속성으로 컴포넌트 식별

───────────────────────────────
[2] Feature Expert — oh-my-claudecode:executor (model: sonnet)
───────────────────────────────
작업: UI 구조 + 기능 정의 → JavaScript 로직 구현
참고 파일:
- ./multi-agents/frontend/02_feature_expert.md (프롬프트 + IO 스키마)
- [1] UI Expert 산출물 (HTML/CSS + component_map)
- 기능 정의서 (사용자 제공)
산출물:
- public/app.js (메인 로직)
- public/mock/*.json (Mock 데이터)
- public/lib/*.js (유틸리티, 필요 시)
필수 조건:
- UI Expert의 `js-` 클래스 기준으로 DOM 접근
- Mock 데이터로 오프라인 실행 가능
- `?mock=true` 파라미터로 Mock 모드 전환
- 상태 중심 단방향 렌더링 패턴

───────────────────────────────
[3] Test Expert — oh-my-claudecode:qa-tester (model: sonnet)
───────────────────────────────
작업: 구현 결과 전체 검증 + 실행 가이드 작성
참고 파일:
- ./multi-agents/frontend/03_test_expert.md (프롬프트 + IO 스키마)
- [1] UI Expert 산출물
- [2] Feature Expert 산출물
- 기능 정의서 (기대 동작 기준)
산출물:
- 검증 리포트 (JSON 형식, 콘솔 출력)
- RUNBOOK.md (실행 방법 가이드)
- 수정 제안 목록 (실패 항목)
필수 조건:
- 기능/UI/접근성/코드품질/통합 5개 카테고리 검증
- 실패 항목에 반드시 fix_suggestion 포함
- RUNBOOK.md는 비개발자도 따라할 수 있는 수준
- 심각도 분류: critical > major > minor > info

───────────────────────────────
공통 규칙
───────────────────────────────
- UI Expert ↔ Feature Expert 계약: `js-` 접두사 클래스, `data-component` 속성
- 상태 클래스 규칙: `.is-loading`, `.is-error`, `.is-empty`, `.is-active`
- CSS 변수 네이밍: `--color-*`, `--spacing-*`, `--font-*`
- 파일 경로는 프로젝트 루트 기준 상대경로
- .env 파일의 키를 코드에 하드코딩하지 않음
- 모든 에이전트는 `console.log`로 주요 동작 로깅

───────────────────────────────
사용법
───────────────────────────────
1. 기능 정의서를 준비한다
2. 이 파일을 참조하여 에이전트를 순서대로 실행한다:
   ```
   "기능 정의: [내용]. multi-agents/frontend/04_execution_prompt.md 참조하여 프로토타입 빌드해줘"
   ```
3. 각 에이전트 완료 후 산출물을 확인하고 다음 에이전트로 진행
4. Test Expert의 RUNBOOK.md로 프로토타입 실행 및 검증

마지막에 생성된 파일 목록과 각 파일의 역할을 요약해서 보여줘.
