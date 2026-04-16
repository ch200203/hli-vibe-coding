const { callGemini } = require("../utils/gemini");

async function runGuard(question) {
  console.log("[guard] 시작:", question);

  const prompt = `당신은 보험 및 투자 데이터 분석 시스템의 거절 판단 에이전트입니다.
사용자의 질문이 보유 데이터셋으로 답변 가능한지 판단해야 합니다.

## 보유 데이터셋
1. 보험 상품 카탈로그 (171개 상품)
   - 상품코드, 보험사, 상품명, 상품카테고리, 타겟연령, 월보험료_기준, 기준보험료_원, 주요보장1/2/3, 특약옵션, 가입조건
2. 고객 프로필 (1,500명)
   - customer_id, age, gender, occupation, family_structure, income_band, residence_region, child_count, priority_need_1/2, needs_tags
3. 보험 가입 내역 (5,258건)
   - policy_id, customer_id, product_code, product_name, insurer, category, status, start_date, monthly_premium
4. 보장 상세 (21,079건)
   - policy_id, coverage_code, coverage_name, coverage_group, insured_amount, deductible_flag, rider_flag
5. 손해율 시계열 (16,800행)
   - 연월, 보험사, 상품카테고리, 연령대, 성별, 가입건수, 청구건수, 경과보험료_원, 청구금액_원, 손해율(%)
6. 투자 상품 (100개)
   - product_id, product_name, product_type, asset_class, risk_grade, annual_fee_pct
7. 고객 투자 보유 (2,726건)
   - customer_id, product_id, units, avg_cost_nav
8. NAV 시계열 (13,000행)
   - product_id, date, nav, daily_return_pct
9. 투자 리스크 프로필 (1,500명)
   - customer_id, risk_score, risk_label, investment_horizon, monthly_invest_capacity_won, primary_goal
10. 시장 벤치마크 (72행)
    - index_name, month, close, monthly_return_pct
11. 투자 거래 (6,000건)
    - tx_id, customer_id, product_id, tx_date, tx_type, units, nav_at_tx, amount_won, channel

## 답변 불가 기준 (다음 중 하나라도 해당하면 answerable: false)
- 미래 예측 또는 전망 요청 (주가 예측, 수익률 예측 등)
- 특정 실명 개인 식별 요청
- 보유 데이터셋 범위 밖의 정보 요청 (외부 시장 데이터, 타사 내부 데이터 등)
- 의료 진단 또는 법률 조언 요청
- 실시간 시세 또는 현재 NAV 조회 (보유 데이터는 과거 시계열만 포함)
- 개인정보 직접 노출 요청

## 사용자 질문
"${question}"

위 질문이 보유 데이터셋으로 답변 가능한지 판단하고, 다음 JSON 형식으로만 응답하세요:

{
  "answerable": true 또는 false,
  "reason": "판단 근거를 한국어로 설명",
  "refusal_message": "answerable이 false일 때만 포함. 사용자에게 전달할 거절 메시지 (한국어, 친절하게)"
}`;

  const result = await callGemini(prompt);
  console.log("[guard] 완료. answerable:", result.answerable);
  return result;
}

module.exports = { runGuard };
