# 프롬프트 1 — Phase 1~3 병렬 빌드 (복붙용)

> Part-3 §5의 병렬 초안 패턴 적용: 5개 에이전트가 동시에 각자 파일 생성

```
지금부터 "멀티 리서처 BI 웹앱"을 OMC 멀티 에이전트로 병렬 빌드할 거야.

아래 다섯 에이전트를 동시에 실행해줘. 서로 결과를 기다리지 말고 병렬로 일하게 해줘.
각 에이전트가 끝나면 지정된 파일로 저장해줘.

───────────────────────────────
[1] oh-my-claudecode:executor
───────────────────────────────
작업: CSV 유틸리티 3개 파일 구현
참고: multi-agents/phase-0-orchestrator/orchestrator.md
산출물:
- utils/csv-loader.js (11개 CSV 메모리 로드 + BOM 처리 + 싱글톤 캐시)
- utils/csv-query.js (filter, groupBy, aggregate, sortBy, topN, join)
- utils/gemini.js (Gemini 2.0 Flash 래퍼 + JSON 강제 + 재시도)

───────────────────────────────
[2] oh-my-claudecode:executor
───────────────────────────────
작업: Guard + Router + Editor 에이전트
참고: multi-agents/phase-1-intake/*.md, multi-agents/phase-3-synthesis/editor.md
산출물:
- agents/guard.js (거절 판단)
- agents/router.js (쿼리플랜 JSON)
- agents/editor.js (통합 답변 + 차트)

───────────────────────────────
[3] oh-my-claudecode:executor
───────────────────────────────
작업: 리서처 에이전트 4개
참고: multi-agents/phase-2-research/*.md
산출물:
- agents/researchers/product.js
- agents/researchers/policy.js
- agents/researchers/lossRatio.js
- agents/researchers/investment.js
공통 시그니처: async function research(subQuery, filters, aggregation, csvData)

───────────────────────────────
[4] oh-my-claudecode:designer
───────────────────────────────
작업: 프론트엔드 UI
참고: multi-agents/phase-0-orchestrator/orchestrator.md (파이프라인)
산출물:
- public/index.html (검색창 + 샘플 질문 5개 + 리서처 카드 4개 + 편집자 답변)
- public/style.css (라이트 테마, 카드 레이아웃)
- public/app.js (SSE 통신 + Chart.js 렌더링)

───────────────────────────────
[5] oh-my-claudecode:executor
───────────────────────────────
작업: Express 서버 + SSE API
참고: multi-agents/phase-0-orchestrator/orchestrator.md
산출물:
- server.js (POST /api/query → Guard→Router→Researchers→Editor SSE 파이프라인)

───────────────────────────────
공통 규칙
───────────────────────────────
- 다섯 에이전트는 서로 결과를 기다리지 않는다
- 각 에이전트는 자기 산출물 파일만 쓴다
- .env의 GEMINI_API_KEY 사용 (하드코딩 금지)
- 마지막에 생성된 파일 목록과 각 파일의 역할을 요약해서 보여줘
```
