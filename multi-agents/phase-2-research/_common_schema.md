# Phase 2: Research — 공통 스키마 & 규칙

## OMC Agent: `oh-my-claudecode:scientist` × 4 (병렬 실행)
## 모델 티어: Sonnet
## 실행 방식: **병렬** (Promise.all)

---

## 공통 규칙 (Part-3 §5 패턴 적용)

1. **4명은 서로 결과를 기다리지 않고 병렬 실행**
2. **각 리서처는 자기 담당 데이터셋만 접근** (역할 분리)
3. **수치는 JS 사전집계 결과 기반** (LLM이 직접 계산하지 않음)
4. **데이터에 없는 내용은 절대 추측하지 않음** → `status: "no_data"`
5. **불명확하면 "확인 필요"로 표기** (Part-3 공통 규칙)

## 공통 함수 시그니처
```javascript
async function research(subQuery, filters, aggregation, csvData)
// subQuery: Router가 생성한 서브쿼리 문자열
// filters: { column: value } 조건 객체
// aggregation: "count" | "sum:컬럼" | "avg:컬럼" | "group_by:컬럼→count"
// csvData: loadAllCSV()의 반환 객체
```

## 공통 처리 패턴 (3단계)
```
Step 1: csv-query로 필터/집계 (JS — 수치 정확도 보장)
  └─ filter() → groupBy() → aggregate()

Step 2: 집계 결과 요약 (최대 50행 + 샘플 5행)
  └─ LLM 프롬프트에 전달할 데이터 준비

Step 3: Gemini에 해석 요청 (자연어 요약만)
  └─ callGemini(prompt, { jsonMode: true })
```

## 공통 Output 스키마
```json
{
  "researcher_id": "product_researcher",
  "status": "success | no_data | error",
  "summary": "한 줄 요약 (수치 포함)",
  "key_findings": [
    { "metric": "측정 항목", "value": "값", "count": 45, "unit": "건" }
  ],
  "data_rows": [
    { "컬럼1": "값1", "컬럼2": "값2" }
  ],
  "chart_data": {
    "labels": ["라벨1", "라벨2"],
    "values": [45, 32]
  },
  "confidence": "high | medium | low",
  "methodology": "어떤 데이터에서 어떤 필터/집계를 적용했는지"
}
```

## 에러 처리
- 필터 결과 0건 → `{ status: "no_data", summary: "조건에 맞는 데이터 없음" }`
- Gemini 호출 실패 → JS 집계 결과만으로 summary 생성 (graceful degradation)
- 예외 발생 → `{ status: "error", summary: "오류 메시지" }`
