# Phase 3-B: Chart Optimizer (차트 보정) — NEW

## OMC Agent: `oh-my-claudecode:designer`
## 모델 티어: Haiku (빠른 보정)
## 실행 방식: 순차 (Editor 이후, 선택적)

---

## Goal
Editor가 생성한 차트 스펙을 검증하고, Chart.js 렌더링에 최적화된 형태로 보정한다.

## Input
```json
{
  "chart": {
    "type": "bar",
    "title": "30대 남성 상품 카테고리별 가입 건수",
    "labels": ["자동차", "건강", "화재", "생명", ""],
    "datasets": [{ "label": "가입건수", "data": [45, 32, 18, 12, null] }]
  },
  "researcher_chart_data": [
    { "researcher_id": "policy_researcher", "chart_data": { "labels": [...], "values": [...] } }
  ]
}
```

## Output
```json
{
  "chart": {
    "type": "bar",
    "title": "30대 남성 상품 카테고리별 가입 건수",
    "labels": ["자동차", "건강", "화재", "생명"],
    "datasets": [{ "label": "가입건수", "data": [45, 32, 18, 12] }]
  },
  "corrections": [
    "빈 라벨 1개 제거",
    "null 데이터 포인트 1개 제거"
  ]
}
```

## 보정 규칙
1. **labels와 data 길이 일치**: 불일치 시 짧은 쪽에 맞춤
2. **null/undefined 제거**: 데이터 포인트에서 null 제거 (대응 라벨도 제거)
3. **빈 라벨 제거**: 빈 문자열 라벨과 대응 데이터 제거
4. **타입 검증**: data 배열의 모든 요소가 숫자인지 확인
5. **pie 차트 음수 방지**: pie 타입에 음수 데이터가 있으면 bar로 변경
6. **리서처 데이터 교차 검증**: Editor 차트와 리서처 chart_data 수치 비교
7. **차트 없음 판단**: 유효 데이터가 2개 미만이면 type: "none"

## Constraints
- 수치를 변경하지 않음 (제거만 가능)
- 차트 타입은 Editor 결정을 존중 (pie 음수만 예외)
- LLM 호출 없이 JS 로직으로 처리 가능 (비용 0)
