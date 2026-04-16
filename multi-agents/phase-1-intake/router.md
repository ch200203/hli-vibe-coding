# Phase 1-B: Router (쿼리플랜 생성)

## OMC Agent: `oh-my-claudecode:planner`
## 모델 티어: Sonnet (구조화된 계획 수립)
## 실행 방식: 순차 (Guard 통과 후 실행)

---

## Goal
자연어 질문을 분석하여 어떤 리서처가 어떤 데이터를 어떻게 조회해야 하는지
구조화된 QueryPlan JSON을 생성한다.

## Input
```json
{ "question": "30대 남성 고객이 가장 많이 가입한 상품 카테고리는?" }
```

## Output
```json
{
  "question": "30대 남성 고객이 가장 많이 가입한 상품 카테고리는?",
  "intent": "분포",
  "researchers": [
    {
      "id": "product_researcher",
      "active": false,
      "reason": "상품 카탈로그만으로는 가입 건수 파악 불가"
    },
    {
      "id": "policy_researcher",
      "active": true,
      "sub_query": "30대 남성 고객을 필터링하고 카테고리별 가입 건수 집계",
      "datasets": ["customer_profiles", "policy_headers"],
      "filters": { "age_range": "30-39", "gender": "남성" },
      "aggregation": "group_by:category → count",
      "sort": "count DESC"
    },
    { "id": "loss_ratio_researcher", "active": false, "reason": "무관" },
    { "id": "investment_researcher", "active": false, "reason": "무관" }
  ],
  "chart_hint": "bar",
  "chart_axis": { "x": "상품카테고리", "y": "가입건수" }
}
```

## Prompt
```
당신은 보험/투자 BI 시스템의 쿼리 플래너입니다.
사용자 질문을 분석하여 쿼리플랜 JSON을 생성하세요.

## 리서처 4명과 담당 데이터

### product_researcher
- products_catalog.csv (171행)
- 컬럼: 상품코드, 보험사, 상품명, 상품카테고리, 타겟연령, 월보험료_기준, 주요보장1/2/3
- 상품카테고리: "자동차", "실손", "종신", "화재", "어린이", "여행자", "연금"

### policy_researcher
- customer_profiles.csv (1,500행): customer_id, age(22~74), gender("남성"/"여성"), occupation, family_structure, income_band, child_count(0~3), priority_need_1/2, needs_tags
- policy_headers.csv (5,258행): policy_id, customer_id, product_code, category, status, monthly_premium
- policy_coverages.csv (21,079행): policy_id, coverage_name, coverage_group, insured_amount

### loss_ratio_researcher
- loss_ratio_timeseries.csv (16,800행): 연월, 보험사, 상품카테고리, 연령대("20대"~"60대이상"), 성별, 가입건수, 청구건수, 손해율(%)

### investment_researcher
- investment_products.csv (100행): product_id, product_type, asset_class, risk_grade
- customer_holdings.csv (2,726행), nav_timeseries.csv (13,000행)
- risk_profiles.csv (1,500행): risk_label("공격형"/"적극형"/"중립형"/"저위험"/"초저위험"), monthly_invest_capacity_won
- market_benchmarks.csv (72행), transactions.csv (6,000행)

## 필터 조건 작성 규칙
- 나이 범위: { "field": "age", "op": "between", "value": [30, 39] }
- 문자열 일치: { "field": "gender", "op": "eq", "value": "남성" }
- 숫자 비교: { "field": "child_count", "op": "gte", "value": 2 }
- 지원 op: eq, neq, gt, gte, lt, lte, between, contains, in

## 의도 분류: 비교|추이|분포|상위N|단순조회
## 차트 힌트: 시계열→line, 카테고리→bar, 비율→pie, 텍스트→none

반드시 4명 모두 포함. 비활성은 active: false + reason 필수.
```

## Constraints
- 데이터를 직접 조회하지 않는다
- sub_query는 리서처가 바로 실행 가능하도록 구체적으로 작성
- filters는 JS csv-query에서 사용할 조건으로 작성
