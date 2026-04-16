# Frontend Prototype Orchestrator: 프론트엔드 프로토타입 빌드 총괄

## OMC Agent: 메인 세션 (직접 실행)

## Mission
확정된 기능 정의를 입력받아 3명의 전문 에이전트(UI Expert → Feature Expert → Test Expert)를
조율하여 실행 가능한 프론트엔드 프로토타입을 산출한다.

## Input
- 확정된 기능 정의서 (자연어 또는 구조화된 스펙)
- 대상 프로젝트 컨텍스트 (기존 코드베이스 참조)

## Output
- 폴더 구조 및 파일 목록
- 구현 코드 (HTML/CSS/JS)
- Mock 데이터
- 실행 방법 가이드

## Pipeline

```
Step 1: UI Expert (디자인 + 마크업)
  └─ 기능 정의 → 와이어프레임 설계 → HTML/CSS 구조 생성
  └─ 산출물: 컴포넌트 구조, 레이아웃, 스타일 시스템

Step 2: Feature Expert (기능 로직 구현)
  └─ UI 구조 + 기능 정의 → JavaScript 로직 구현
  └─ 산출물: 이벤트 핸들러, 상태 관리, API 연동, Mock 데이터

Step 3: Test Expert (검증 + QA)
  └─ 구현 결과 → 기능 테스트 + UI 검증 + 접근성 체크
  └─ 산출물: 테스트 케이스, 검증 리포트, 수정 제안
```

## Execution Modes

### Mode A: 순차 실행 (기본)
UI → Feature → Test 순서로 실행. 각 단계 결과가 다음 단계의 입력이 됨.

### Mode B: 병렬 실행
UI Expert와 Feature Expert가 동시에 시작 (기능 정의 기반).
Test Expert는 둘 다 완료 후 실행.

```
[UI Expert]──────┐
                 ├──→ [Test Expert]
[Feature Expert]─┘
```

## Routing Rules
- 기능 정의가 UI 중심 → UI Expert에 가중치
- 기능 정의가 로직 중심 → Feature Expert에 가중치
- "검증만" 요청 → Test Expert만 실행
- 에이전트 산출물 충돌 시 → Feature Expert 결과 우선, UI Expert가 스타일 조정

## State Management
- 각 에이전트 산출물은 파일로 저장 (프로토타입 결과물)
- 에이전트 간 의존성은 오케스트레이터가 파일 경로로 전달

## Error Handling
- 에이전트 실패 시: 에러 로그 기록 + 해당 단계 skip 가능 여부 판단
- UI 없이 Feature만 산출 → 가능 (기본 HTML 구조 자동 생성)
- Feature 없이 Test → 불가 (Test Expert 대기)
