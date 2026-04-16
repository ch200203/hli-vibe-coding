const { getDataset } = require("../../utils/csv-loader");
const { filter, groupBy, aggregate } = require("../../utils/csv-query");
const { callGemini } = require("../../utils/gemini");

const SYSTEM_INSTRUCTION =
  "당신은 보험 상품 카탈로그 전문 리서처입니다.\n" +
  "products_catalog 데이터만 사용하여 질문에 답하세요.\n" +
  "가입 건수나 고객 수는 이 데이터에 없으므로 언급 금지.\n" +
  "반드시 JSON으로만 응답하세요.";

/**
 * 상품 리서처
 * 담당: products_catalog
 * 분석: 상품 카테고리별 분류, 보험사별 상품, 보험료 비교, 보장 비교
 */
async function research(subQuery, filters, aggregation) {
  console.log("[product-researcher] 시작:", subQuery);

  try {
    let data = getDataset("products_catalog");

    if (!data || data.length === 0) {
      return {
        researcher_id: "product_researcher",
        status: "no_data",
        summary: "상품 카탈로그 데이터가 없습니다.",
        key_findings: [],
        data_rows: [],
        chart_data: { labels: [], values: [] },
        confidence: "low",
        methodology: "products_catalog 데이터 없음",
      };
    }

    // 가입 건수/고객 수 관련 쿼리는 no_data
    const noDataKeywords = ["가입건수", "고객수", "고객 수", "가입자", "계약자 수"];
    if (noDataKeywords.some((kw) => subQuery.includes(kw))) {
      return {
        researcher_id: "product_researcher",
        status: "no_data",
        summary: "상품 카탈로그에는 가입 건수나 고객 수 정보가 없습니다.",
        key_findings: [],
        data_rows: [],
        chart_data: { labels: [], values: [] },
        confidence: "low",
        methodology: "products_catalog에는 가입/고객 통계 데이터가 포함되어 있지 않음",
      };
    }

    // 필터 적용 — filters는 [{field, op, value}] 배열
    if (filters && filters.length > 0) {
      data = filter(data, filters);
    }

    if (data.length === 0) {
      return {
        researcher_id: "product_researcher",
        status: "no_data",
        summary: "조건에 맞는 상품이 없습니다.",
        key_findings: [],
        data_rows: [],
        chart_data: { labels: [], values: [] },
        confidence: "low",
        methodology: `products_catalog 필터 적용: ${JSON.stringify(filters)}`,
      };
    }

    // 집계 처리
    let aggregatedRows = [];

    if (aggregation && aggregation.startsWith("group_by:")) {
      const rest = aggregation.replace("group_by:", "");
      const [gKey, aggFn] = rest.split("→").map((s) => s.trim());
      const fn = aggFn || "count";
      const groups = groupBy(data, gKey);
      const aggResult = aggregate(groups, fn);
      aggregatedRows = aggResult
        .map(({ key, value }) => ({ [gKey]: key, [fn]: value }))
        .slice(0, 50);
    } else if (aggregation === "count") {
      aggregatedRows = [{ total: data.length }];
    } else if (aggregation && (aggregation.startsWith("sum:") || aggregation.startsWith("avg:"))) {
      const [op, col] = aggregation.split(":");
      const values = data.map((r) => Number(r[col])).filter((v) => !isNaN(v));
      const result =
        op === "sum"
          ? values.reduce((a, b) => a + b, 0)
          : values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
      aggregatedRows = [{ [aggregation]: result }];
    } else {
      // 기본: 카테고리별 상품 수
      const groups = groupBy(data, "상품카테고리");
      const aggResult = aggregate(groups, "count");
      aggregatedRows = aggResult
        .map(({ key, value }) => ({ 상품카테고리: key, 상품수: value }))
        .slice(0, 50);
    }

    const sampleRows = data.slice(0, 5);
    const chartLabels = aggregatedRows.map((r) => String(Object.values(r)[0])).slice(0, 20);
    const chartValues = aggregatedRows.map((r) => Number(Object.values(r)[1])).slice(0, 20);

    const prompt = `[분석 요청]
${subQuery}

[집계 결과 (최대 50행)]
${JSON.stringify(aggregatedRows, null, 2)}

[샘플 데이터 (5행)]
${JSON.stringify(sampleRows, null, 2)}

[분석 조건]
- 총 분석 대상 상품 수: ${data.length}개
- 적용된 필터: ${JSON.stringify(filters)}
- 집계 방식: ${aggregation || "카테고리별 기본 집계"}

다음 JSON 형식으로만 응답하세요:
{
  "summary": "한 줄 요약 (수치 포함, 한국어)",
  "key_findings": [{ "metric": "측정항목", "value": "값", "count": 숫자 }],
  "confidence": "high | medium | low"
}`;

    const geminiResult = await callGemini(prompt, SYSTEM_INSTRUCTION);

    return {
      researcher_id: "product_researcher",
      status: "success",
      summary: geminiResult?.summary || `총 ${data.length}개 상품 분석 완료`,
      key_findings: geminiResult?.key_findings || [],
      data_rows: aggregatedRows,
      chart_data: { labels: chartLabels, values: chartValues },
      confidence: geminiResult?.confidence || "medium",
      methodology: `products_catalog 필터(${JSON.stringify(filters)}) → ${data.length}행, 집계: ${aggregation || "카테고리별 count"}`,
    };
  } catch (err) {
    console.error("[product-researcher] 오류:", err.message);
    return {
      researcher_id: "product_researcher",
      status: "error",
      summary: err.message,
      key_findings: [],
      data_rows: [],
      chart_data: { labels: [], values: [] },
      confidence: "low",
      methodology: "오류로 인해 분석 중단",
    };
  }
}

module.exports = { research };
