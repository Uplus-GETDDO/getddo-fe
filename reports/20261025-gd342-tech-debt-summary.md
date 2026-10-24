# GD-342 — 잔여 기술 부채 정리 요약 (PPT 자료)

- 작성일: 2026-10-25
- 범위: 2026-10-24 감사에서 확정된 5개 개선 항목 → 항목별 독립 PR
- 검증 기준: `format:check`·`lint`(경고 0)·`test:ci`(137파일/893건)·`build`·`perf:budget` 전 PR 통과

## 한눈에 보는 전후

| 항목                     | 전                                                            | 후                                                           | PR                                                         |
| ------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| 미사용 dependency        | `@reduxjs/toolkit`·`react-redux` (import 0건)                 | 제거, 초기 JS −0.03KiB(의존성만 정리)                        | [#169](https://github.com/Uplus-GETDDO/getddo-fe/pull/169) |
| RUM(실사용자 지표)       | 없음 — 필드 회귀 관측 불가                                    | `@vercel/speed-insights` 도입, FCP·LCP·INP·CLS p75 수집      | [#170](https://github.com/Uplus-GETDDO/getddo-fe/pull/170) |
| 목업 하드코딩 날짜       | 비테스트 핸들러 ~130곳, 'open'인데 마감 지난 fixture 4건 존재 | `demoTime` 상대 시각으로 전수 통일, 재발 불가 구조           | [#171](https://github.com/Uplus-GETDDO/getddo-fe/pull/171) |
| LCP·CLS (/login)         | LCP 2,709ms · CLS 0.109 (스켈레톤→목록 교체)                  | 첫 렌더부터 목록 표시 — prod 재측정은 머지·배포 후 기록      | [#172](https://github.com/Uplus-GETDDO/getddo-fe/pull/172) |
| 거대 컴포넌트 (admin)    | DrawRunDetail 976줄, AdminEventFormPage 561줄                 | 376줄·403줄 + 훅 1개·섹션 파일 2개·공용 조각 2개             | [#173](https://github.com/Uplus-GETDDO/getddo-fe/pull/173) |
| 거대 컴포넌트 (게임 4개) | TakkoOrder 709 / Timing 631 / Run 614 / ColorWord 505         | 147 / 122 / 119 / 112줄 + 훅 4개(324~421)·표현 컴포넌트 12개 | [#174](https://github.com/Uplus-GETDDO/getddo-fe/pull/174) |

## 항목별 설명

### 1. Dead dependency 제거 (#169)

- import 0건이던 `@reduxjs/toolkit`·`react-redux`를 제거. AGENTS.md·README 기술 스택 목록 갱신.
- ADR-0003의 판단 기준 표(복잡한 전역 플로우 → Redux Toolkit)는 유지하고 이력에 "미사용으로 제거, 필요 시 재도입"을 기록 — 결정 자체는 살아 있는 정책이고 도구만 뺀 것.

### 2. RUM 도입 (#170)

- GD-340에서 "수집 백엔드 부재"로 보류했던 전제를 Vercel Speed Insights로 해소 — Vercel이 수집·저장·대시보드를 제공.
- `main.tsx`에 `<SpeedInsights />` 1줄, 초기 JS gzip 232.5→233.5KiB(+0.97KiB, 버짓 256KiB 내).
- 배포 후 Vercel 대시보드에서 활성화 필요(1회 수동) — `docs/performance-budget.md`에 절차·비용 전제 기록.

### 3. 목업 날짜 상수 정리 (#171)

- `src/mocks/demoTime.ts` 신설 — 세션 기준 시각(sessionStorage 고정)에서 오프셋만큼 떨어진 ISO를 만드는 `demoTime`을 공용화. 기존엔 event.ts에만 있어 다른 핸들러가 리터럴을 박아 뒀음.
- 변환 기준: 미래 의존(리스·재시도·예정·만료·진행 중 종료시각) → 미래 오프셋, 이력(생성·요청·차단 시각) → 과거 오프셋으로 레코드 간 간격 보존. 주석의 계약 확정일·상품 문구('2027년 캘린더')는 유지.
- 부수 효과: 'open'인데 `endsAt`이 과거로 굳어 있던 evt-005·010·201·207이 이번에 복구됨.
- 깨진 테스트 2건은 fixture 기준 시각에서 범위를 파생하도록 수정 — 날짜 하드코딩 재발 경로 자체를 없앰.

### 4. LCP·CLS 개선 (#172)

- 진단(GD-334 Lighthouse JSON): LCP 요소는 배너 이미지가 아니라 가상 사용자 목록의 텍스트 `<span>` — fetchpriority는 무관. FCP 2,259ms + 목록이 쿼리 pending→스켈레톤→실목록으로 2단계 렌더되면서 LCP가 늦어지고 섹션 전체가 이동(CLS 0.109).
- 원인: `useVirtualUsers`가 서버 호출이 아닌 빌드타임 env JSON 동기 파싱인데 TanStack Query pending 프레임을 거쳤음.
- 수정: `initialData` 주입으로 첫 렌더부터 목록 표시. 파싱 실패는 `undefined` → 기존 `isError` 안내 경로 유지.
- 기대: LCP≈FCP 수준(≤2.5s 목표) + CLS 제거. prod 3회 중앙값 재측정(GD-332 절차)은 머지·배포 후 수행.

### 5. 거대 컴포넌트 분할 (#173, 게임 PR 진행 중)

- **DrawRunDetail (976→376줄)**: 취소 원본 탐색·공개 이력 판정·최종 명단 합성(순수 파생 상태)을 `hooks/useDrawRunDerived.ts`(235줄)로, 요약·실패·취소·공개·명단·결과 6개 섹션을 `ui/DrawRunSections.tsx`로, 칩·필드 조각을 `ui/DrawRunParts.tsx`·`model/chip.ts`로. 모달 껍데기와 액션 분기만 원본에 남김.
- **AdminEventFormPage (561→403줄)**: 가장 큰 경품 섹션을 `ui/EventPrizesSection.tsx`로, 폼 스타일 상수를 `model/formStyles.ts`로 분리.
- **게임 4개**: 공통 Phase 상태기 + countdown/reveal 상수 구조. 상태기·타이머·rAF 루프·키 입력·판정을 `hooks/useXxxGame.ts`(324~421줄)로, 오버레이·HUD·보드를 `ui/` 표현 컴포넌트 12개로 분리 — 각 게임 파일이 112~147줄로 축소. 로직은 이동만, 동작 변경 없음(기존 테스트 미수정·전부 통과).

## 성능 최적화 전체 흐름 (GD-262 → GD-342)

| 단계   | 내용                                           | 초기 JS(gzip)  | LCP(모바일 중앙값) |
| ------ | ---------------------------------------------- | -------------- | ------------------ |
| GD-262 | 기준선                                         | ~340KiB        | ~3.5s              |
| GD-330 | 폰트 CSS 비동기 분리                           | —              | 3,491ms            |
| GD-332 | 초기 그래프 축소(codeSplitting·dynamic import) | 232KiB (−32%)  | 2,678ms (−23%)     |
| GD-334 | 홈 prefetch 등                                 | —              | 2,641ms            |
| GD-340 | 성능 버짓 CI 게이트 (JS 256KiB·CSS 30KiB)      | 회귀 차단 장치 | —                  |
| GD-342 | dep 정리 + LCP/CLS + RUM                       | 233.5KiB       | prod 재측정 예정   |

- 관측 체계 완성: CI가 **빌드 산출물**(번들 총량)을 막고, Lighthouse 재측정이 **배포 간 추세**를 보고, Speed Insights가 **필드 p75 회귀**를 메운다 — 세 층이 공백 없이 연결.
