# Phase 0: Orchestrator (파이프라인 총괄)

## OMC Agent: 메인 세션 (직접 실행)
## 모델: N/A (server.js 코드로 구현)

---

## Goal
자연어 질문을 받아 4단계 파이프라인을 순서대로 실행하고,
각 단계 결과를 다음 단계에 전달하여 최종 통합 답변을 생성한다.

## Input
```json
{ "question": "사용자의 자연어 질문" }
```

## Output
SSE 스트림으로 각 단계 진행상황 + 최종 결과 전달

## Pipeline

```
User Question
  ↓
Phase 1 — Intake (순차)
  ├─ Guard: 답변 가능? → NO → 거절 응답 반환
  └─ Router: 쿼리플랜 JSON 생성
  ↓
Phase 2 — Research (병렬)
  ├─ active=true인 리서처만 Promise.all로 동시 실행
  └─ active=false → { status: "skipped" }
  ↓
Phase 3 — Synthesis (순차)
  ├─ Editor: 리서처 결과 → 통합 답변 + 차트 스펙
  └─ Chart Optimizer: 차트 데이터 보정 (선택적)
  ↓
Phase 4 — Review Gate (선택적, 순차)
  ├─ Critic: 답변 품질 검수
  └─ Data Validator: 수치 인용 검증
  ↓
SSE result 전송
```

## Routing Rules
- Guard `answerable: false` → 파이프라인 즉시 중단
- Router가 리서처 0개 활성화 → Editor에게 "관련 데이터 없음" 전달
- 리서처 에러 → 해당 리서처만 skip, 나머지 계속
- Phase 4는 선택적: 빠른 응답 필요 시 skip 가능

## Supervisor 검증 (LLM 호출 없음, JS 동기 함수)

### Guard 출력 검증
- `answerable`이 boolean인지 확인
- false일 때 `refusal_message` 존재 확인
- 실패 시 → 기본 통과 처리 (안전한 fallback)

### Router 출력 검증
- `researchers` 배열에 4명 존재 확인
- 유효 ID: product/policy/loss_ratio/investment_researcher
- active=true인 리서처에 sub_query 존재 확인
- 실패 시 → 전체 리서처 활성화 (안전한 fallback)

### Researcher 출력 검증
- status가 success/no_data/error 중 하나인지
- success일 때 summary와 key_findings 존재 확인
- chart_data 형식(labels/values 배열) 검증

### Editor 출력 검증
- answer가 string인지
- chart 스키마(type/labels/datasets) 검증
- citations와 followup_suggestions가 배열인지

## Constraints
- 각 단계 사이에 검증 함수를 끼워넣는다
- 검증 실패 시 fallback 결과를 사용한다 (에러로 중단하지 않음)
- SSE로 각 단계 진행상황을 실시간 push한다
