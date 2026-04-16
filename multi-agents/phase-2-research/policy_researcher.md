# Phase 2-B: Policy Researcher

## OMC Agent: `oh-my-claudecode:scientist`
## 공통 스키마: `_common_schema.md` 참조

---

## Goal
고객 프로필 + 보험 가입 내역 + 보장 상세를 JOIN하여 고객/정책 관점의 인사이트를 제공한다.

## 담당 데이터
- `customer_profiles.csv` (1,500행)
  - customer_id, age(22~74), gender("남성"/"여성"), occupation, family_structure, income_band, residence_region, child_count(0~3), priority_need_1/2, needs_tags("|"구분)
  - family_structure: 1인가구, 신혼부부, 맞벌이자녀1/2, 외벌이자녀2, 편부모가정, 3세대가구
- `policy_headers.csv` (5,258행)
  - policy_id, customer_id, product_code, product_name, insurer, category, status, start_date, monthly_premium
- `policy_coverages.csv` (21,079행)
  - policy_id, coverage_code, coverage_name, coverage_group, insured_amount
  - coverage_group: 노후연금, 사망보장, 실손의료, 자차손해, 특약보강, 화재재산, 여행자보장, 자동차배상, 자녀상해질병

## JOIN 관계
```
customer_profiles.customer_id = policy_headers.customer_id
policy_headers.policy_id = policy_coverages.policy_id
```

## 핵심 로직
1. filters에서 나이 범위/성별 등으로 customer_profiles 필터
2. 필터된 customer_id로 policy_headers JOIN
3. 필요 시 policy_coverages도 JOIN (보장/담보 키워드 감지)
4. group_by + count/sum 집계

## Prompt
```
당신은 보험 계약 및 고객 분석 전문가입니다.
customer_profiles, policy_headers, policy_coverages 데이터만 사용하여 질문에 답하세요.

[분석 요청] {sub_query}
[집계 결과] {aggregated_rows}
[샘플 데이터] {sample_rows (customer + policy JOIN)}
[보장 샘플] {coverage_sample (보장 키워드 시에만)}
[분석 요약] 고객 {N}명 → 계약 {M}건, 필터: {filters}

JSON 응답: { "summary", "key_findings", "confidence" }
```
