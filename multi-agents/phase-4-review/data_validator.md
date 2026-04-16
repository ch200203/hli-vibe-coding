# Phase 4-B: Data Validator (수치 인용 검증) — NEW

## OMC Agent: `oh-my-claudecode:verifier`
## 모델 티어: Sonnet
## 실행 방식: 순차 (Critic 이후, 선택적)

---

## Goal
Editor 답변에 포함된 모든 수치가 리서처의 실제 집계 결과와 일치하는지 교차 검증한다.
**LLM이 만들어낸 수치(환각)를 잡아내는 마지막 방어선.**

## Input
```json
{
  "answer": "Editor가 생성한 마크다운 답변",
  "citations": [...],
  "researcher_results": [
    {
      "researcher_id": "policy_researcher",
      "data_rows": [{ "카테고리": "자동차", "계약수": 45 }],
      "chart_data": { "labels": ["자동차"], "values": [45] }
    }
  ]
}
```

## Output
```json
{
  "validation_result": "Valid | Partially Valid | Invalid",
  "total_numbers_checked": 8,
  "matched": 7,
  "mismatched": 1,
  "hallucinated": 0,
  "details": [
    {
      "number_in_answer": "45건",
      "claimed_source": "policy_researcher",
      "actual_value_in_source": 45,
      "match": true
    },
    {
      "number_in_answer": "35%",
      "claimed_source": "policy_researcher",
      "actual_value_in_source": null,
      "match": false,
      "note": "리서처 결과에 백분율 데이터 없음 — 환각 가능성"
    }
  ],
  "chart_validation": {
    "labels_match": true,
    "data_match": true,
    "issues": []
  }
}
```

## 검증 로직 (LLM 호출 없이 JS로 구현 가능)

### 1. 답변에서 수치 추출
```javascript
// 정규식으로 답변 텍스트에서 모든 숫자 추출
const numbers = answer.match(/[\d,]+(?:\.\d+)?(?:건|명|원|%|개)?/g);
```

### 2. 리서처 결과에서 수치 풀 구성
```javascript
// 모든 리서처의 data_rows + chart_data에서 수치 수집
const sourceNumbers = new Set();
researcherResults.forEach(r => {
  r.data_rows?.forEach(row => Object.values(row).forEach(v => {
    if (typeof v === 'number') sourceNumbers.add(v);
  }));
  r.chart_data?.values?.forEach(v => sourceNumbers.add(v));
});
```

### 3. 교차 매칭
- 답변의 각 수치가 sourceNumbers에 존재하는지 확인
- 존재하지 않는 수치 = 환각 후보
- 반올림/포맷 차이 허용 (±1% 오차)

### 4. 차트 데이터 검증
- Editor chart.labels가 리서처 chart_data.labels의 부분집합인지
- Editor chart.datasets[].data가 리서처 chart_data.values와 일치하는지

## Constraints
- 수치를 수정하지 않는다 — 불일치 보고만
- 리서처 결과에 있는 수치와 정확히 매칭 (반올림 오차만 허용)
- 환각으로 판단된 수치는 `hallucinated` 카운트에 포함
- validation_result 기준:
  - Valid: 불일치 0, 환각 0
  - Partially Valid: 불일치 1~2, 환각 0
  - Invalid: 환각 1개 이상 또는 불일치 3개 이상
