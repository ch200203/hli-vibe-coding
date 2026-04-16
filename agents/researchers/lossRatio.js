const { filter, groupBy, aggregate, sortBy, topN } = require("../../utils/csv-query");
const { callGemini } = require("../../utils/gemini");

/**
 * 손해율 리서처
 * 담당: csvData.loss_ratio_timeseries
 * 분석: 월별 손해율 추이, 보험사별 비교, 카테고리/연령/성별별 패턴
 */
async function research(subQuery, filters, aggregation, csvData) {
  console.log("[lossRatio-researcher] 시작:", subQuery);

  try {
    let data = csvData.loss_ratio_timeseries;

    if (!data || data.length === 0) {
      return {
        researcher_id: "lossRatio_researcher",
        status: "no_data",
        summary: "손해율 시계열 데이터가 없습니다.",
        key_findings: [],
        data_rows: [],
        chart_data: { labels: [], values: [] },
        confidence: "low",
        methodology: "loss_ratio_timeseries 데이터 없음",
      };
    }

    // "최근 12개월" 시간 필터 처리
    const isRecentFilter =
      subQuery.includes("최근 12개월") ||
      subQuery.includes("최근12개월") ||
      (filters && filters["기간"] === "최근12개월");

    if (isRecentFilter) {
      // 연월 컬럼 기준 최근 12개월 필터
      const allMonths = [...new Set(data.map((r) => r["연월"]))].sort();
      const recentMonths = allMonths.slice(-12);
      const recentSet = new Set(recentMonths);
      data = data.filter((r) => recentSet.has(r["연월"]));
    }

    // 일반 필터 적용 (기간 필터는 위에서 처리했으므로 제외)
    if (filters) {
      const normalFilters = { ...filters };
      delete normalFilters["기간"];
      if (Object.keys(normalFilters).length > 0) {
        data = filter(data, normalFilters);
      }
    }

    if (data.length === 0) {
      return {
        researcher_id: "lossRatio_researcher",
        status: "no_data",
        summary: "조건에 맞는 손해율 데이터가 없습니다.",
        key_findings: [],
        data_rows: [],
        chart_data: { labels: [], values: [] },
        confidence: "low",
        methodology: `loss_ratio_timeseries 필터 적용 후 0건: ${JSON.stringify(filters)}`,
      };
    }

    // 집계 처리
    let aggregatedRows = [];
    let groupKey = null;

    if (aggregation && aggregation.startsWith("group_by:")) {
      const rest = aggregation.replace("group_by:", "");
      const [gKey, aggFn] = rest.split("→");
      groupKey = gKey.trim();
      const fn = aggFn ? aggFn.trim() : "count";
      const groups = groupBy(data, groupKey);
      const aggResult = aggregate(groups, fn);
      aggregatedRows = Object.entries(aggResult)
        .map(([key, value]) => ({ [groupKey]: key, [fn]: value }))
        .sort((a, b) => b[fn] - a[fn])
        .slice(0, 50);
    } else {
      // 기본: 연월+보험사 기준 손해율 평균 집계
      // 보험사별 평균 손해율
      const byInsurer = groupBy(data, "보험사");
      const avgLossRatio = aggregate(byInsurer, "avg:손해율(%)");
      aggregatedRows = Object.entries(avgLossRatio)
        .map(([insurer, avg]) => ({
          보험사: insurer,
          평균손해율: Math.round(avg * 10) / 10,
        }))
        .sort((a, b) => b.평균손해율 - a.평균손해율)
        .slice(0, 50);
    }

    // 시간축 트렌드 (월별 손해율)
    const byMonth = groupBy(data, "연월");
    const monthlyAvg = aggregate(byMonth, "avg:손해율(%)");
    const trendRows = Object.entries(monthlyAvg)
      .map(([month, avg]) => ({ 연월: month, 평균손해율: Math.round(avg * 10) / 10 }))
      .sort((a, b) => (a.연월 > b.연월 ? 1 : -1));

    // 악화/개선 판정
    let trendDirection = "neutral";
    if (trendRows.length >= 2) {
      const first = trendRows[0].평균손해율;
      const last = trendRows[trendRows.length - 1].평균손해율;
      trendDirection = last > first ? "악화" : last < first ? "개선" : "유지";
    }

    const sampleRows = data.slice(0, 5);

    // chart_data: 월별 평균 손해율 추이
    const chartLabels = trendRows.map((r) => r.연월).slice(0, 24);
    const chartValues = trendRows.map((r) => r.평균손해율).slice(0, 24);

    // Gemini 호출
    const prompt = `당신은 보험 손해율 분석 전문가입니다.

[분석 요청]
${subQuery}

[집계 결과 (보험사별/그룹별 평균 손해율, 최대 50행)]
${JSON.stringify(aggregatedRows, null, 2)}

[월별 손해율 추이]
${JSON.stringify(trendRows, null, 2)}

[샘플 데이터 (5행)]
${JSON.stringify(sampleRows, null, 2)}

[분석 요약]
- 분석 대상 레코드 수: ${data.length}건
- 손해율 추이: ${trendDirection} (${trendRows[0]?.연월 || "N/A"} → ${trendRows[trendRows.length - 1]?.연월 || "N/A"})
- 적용된 필터: ${JSON.stringify(filters)}
- 집계 방식: ${aggregation || "보험사별 평균 손해율"}

참고:
- "악화" = 손해율 상승 (보험사 손실 증가)
- "개선" = 손해율 하락 (보험사 수익성 개선)
- 손해율 100% 초과 = 보험료 수입보다 보험금 지급이 많음

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
      researcher_id: "lossRatio_researcher",
      status: "success",
      summary: geminiResult.summary || `${data.length}건 손해율 데이터 분석 완료, 추이: ${trendDirection}`,
      key_findings: geminiResult.key_findings || [],
      data_rows: aggregatedRows,
      chart_data: {
        labels: chartLabels,
        values: chartValues,
      },
      confidence: geminiResult.confidence || "medium",
      methodology: `loss_ratio_timeseries(${csvData.loss_ratio_timeseries.length}행)에서 필터(${JSON.stringify(filters)}) 적용 후 ${data.length}건, 집계: ${aggregation || "보험사별 평균 손해율 + 월별 추이"}`,
    };

    console.log("[lossRatio-researcher] 완료:", result.summary);
    return result;
  } catch (err) {
    console.error("[lossRatio-researcher] 오류:", err.message);
    return {
      researcher_id: "lossRatio_researcher",
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
