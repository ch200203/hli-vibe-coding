const { callGemini } = require("../utils/gemini");

async function runRouter(question) {
  console.log("[router] 시작:", question);

  const prompt = `당신은 보험 및 투자 데이터 분석 시스템의 쿼리 플랜 생성 에이전트입니다.
사용자의 자연어 질문을 분석하여, 어떤 리서처가 어떤 데이터를 조회해야 하는지 계획을 수립해야 합니다.

## 리서처 4명과 담당 데이터

### 1. product_researcher
담당 파일: products_catalog.csv
컬럼 정보:
- 상품코드: 상품 고유 식별자
- 보험사: 보험사명
- 상품명: 상품 이름
- 상품카테고리: 생명/손해/건강/연금 등 카테고리
- 타겟연령: 가입 대상 연령대
- 월보험료_기준: 기준 월 보험료 (문자열)
- 기준보험료_원: 기준 월 보험료 (숫자, 원 단위)
- 주요보장1, 주요보장2, 주요보장3: 주요 보장 내용
- 특약옵션: 추가 가입 가능한 특약 목록
- 가입조건: 가입 자격 조건
활용 상황: 상품 비교, 보험료 조회, 보장 내용 확인, 카테고리별 상품 목록

### 2. policy_researcher
담당 파일: customer_profiles.csv, policy_headers.csv, policy_coverages.csv
컬럼 정보:
- customer_profiles: customer_id, age(나이), gender(성별), occupation(직업), family_structure(가족구성), income_band(소득구간), residence_region(거주지역), child_count(자녀수), priority_need_1(우선필요1), priority_need_2(우선필요2), needs_tags(니즈태그)
- policy_headers: policy_id(증권번호), customer_id(고객ID), product_code(상품코드), product_name(상품명), insurer(보험사), category(카테고리), status(상태: 유효/실효), start_date(가입일), monthly_premium(월보험료_원)
- policy_coverages: policy_id(증권번호), coverage_code(보장코드), coverage_name(보장명), coverage_group(보장그룹), insured_amount(보험금액_원), deductible_flag(공제여부), rider_flag(특약여부)
활용 상황: 고객별 가입 현황, 보장 분석, 고객 세그먼트 분석, 보험료 통계

### 3. loss_ratio_researcher
담당 파일: loss_ratio_timeseries.csv
컬럼 정보:
- 연월: YYYYMM 형식의 기간
- 보험사: 보험사명
- 상품카테고리: 상품 카테고리
- 연령대: 연령 구간 (예: 30대, 40대)
- 성별: 남/여
- 가입건수: 해당 기간 가입 건수
- 청구건수: 해당 기간 청구 건수
- 경과보험료_원: 경과보험료 합계
- 청구금액_원: 청구금액 합계
- 손해율(%): 손해율 퍼센트
활용 상황: 손해율 추이 분석, 보험사/카테고리/연령대/성별별 손해율 비교, 시계열 분석

### 4. investment_researcher
담당 파일: investment_products.csv, customer_holdings.csv, nav_timeseries.csv, risk_profiles.csv, market_benchmarks.csv, transactions.csv
컬럼 정보:
- investment_products: product_id(상품ID), product_name(상품명), product_type(상품유형), asset_class(자산군), risk_grade(위험등급 1-5), annual_fee_pct(연간수수료%)
- customer_holdings: customer_id(고객ID), product_id(상품ID), units(보유좌수), avg_cost_nav(평균매입NAV)
- nav_timeseries: product_id(상품ID), date(날짜), nav(기준가), daily_return_pct(일간수익률%)
- risk_profiles: customer_id(고객ID), risk_score(위험점수), risk_label(위험등급명), investment_horizon(투자기간), monthly_invest_capacity_won(월투자가능금액), primary_goal(투자목적)
- market_benchmarks: index_name(지수명), month(월), close(종가), monthly_return_pct(월간수익률%)
- transactions: tx_id(거래ID), customer_id(고객ID), product_id(상품ID), tx_date(거래일), tx_type(거래유형: 매수/매도), units(거래좌수), nav_at_tx(거래시NAV), amount_won(거래금액), channel(채널)
활용 상황: 투자 상품 성과 분석, 고객 포트폴리오 분석, NAV 추이, 거래 패턴, 벤치마크 비교

## 반환 스키마
다음 JSON 형식으로만 응답하세요:
{
  "question": "원본 질문",
  "intent": "비교|추이|분포|상위N|단순조회 중 하나",
  "researchers": [
    {
      "id": "product_researcher|policy_researcher|loss_ratio_researcher|investment_researcher",
      "active": true 또는 false,
      "sub_query": "active가 true일 때: 이 리서처가 수행할 세부 질문",
      "datasets": ["active가 true일 때: 사용할 CSV 파일명 목록"],
      "filters": {},
      "aggregation": "active가 true일 때: 집계 방법 (예: GROUP BY 보험사, AVG 손해율)",
      "reason": "active가 false일 때 필수: 이 리서처를 사용하지 않는 이유"
    }
  ],
  "chart_hint": "bar|line|pie|none 중 하나",
  "chart_axis": {
    "x": "X축 레이블 또는 빈 문자열",
    "y": "Y축 레이블 또는 빈 문자열"
  }
}

## 차트 힌트 선택 기준
- 시계열 데이터 (연월별 추이) → "line"
- 카테고리 간 비교 (보험사별, 상품별 등) → "bar"
- 비율/구성 분석 → "pie"
- 텍스트 답변만 필요한 경우 → "none"

## 사용자 질문
"${question}"

위 질문을 분석하여 쿼리 플랜 JSON을 생성하세요. 반드시 4명의 리서처 모두를 researchers 배열에 포함하고, 관련 없는 리서처는 active: false와 reason을 명시하세요.`;

  const result = await callGemini(prompt);
  console.log("[router] 완료. active 리서처:", result.researchers?.filter(r => r.active).map(r => r.id));
  return result;
}

module.exports = { runRouter };
