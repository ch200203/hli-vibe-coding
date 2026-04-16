# 프롬프트 2 — Phase 4 검수 게이트 (복붙용)

> Part-3 §6의 검수 게이트 패턴 적용: critic + verifier 순차 검수

```
방금 빌드한 코드를 검수 게이트로 보낼 거야.
아래 두 에이전트를 순서대로 실행해줘. 병렬이 아니라 순차야.

───────────────────────────────
[1] oh-my-claudecode:critic
───────────────────────────────
대상 파일:
- server.js
- agents/guard.js, agents/router.js, agents/editor.js
- agents/researchers/*.js (4개)
- utils/*.js (3개)

검수 기준:
1) 모듈 간 import/export 호환성 — 함수 시그니처 불일치 여부
2) server.js 파이프라인에서 queryPlan.researchers 배열 올바르게 파싱하는지
3) 리서처가 csvData를 올바르게 받는지
4) Editor가 researcherResults를 배열로 받는지
5) SSE 이벤트명이 프론트엔드와 일치하는지

출력:
- 파일별 상위 3개 지적 사항 (코드 인용 + 이유 + 개선 제안)
- 전체 종합 판정: Pass / Conditional Pass / Fail
- 반드시 고쳐야 할 항목 목록

───────────────────────────────
[2] oh-my-claudecode:verifier
───────────────────────────────
대상: 위와 동일 + critic 결과

검증 기준:
1) node server.js가 에러 없이 시작하는지
2) CSV 11개가 모두 로드되는지
3) POST /api/query가 SSE 스트림을 반환하는지
4) 샘플 질문 5개 중 최소 3개가 작동하는지
5) 거절 질문 ("내일 주가가 오를까?")이 올바르게 거절되는지

출력:
- 각 검증 항목의 결과 (Pass/Fail + 증거)
- 종합 판정

───────────────────────────────
공통 규칙
───────────────────────────────
- 결과를 .omc/review/code_review.md에 저장
- 원본 코드는 이 단계에서 수정하지 마. 지적만 기록.
- 마지막에 "다음 단계로 가도 되는가? (Yes/No)" 한 줄
```
