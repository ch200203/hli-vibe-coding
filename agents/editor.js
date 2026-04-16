const { callGemini } = require("../utils/gemini");

async function runEditor(question, queryPlan, researcherResults) {
  console.log("[editor] 시작. 리서처 결과 수:", researcherResults.length);

  // 모든 리서처가 skipped 또는 no_data인지 확인
  const hasData = researcherResults.some(
    (r) => r.status !== "skipped" && r.status !== "no_data" && r.data && r.data.length > 0
  );

  const prompt = `당신은 보험 및 투자 데이터 분석 시스템의 편집자 에이전트입니다.
여러 리서처가 수집한 데이터를 통합하여 사용자에게 명확하고 유용한 최종 답변을 작성해야 합니다.

## 원본 질문
"${question}"

## 쿼리 플랜
${JSON.stringify(queryPlan, null, 2)}

## 리서처 결과
${JSON.stringify(researcherResults, null, 2)}

## 답변 작성 규칙
1. 첫 문장에 핵심 수치를 포함한 직접적인 답변을 제시하세요.
2. 중간 부분에 상세 분석을 작성하세요.
3. 모든 수치는 반드시 리서처 결과에서 인용하세요. 없는 수치를 생성하거나 추측하지 마세요.
4. 마크다운 형식으로 작성하세요 (헤더, 목록, 강조 활용).
5. 리서처 결과 간 충돌이 있을 경우 양쪽을 모두 제시하고 차이를 설명하세요.
${!hasData ? "6. 모든 리서처가 데이터를 찾지 못했으므로 '관련 데이터를 찾지 못했습니다'로 답변을 시작하세요." : ""}

## 차트 생성 규칙
- queryPlan.chart_hint를 참고하되, 실제 데이터에 맞게 조정하세요.
- 시계열 데이터 → "line", 카테고리 비교 → "bar", 비율/구성 → "pie", 텍스트만 → "none"
- 데이터가 없거나 차트로 표현하기 부적합하면 type: "none"으로 설정하세요.
- labels와 datasets.data의 길이는 반드시 동일해야 합니다.
- 수치는 리서처 결과에서 실제로 존재하는 값만 사용하세요.

## 반환 스키마
다음 JSON 형식으로만 응답하세요:
{
  "answer": "마크다운 형식의 최종 답변 (한국어)",
  "chart": {
    "type": "bar|line|pie|none 중 하나",
    "title": "차트 제목 (type이 none이면 빈 문자열)",
    "labels": ["X축 레이블 배열 (type이 none이면 빈 배열)"],
    "datasets": [
      {
        "label": "데이터셋 레이블",
        "data": [숫자 배열]
      }
    ]
  },
  "citations": [
    {
      "researcher": "리서처 ID",
      "finding": "이 리서처 결과에서 발견한 핵심 사항",
      "data_rows": [{}]
    }
  ],
  "followup_suggestions": [
    "후속 질문 제안 1 (한국어)",
    "후속 질문 제안 2 (한국어)",
    "후속 질문 제안 3 (한국어)"
  ]
}`;

  const result = await callGemini(prompt);
  console.log("[editor] 완료. 차트 타입:", result.chart?.type, "/ 후속 제안 수:", result.followup_suggestions?.length);
  return result;
}

module.exports = { runEditor };
