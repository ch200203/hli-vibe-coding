require("dotenv").config();
const express = require("express");
const path = require("path");

const { loadAllDatasets: loadAllCSV } = require("./utils/csv-loader");
const { runGuard } = require("./agents/guard");
const { runRouter } = require("./agents/router");
const { runEditor } = require("./agents/editor");
const productResearcher = require("./agents/researchers/product");
const policyResearcher = require("./agents/researchers/policy");
const lossRatioResearcher = require("./agents/researchers/lossRatio");
const investmentResearcher = require("./agents/researchers/investment");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let csvData = null;

const researcherMap = {
  product_researcher: productResearcher.research,
  policy_researcher: policyResearcher.research,
  loss_ratio_researcher: lossRatioResearcher.research,
  investment_researcher: investmentResearcher.research,
};

function sendSSE(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

app.post("/api/query", async (req, res) => {
  const { question } = req.body;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  try {
    // 1. Guard
    console.log("[Guard] 실행 중...");
    let guardResult;
    try {
      guardResult = await runGuard(question);
      // API 에러 시 fallback: 기본 통과 처리
      if (guardResult.error) {
        console.warn("[Guard] API 에러 → 기본 통과 처리");
        guardResult = { answerable: true, reason: "Guard API 에러, 기본 통과" };
      }
      sendSSE(res, "guard", guardResult);
      console.log("[Guard] 완료:", guardResult);
    } catch (err) {
      console.error("[Guard] 에러:", err);
      guardResult = { answerable: true, reason: "Guard 예외, 기본 통과" };
      sendSSE(res, "guard", guardResult);
    }

    if (guardResult.answerable === false) {
      // 비활성 리서처 모두 skipped로 전송
      for (const id of Object.keys(researcherMap)) {
        sendSSE(res, "researcher_result", {
          researcher_id: id,
          status: "skipped",
          summary: "질문이 거절되어 분석하지 않았습니다.",
        });
      }
      sendSSE(res, "result", {
        answer: guardResult.refusal_message || guardResult.reason || "이 질문에는 답변할 수 없습니다.",
        chart: { type: "none", title: "", labels: [], datasets: [] },
        citations: [],
        followup_suggestions: [],
      });
      sendSSE(res, "done", {});
      res.end();
      return;
    }

    // 2. Router
    console.log("[Router] 실행 중...");
    let queryPlan;
    try {
      queryPlan = await runRouter(question);
      // API 에러 시 fallback: 전체 리서처 활성화
      if (queryPlan.error) {
        console.warn("[Router] API 에러 → 전체 리서처 활성화 fallback");
        queryPlan = {
          question,
          intent: "단순조회",
          researchers: [
            { id: "product_researcher", active: true, sub_query: question, filters: {}, aggregation: null },
            { id: "policy_researcher", active: true, sub_query: question, filters: {}, aggregation: null },
            { id: "loss_ratio_researcher", active: true, sub_query: question, filters: {}, aggregation: null },
            { id: "investment_researcher", active: true, sub_query: question, filters: {}, aggregation: null },
          ],
          chart_hint: "none",
          chart_axis: { x: "", y: "" },
        };
      }
      sendSSE(res, "plan", queryPlan);
      console.log("[Router] 완료. active:", queryPlan.researchers?.filter(r => r.active).map(r => r.id));
    } catch (err) {
      console.error("[Router] 에러:", err);
      sendSSE(res, "error", { message: `Router 오류: ${err.message}` });
      res.end();
      return;
    }

    // 3. Researchers
    console.log("[Researchers] 실행 중...");
    const allResults = [];

    // queryPlan.researchers 배열에서 각 리서처 정보 추출
    const researchers = queryPlan.researchers || [];

    const researcherPromises = Object.keys(researcherMap).map(async (researcherId) => {
      const plan = researchers.find((r) => r.id === researcherId);
      const isActive = plan && plan.active;

      if (!isActive) {
        const skipped = {
          researcher_id: researcherId,
          status: "skipped",
          summary: plan?.reason || "이 질문과 관련 없는 데이터셋입니다.",
        };
        sendSSE(res, "researcher_result", skipped);
        allResults.push(skipped);
        return;
      }

      sendSSE(res, "researcher", { researcher_id: researcherId, status: "researching" });
      console.log(`[Researcher] ${researcherId} 시작`);

      try {
        const researchFn = researcherMap[researcherId];
        const result = await researchFn(
          plan.sub_query || question,
          plan.filters || {},
          plan.aggregation || null,
          csvData
        );
        sendSSE(res, "researcher_result", { researcher_id: researcherId, ...result });
        allResults.push(result);
        console.log(`[Researcher] ${researcherId} 완료`);
      } catch (err) {
        console.error(`[Researcher] ${researcherId} 에러:`, err);
        const errorResult = {
          researcher_id: researcherId,
          status: "error",
          summary: `오류 발생: ${err.message}`,
        };
        sendSSE(res, "researcher_result", errorResult);
        allResults.push(errorResult);
      }
    });

    await Promise.all(researcherPromises);
    console.log("[Researchers] 모두 완료");

    // 4. Editor
    console.log("[Editor] 실행 중...");
    sendSSE(res, "editor", { status: "synthesizing" });

    try {
      let editorResult = await runEditor(question, queryPlan, allResults);
      // Editor API 에러 시 리서처 결과로 직접 답변 생성
      if (editorResult.error) {
        console.warn("[Editor] API 에러 → 리서처 결과 기반 fallback 답변 생성");
        const successResults = allResults.filter(r => r.status === "success");
        const summaries = successResults.map(r => `- **${r.researcher_id}**: ${r.summary}`).join("\n");
        editorResult = {
          answer: `## 분석 결과\n\n${summaries || "관련 데이터를 찾지 못했습니다."}\n\n> *편집자 에이전트가 일시적으로 사용 불가하여, 리서처 결과를 직접 표시합니다.*`,
          chart: { type: "none", title: "", labels: [], datasets: [] },
          citations: successResults.map(r => ({
            researcher: r.researcher_id,
            finding: r.summary,
            data_rows: r.data_rows || [],
          })),
          followup_suggestions: [],
        };
        // 리서처 chart_data가 있으면 첫 번째 것 사용
        const withChart = successResults.find(r => r.chart_data?.labels?.length > 0);
        if (withChart) {
          const cd = withChart.chart_data;
          editorResult.chart = {
            type: queryPlan.chart_hint || "bar",
            title: question,
            labels: cd.labels,
            datasets: [{ label: "값", data: cd.values }],
          };
        }
      }
      sendSSE(res, "result", editorResult);
      sendSSE(res, "done", {});
      console.log("[Editor] 완료");
    } catch (err) {
      console.error("[Editor] 에러:", err);
      sendSSE(res, "error", { message: `Editor 오류: ${err.message}` });
      res.end();
      return;
    }
  } catch (err) {
    console.error("[Pipeline] 전체 에러:", err);
    sendSSE(res, "error", { message: `파이프라인 오류: ${err.message}` });
  } finally {
    res.end();
  }
});

async function start() {
  console.log("CSV 데이터 로딩 중...");
  csvData = await loadAllCSV();
  console.log("CSV 로딩 완료");

  app.locals.csvData = csvData;

  app.listen(PORT, () => {
    console.log(`서버 시작: http://localhost:${PORT}`);
  });
}

start();
