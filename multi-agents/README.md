# 멀티 리서처 BI — 에이전트 오케스트레이션 구조

> Part-3 강의의 "병렬 초안 → 검수 게이트 → 최종 통합" 3단 파이프라인을
> 자연어 BI 시스템의 런타임 파이프라인에 적용한 구조

## 파이프라인 도식

```
[Phase 0 — Orchestrator]
server.js가 전체 흐름 제어

       ↓

[Phase 1 — Intake (순차, 빠름)]
guard    ─→ 거절 판단 (통과/거절)
router   ─→ 쿼리플랜 JSON 생성

       ↓

[Phase 2 — Research (병렬 4명)]
product_researcher   ─┐
policy_researcher    ─┤─→ 각자 담당 CSV 분석
loss_ratio_researcher─┤
investment_researcher─┘

       ↓

[Phase 3 — Synthesis (순차)]
editor          ─→ 리서처 결과 통합 답변 + 차트
chart_optimizer ─→ 차트 데이터 보정 (NEW)

       ↓

[Phase 4 — Review Gate (순차, NEW)]
critic          ─→ 답변 품질 검수
data_validator  ─→ 수치 인용 검증
```

## OMC 에이전트 매핑

| Phase | 에이전트 | OMC Agent | 모델 티어 | 역할 |
|-------|---------|-----------|----------|------|
| 1 | Guard | `analyst` | Haiku | 답변 가능 여부 판단 |
| 1 | Router | `planner` | Sonnet | 쿼리플랜 JSON 생성 |
| 2 | Researchers ×4 | `scientist` | Sonnet | 담당 CSV 병렬 분석 |
| 3 | Editor | `writer` | Sonnet | 통합 답변 + 차트 스펙 |
| 3 | Chart Optimizer | `designer` | Haiku | 차트 데이터 보정 (NEW) |
| 4 | Critic | `critic` | Opus | 답변 품질 검수 (NEW) |
| 4 | Data Validator | `verifier` | Sonnet | 수치 인용 검증 (NEW) |

## 폴더 구조

```
multi-agents/
├── README.md                         # 이 파일
├── phase-0-orchestrator/
│   └── orchestrator.md               # 파이프라인 총괄
├── phase-1-intake/                   # 순차 실행
│   ├── guard.md                      # analyst → 거절 판단
│   └── router.md                     # planner → 쿼리플랜
├── phase-2-research/                 # 병렬 실행 (핵심)
│   ├── _common_schema.md             # 공통 출력 스키마
│   ├── product_researcher.md         # scientist → products_catalog
│   ├── policy_researcher.md          # scientist → profiles+headers+coverages
│   ├── loss_ratio_researcher.md      # scientist → loss_ratio_timeseries
│   └── investment_researcher.md      # scientist → 투자 6개 CSV
├── phase-3-synthesis/                # 순차 실행
│   ├── editor.md                     # writer → 통합 답변
│   └── chart_optimizer.md            # designer → 차트 보정 (NEW)
├── phase-4-review/                   # 순차 실행 (NEW)
│   ├── critic.md                     # critic → 품질 검수
│   └── data_validator.md             # verifier → 수치 검증
└── prompts/                          # 복붙 프롬프트 모음
    ├── prompt-0-setup.md             # 프로젝트 셋업
    ├── prompt-1-build.md             # Ultrawork 병렬 빌드
    ├── prompt-2-review.md            # 코드 검수
    └── prompt-3-test.md              # 통합 테스트
```

## Part-3 패턴 대응표

| Part-3 (런칭 스프린트) | 멀티 리서처 BI |
|----------------------|---------------|
| Phase 1: analyst+planner+writer+scientist 병렬 | Phase 2: researcher ×4 병렬 |
| Phase 2: critic+security-reviewer 순차 검수 | Phase 4: critic+data_validator 순차 검수 |
| Phase 3: writer 최종 통합 | Phase 3: editor+chart_optimizer 통합 |

## 핵심 원칙 (Part-3에서 가져온 것)

1. **역할 분리**: 각 에이전트는 자기 파일/데이터만 접근
2. **검수 게이트**: 검수 에이전트는 원본을 수정하지 않고 지적만 기록
3. **병렬 vs 순차 명시**: 프롬프트에 실행 방식을 항상 명시
4. **사람 검수 전제**: AI 결과물은 항상 사람 검수를 전제로 생성
