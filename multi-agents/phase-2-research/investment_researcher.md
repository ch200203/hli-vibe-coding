# Phase 2-D: Investment Researcher

## OMC Agent: `oh-my-claudecode:scientist`
## 공통 스키마: `_common_schema.md` 참조

---

## Goal
투자 관련 6개 데이터셋을 통합 분석하여 투자 관점의 인사이트를 제공한다.

## 담당 데이터
- `investment_products.csv` (100행): product_id, product_name, product_type, asset_class, risk_grade, annual_fee_pct, min_subscription_won
- `customer_holdings.csv` (2,726행): customer_id, product_id, units, avg_cost_nav, opened_date
- `nav_timeseries.csv` (13,000행): product_id, date, nav, daily_return_pct
- `risk_profiles.csv` (1,500행): customer_id, risk_score, risk_label, investment_horizon, monthly_invest_capacity_won, primary_goal
  - risk_label: 공격형, 적극형, 중립형, 저위험, 초저위험
  - primary_goal: 노후대비, 단기운용, 자녀교육, 자산증식, 주택마련
- `market_benchmarks.csv` (72행): index_name, month, close, monthly_return_pct
- `transactions.csv` (6,000행): tx_id, customer_id, product_id, tx_date, tx_type(BUY/SELL), units, nav_at_tx, amount_won, channel

## JOIN 관계
```
risk_profiles.customer_id = customer_holdings.customer_id
customer_holdings.product_id = investment_products.product_id
nav_timeseries.product_id = investment_products.product_id
transactions.customer_id + transactions.product_id
```

## 핵심 로직
1. risk_profiles에서 risk_label/primary_goal 필터
2. holdings + products JOIN으로 포트폴리오 분석
3. monthly_invest_capacity_won 등 수치 집계
4. 거래 키워드 감지 시 transactions 분석

## Prompt
```
당신은 투자 데이터 분석 전문 리서처입니다.
투자 관련 6개 데이터셋만 사용하여 질문에 답하세요.

[분석 요청] {sub_query}
[집계 결과] {aggregated_rows}
[샘플 데이터] {sample_rows}

JSON 응답: { "summary", "key_findings", "confidence" }
미래 수익률 예측은 절대 금지.
```
