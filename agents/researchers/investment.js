const { filter, groupBy, aggregate, sortBy, topN, join } = require("../../utils/csv-query");
const { callGemini } = require("../../utils/gemini");

/**
 * 투자 리서처
 * 담당: investment_products, customer_holdings, nav_timeseries, risk_profiles, market_benchmarks, transactions
 * 분석: 투자 성향별 분석, 자산유형별 포트폴리오, 수익률, 거래 패턴
 */
async function research(subQuery, filters, aggregation, csvData) {
  console.log("[investment-researcher] 시작:", subQuery);

  try {
    const investmentProducts = csvData.investment_products;
    const customerHoldings = csvData.customer_holdings;
    const navTimeseries = csvData.nav_timeseries;
    const riskProfiles = csvData.risk_profiles;
    const marketBenchmarks = csvData.market_benchmarks;
    const transactions = csvData.transactions;

    if (!investmentProducts || investmentProducts.length === 0 ||
        !customerHoldings || customerHoldings.length === 0) {
      return {
        researcher_id: "investment_researcher",
        status: "no_data",
        summary: "투자 상품 또는 보유 데이터가 없습니다.",
        key_findings: [],
        data_rows: [],
        chart_data: { labels: [], values: [] },
        confidence: "low",
        methodology: "investment_products 또는 customer_holdings 데이터 없음",
      };
    }

    // 필터 분리: risk_profiles 필터 vs 기타 필터
    const riskFilters = {};
    const holdingFilters = {};
    const productFilters = {};

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (["risk_label", "risk_score", "investment_horizon", "primary_goal"].includes(key)) {
          riskFilters[key] = value;
        } else if (["asset_class", "product_type", "risk_grade", "provider"].includes(key)) {
          productFilters[key] = value;
        } else {
          holdingFilters[key] = value;
        }
      }
    }

    // risk_profiles 필터링
    let filteredRiskProfiles = riskProfiles || [];
    if (Object.keys(riskFilters).length > 0 && filteredRiskProfiles.length > 0) {
      filteredRiskProfiles = filter(filteredRiskProfiles, riskFilters);
    }

    // investment_products 필터링
    let filteredProducts = investmentProducts;
    if (Object.keys(productFilters).length > 0) {
      filteredProducts = filter(investmentProducts, productFilters);
    }

    // risk_label 필터가 있으면 해당 고객 ID로 holdings 제한
    let filteredHoldings = customerHoldings;
    if (Object.keys(riskFilters).length > 0 && filteredRiskProfiles.length > 0) {
      const riskCustomerIds = new Set(filteredRiskProfiles.map((r) => r.customer_id));
      filteredHoldings = customerHoldings.filter((h) => riskCustomerIds.has(h.customer_id));
    }

    // holdings 추가 필터
    if (Object.keys(holdingFilters).length > 0) {
      filteredHoldings = filter(filteredHoldings, holdingFilters);
    }

    if (filteredHoldings.length === 0) {
      return {
        researcher_id: "investment_researcher",
        status: "no_data",
        summary: "조건에 맞는 투자 보유 데이터가 없습니다.",
        key_findings: [],
        data_rows: [],
        chart_data: { labels: [], values: [] },
        confidence: "low",
        methodology: `필터 적용 후 holdings 0건: ${JSON.stringify(filters)}`,
      };
    }

    // holdings + investment_products JOIN (포트폴리오 분석)
    const joinedPortfolio = join(filteredHoldings, filteredProducts, "product_id", "product_id");

    // holdings + risk_profiles JOIN
    const joinedWithRisk = filteredRiskProfiles.length > 0
      ? join(filteredHoldings, filteredRiskProfiles, "customer_id", "customer_id")
      : filteredHoldings;

    // 집계 처리
    let aggregatedRows = [];
    let groupKey = null;

    if (aggregation && aggregation.startsWith("group_by:")) {
      const rest = aggregation.replace("group_by:", "");
      const [gKey, aggFn] = rest.split("→");
      groupKey = gKey.trim();
      const fn = aggFn ? aggFn.trim() : "count";

      // joinedPortfolio 또는 joinedWithRisk에서 집계
      const sourceData = joinedPortfolio.length > 0 ? joinedPortfolio : filteredHoldings;
      const groups = groupBy(sourceData, groupKey);
      const aggResult = aggregate(groups, fn);
      aggregatedRows = Object.entries(aggResult)
        .map(([key, value]) => ({ [groupKey]: key, [fn]: value }))
        .sort((a, b) => b[fn] - a[fn])
        .slice(0, 50);
    } else if (aggregation === "count") {
      aggregatedRows = [{ 총보유건수: filteredHoldings.length }];
    } else if (aggregation && (aggregation.startsWith("sum:") || aggregation.startsWith("avg:"))) {
      const [op, col] = aggregation.split(":");
      const sourceData = joinedWithRisk.length > 0 ? joinedWithRisk : filteredHoldings;
      const values = sourceData.map((r) => Number(r[col])).filter((v) => !isNaN(v));
      const result =
        op === "sum"
          ? values.reduce((a, b) => a + b, 0)
          : values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
      aggregatedRows = [{ [aggregation]: result }];
    } else {
      // 기본: 자산유형별 보유 건수
      if (joinedPortfolio.length > 0) {
        groupKey = "asset_class";
        const groups = groupBy(joinedPortfolio, groupKey);
        const aggResult = aggregate(groups, "count");
        aggregatedRows = Object.entries(aggResult)
          .map(([key, value]) => ({ 자산유형: key, 보유건수: value }))
          .sort((a, b) => b.보유건수 - a.보유건수)
          .slice(0, 50);
      } else {
        aggregatedRows = [{ 총보유건수: filteredHoldings.length }];
      }
    }

    // 거래 패턴 분석 (transactions)
    let txSummary = null;
    if (subQuery.includes("거래") || subQuery.includes("매매") || subQuery.includes("BUY") || subQuery.includes("SELL")) {
      const relevantProductIds = new Set(filteredHoldings.map((h) => h.product_id));
      const relevantTx = transactions
        ? transactions.filter((t) => relevantProductIds.has(t.product_id))
        : [];
      if (relevantTx.length > 0) {
        const txGroups = groupBy(relevantTx, "tx_type");
        txSummary = aggregate(txGroups, "count");
      }
    }

    // monthly_invest_capacity 집계 (risk_profiles)
    let avgInvestCapacity = null;
    if (filteredRiskProfiles.length > 0) {
      const capacities = filteredRiskProfiles
        .map((r) => Number(r.monthly_invest_capacity_won))
        .filter((v) => !isNaN(v));
      if (capacities.length > 0) {
        avgInvestCapacity = Math.round(capacities.reduce((a, b) => a + b, 0) / capacities.length);
      }
    }

    const sampleRows = joinedPortfolio.length > 0 ? joinedPortfolio.slice(0, 5) : filteredHoldings.slice(0, 5);

    // chart_data
    const chartLabels = aggregatedRows.map((r) => Object.values(r)[0]).slice(0, 20);
    const chartValues = aggregatedRows.map((r) => Object.values(r)[1]).slice(0, 20);

    // Gemini 호출
    const prompt = `당신은 투자 포트폴리오 분석 전문가입니다.

[분석 요청]
${subQuery}

[집계 결과 (최대 50행)]
${JSON.stringify(aggregatedRows, null, 2)}

[샘플 데이터 (5행, holdings + products JOIN)]
${JSON.stringify(sampleRows, null, 2)}

[분석 요약]
- 분석 대상 보유 건수: ${filteredHoldings.length}건
- 매칭된 고객 리스크 프로필 수: ${filteredRiskProfiles.length}명
- 월평균 투자 가능 금액: ${avgInvestCapacity ? avgInvestCapacity.toLocaleString() + "원" : "N/A"}
- 적용된 필터: ${JSON.stringify(filters)}
- 집계 방식: ${aggregation || "자산유형별 기본 집계"}
${txSummary ? `- 거래 유형별 건수: ${JSON.stringify(txSummary)}` : ""}

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
      researcher_id: "investment_researcher",
      status: "success",
      summary: geminiResult.summary || `투자 보유 ${filteredHoldings.length}건 분석 완료`,
      key_findings: geminiResult.key_findings || [],
      data_rows: aggregatedRows,
      chart_data: {
        labels: chartLabels,
        values: chartValues,
      },
      confidence: geminiResult.confidence || "medium",
      methodology: `customer_holdings(${customerHoldings.length}행) + investment_products JOIN, risk_profiles 필터(${JSON.stringify(riskFilters)}), 최종 ${filteredHoldings.length}건, 집계: ${aggregation || "자산유형별 count"}`,
    };

    console.log("[investment-researcher] 완료:", result.summary);
    return result;
  } catch (err) {
    console.error("[investment-researcher] 오류:", err.message);
    return {
      researcher_id: "investment_researcher",
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
