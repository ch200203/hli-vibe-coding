const { filter, groupBy, aggregate, sortBy, topN, join } = require("../../utils/csv-query");
const { callGemini } = require("../../utils/gemini");

/**
 * 계약/고객 리서처
 * 담당: customer_profiles + policy_headers + policy_coverages
 * 분석: 고객 세그먼트, 가입 패턴, 보장 분석, 니즈 분석
 */
async function research(subQuery, filters, aggregation, csvData) {
  console.log("[policy-researcher] 시작:", subQuery);

  try {
    let customers = csvData.customer_profiles;
    let policyHeaders = csvData.policy_headers;
    let policyCoverages = csvData.policy_coverages;

    if (!customers || customers.length === 0 || !policyHeaders || policyHeaders.length === 0) {
      return {
        researcher_id: "policy_researcher",
        status: "no_data",
        summary: "고객 또는 계약 데이터가 없습니다.",
        key_findings: [],
        data_rows: [],
        chart_data: { labels: [], values: [] },
        confidence: "low",
        methodology: "customer_profiles 또는 policy_headers 데이터 없음",
      };
    }

    // 고객 필터 적용 (나이 범위, 성별 등)
    const customerFilters = {};
    const policyFilters = {};

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        // customer_profiles 컬럼
        if (["age", "gender", "occupation", "family_structure", "income_band", "residence_region",
             "driver_status", "persona_cluster", "child_count", "homeowner_flag"].includes(key)) {
          customerFilters[key] = value;
        }
        // policy_headers 컬럼
        else if (["category", "status", "insurer", "product_code"].includes(key)) {
          policyFilters[key] = value;
        }
        // 한국어 컬럼명 처리
        else {
          customerFilters[key] = value;
        }
      }
    }

    // 고객 필터링
    let filteredCustomers = Object.keys(customerFilters).length > 0
      ? filter(customers, customerFilters)
      : customers;

    if (filteredCustomers.length === 0) {
      return {
        researcher_id: "policy_researcher",
        status: "no_data",
        summary: "조건에 맞는 고객이 없습니다.",
        key_findings: [],
        data_rows: [],
        chart_data: { labels: [], values: [] },
        confidence: "low",
        methodology: `customer_profiles 필터: ${JSON.stringify(customerFilters)}`,
      };
    }

    // customer_id 집합으로 policy_headers 필터링
    const filteredCustomerIds = new Set(filteredCustomers.map((c) => c.customer_id));
    let filteredPolicies = policyHeaders.filter((p) => filteredCustomerIds.has(p.customer_id));

    // policy 추가 필터
    if (Object.keys(policyFilters).length > 0) {
      filteredPolicies = filter(filteredPolicies, policyFilters);
    }

    if (filteredPolicies.length === 0) {
      return {
        researcher_id: "policy_researcher",
        status: "no_data",
        summary: "조건에 맞는 계약이 없습니다.",
        key_findings: [],
        data_rows: [],
        chart_data: { labels: [], values: [] },
        confidence: "low",
        methodology: `고객 ${filteredCustomers.length}명 필터 후 계약 0건`,
      };
    }

    // JOIN: policy_headers + customer_profiles
    const joinedData = join(filteredPolicies, filteredCustomers, "customer_id", "customer_id");

    // 집계 처리
    let aggregatedRows = [];
    let groupKey = null;

    if (aggregation && aggregation.startsWith("group_by:")) {
      const rest = aggregation.replace("group_by:", "");
      const [gKey, aggFn] = rest.split("→");
      groupKey = gKey.trim();
      const fn = aggFn ? aggFn.trim() : "count";
      const groups = groupBy(joinedData, groupKey);
      const aggResult = aggregate(groups, fn);
      aggregatedRows = Object.entries(aggResult)
        .map(([key, value]) => ({ [groupKey]: key, [fn]: value }))
        .sort((a, b) => b[fn] - a[fn])
        .slice(0, 50);
    } else if (aggregation === "count") {
      aggregatedRows = [{ 총계약수: filteredPolicies.length, 총고객수: filteredCustomers.length }];
    } else if (aggregation && (aggregation.startsWith("sum:") || aggregation.startsWith("avg:"))) {
      const [op, col] = aggregation.split(":");
      const values = joinedData.map((r) => Number(r[col])).filter((v) => !isNaN(v));
      const result =
        op === "sum"
          ? values.reduce((a, b) => a + b, 0)
          : values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
      aggregatedRows = [{ [aggregation]: result }];
    } else {
      // 기본: 카테고리별 계약 수
      groupKey = "category";
      const groups = groupBy(filteredPolicies, groupKey);
      const aggResult = aggregate(groups, "count");
      aggregatedRows = Object.entries(aggResult)
        .map(([key, value]) => ({ 카테고리: key, 계약수: value }))
        .sort((a, b) => b.계약수 - a.계약수)
        .slice(0, 50);
    }

    // 보장 분석이 필요한 경우 policy_coverages JOIN
    let coverageSample = [];
    if (subQuery.includes("보장") || subQuery.includes("담보") || subQuery.includes("coverage")) {
      const policyIds = new Set(filteredPolicies.map((p) => p.policy_id));
      const filteredCoverages = policyCoverages.filter((c) => policyIds.has(c.policy_id));
      coverageSample = filteredCoverages.slice(0, 10);
    }

    const sampleRows = joinedData.slice(0, 5);

    // chart_data
    const chartLabels = aggregatedRows.map((r) => Object.values(r)[0]).slice(0, 20);
    const chartValues = aggregatedRows.map((r) => Object.values(r)[1]).slice(0, 20);

    // Gemini 호출
    const prompt = `당신은 보험 계약 및 고객 분석 전문가입니다.

[분석 요청]
${subQuery}

[집계 결과 (최대 50행)]
${JSON.stringify(aggregatedRows, null, 2)}

[샘플 데이터 (5행, customer + policy JOIN)]
${JSON.stringify(sampleRows, null, 2)}

${coverageSample.length > 0 ? `[보장 샘플 데이터 (10행)]\n${JSON.stringify(coverageSample, null, 2)}` : ""}

[분석 요약]
- 필터된 고객 수: ${filteredCustomers.length}명
- 필터된 계약 수: ${filteredPolicies.length}건
- 적용된 필터: ${JSON.stringify(filters)}
- 집계 방식: ${aggregation || "카테고리별 기본 집계"}

위 데이터를 기반으로 다음 JSON 형식으로 분석 결과를 반환해주세요:
{
  "summary": "한 줄 요약 (수치 포함, 한국어)",
  "key_findings": [
    { "metric": "측정항목", "value": "값", "count": 숫자 }
  ],
  "confidence": "high | medium | low"
}`;

    const geminiResult = await callGemini(prompt);

    const result = {
      researcher_id: "policy_researcher",
      status: "success",
      summary: geminiResult.summary || `고객 ${filteredCustomers.length}명, 계약 ${filteredPolicies.length}건 분석 완료`,
      key_findings: geminiResult.key_findings || [],
      data_rows: aggregatedRows,
      chart_data: {
        labels: chartLabels,
        values: chartValues,
      },
      confidence: geminiResult.confidence || "medium",
      methodology: `customer_profiles(${customers.length}행) 필터→${filteredCustomers.length}명, policy_headers JOIN→${filteredPolicies.length}건, 집계: ${aggregation || "카테고리별 count"}`,
    };

    console.log("[policy-researcher] 완료:", result.summary);
    return result;
  } catch (err) {
    console.error("[policy-researcher] 오류:", err.message);
    return {
      researcher_id: "policy_researcher",
      status: "error",
      summary: `오류 발생: ${err.message}`,
      key_findings: [],
      data_rows: [],
      chart_data: { labels: [], values: [] },
      confidence: "low",
      methodology: "오류로 인해 분석 중단",
    };
  }
}

module.exports = { research };
