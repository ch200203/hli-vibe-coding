const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// 모델 fallback 체인: .env에서 쉼표 구분으로 여러 모델 지정 가능
// 예: GEMINI_MODEL=gemini-2.5-flash,gemini-2.0-flash,gemini-1.5-flash
const MODEL_CHAIN = (process.env.GEMINI_MODEL || "gemini-2.0-flash")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log(`[gemini] 모델 체인: ${MODEL_CHAIN.join(" → ")}`);

function extractJsonFromText(text) {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }
  throw new Error("JSON 블록을 찾을 수 없습니다.");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function tryModel(modelName, prompt, modelConfig) {
  const config = { ...modelConfig, model: modelName };
  const model = genAI.getGenerativeModel(config);
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function callGemini(prompt, systemInstruction) {
  const modelConfig = {
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  };

  if (systemInstruction) {
    modelConfig.systemInstruction = systemInstruction;
  }

  // 각 모델을 순서대로 시도, rate limit 시 다음 모델로 fallback
  for (let mi = 0; mi < MODEL_CHAIN.length; mi++) {
    const modelName = MODEL_CHAIN[mi];
    const isLastModel = mi === MODEL_CHAIN.length - 1;
    const maxRetries = isLastModel ? 2 : 1; // 마지막 모델만 재시도

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[gemini] ${modelName} 호출 (model ${mi + 1}/${MODEL_CHAIN.length}, attempt ${attempt + 1}/${maxRetries + 1})`
        );

        const text = await tryModel(modelName, prompt, modelConfig);

        console.log(
          `[gemini] ${modelName} 완료, 응답 길이: ${text.length}`
        );

        try {
          return JSON.parse(text);
        } catch (parseErr) {
          console.log(
            `[gemini] JSON.parse 실패: ${parseErr.message}, extractJsonFromText 시도...`
          );
          return extractJsonFromText(text);
        }
      } catch (err) {
        const isRateLimit =
          err?.status === 429 ||
          (err?.message && err.message.includes("429"));

        if (isRateLimit && !isLastModel) {
          console.log(
            `[gemini] ${modelName} rate limit → 다음 모델(${MODEL_CHAIN[mi + 1]})로 fallback`
          );
          break; // 다음 모델로
        }

        if (attempt < maxRetries) {
          const waitMs = isRateLimit ? 2000 : 1000;
          console.log(
            `[gemini] ${modelName} 오류, ${waitMs / 1000}초 대기 후 재시도... ${err.message?.substring(0, 80)}`
          );
          await sleep(waitMs);
        } else if (!isLastModel) {
          console.log(
            `[gemini] ${modelName} 실패 → 다음 모델(${MODEL_CHAIN[mi + 1]})로 fallback`
          );
          break; // 다음 모델로
        } else {
          console.error(`[gemini] 모든 모델 실패:`, err.message?.substring(0, 120));
          return { error: true, message: err.message || "알 수 없는 오류" };
        }
      }
    }
  }

  return { error: true, message: "모든 모델이 실패했습니다." };
}

module.exports = { callGemini };
