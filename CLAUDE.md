# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi Researcher BI — a natural-language BI web app where 4 researcher agents explore different insurance/investment datasets in parallel, and an editor agent synthesizes a unified answer with auto-selected charts and cited data rows.

**Stack:** HTML frontend + Serverless API (Gemini LLM)
**API Key:** `GEMINI_API_KEY` in `.env` (from Google AI Studio)

## Architecture

### Agent Pipeline

1. User submits a natural-language question
2. **Guard agent** checks if the question is answerable with available datasets → refusal if not
3. **Supervisor: validateGuard()** — verifies Guard output schema before proceeding
4. **Query planner (Router)** converts the question into a **query plan JSON** that routes to relevant researchers
5. **Supervisor: validateQueryPlan()** — validates researcher IDs, intent, chart_hint, filter format
6. **4 Researcher agents** run in parallel, each owning specific datasets:
   - `product_researcher` → `products_catalog.csv`
   - `policy_researcher` → `customer_profiles.csv`, `policy_headers.csv`, `policy_coverages.csv`
   - `loss_ratio_researcher` → `loss_ratio_timeseries.csv`
   - `investment_researcher` → `investment_products.csv`, `customer_holdings.csv`, `nav_timeseries.csv`, `risk_profiles.csv`, `market_benchmarks.csv`, `transactions.csv`
7. **Supervisor: validateResearcherResult()** — validates each researcher's output schema, chart_data format
8. **Editor agent** merges researcher outputs into a final answer with chart selection (bar/line/pie/none) and data citations
9. **Supervisor: validateEditorResult()** — validates answer, chart spec, citations array
10. Irrelevant researchers show "무응답" (no response); unanswerable questions get a polite refusal without hallucination

### Supervisor (관리-감독)

- server.js 내 동기 검증 함수로 구현 (LLM 호출 없음, 속도 우선)
- 각 에이전트 출력의 JSON 스키마 필수 필드/값 검증
- 검증 실패 시 fallback으로 안전한 기본값 반환 (파이프라인 중단 방지)
- 상세 로직: `multi-agents/00_orchestrator.md` Supervisor 섹션 참조

### UI Layout

- **Top:** Natural-language input + 5 sample question buttons
- **Middle:** 4 researcher cards showing live exploration progress
- **Bottom:** Editor's unified answer + auto-selected chart + cited data rows

## Data

All CSVs live in `./data/`. The datasets cover Korean insurance products, customer profiles, policies, loss ratios, and investment holdings.

## Sample Test Questions

1. "30대 남성 고객이 가장 많이 가입한 상품 카테고리는?"
2. "최근 12개월 손해율이 가장 악화된 보험사는?"
3. "적극형 고객의 평균 월 투자 가용금액은?"
4. "자녀 둘 이상 가구가 관심 있는 보장은?"
5. (refusal) "내일 주가가 오를까?" → must refuse without hallucination

## Completion Criteria

- Sample questions 1-4 return accurate numeric answers with charts
- Refusal question handled gracefully (no hallucination)
- All 4 researcher cards visible in UI (routed-off researchers show "무응답")
