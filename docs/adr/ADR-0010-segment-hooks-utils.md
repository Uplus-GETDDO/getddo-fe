# ADR-0010: 슬라이스 세그먼트 — `lib` 폐기와 `hooks`/`utils`/`model` 3분리

- 상태: accepted
- 날짜: 2026-10-17

## 맥락

기존 `lib/` 세그먼트에 순수 함수(`date`, `format`, `pagination`), React 훅(`useCountUp`, `useDragScroll`), zustand 스토어(`uiSettings`), context 묶음(`virtualClock`), 상수(`filterConstants`), 에셋 매핑·CSS(`pixelFont.css`, 게임 사운드·이미지 맵)가 섞여 있었다. 멘토링에서 "내용에 맞게 분리하라"는 피드백이 나왔고, 파일이 늘수록 "이 파일을 어디 둘까"의 답이 폴더명에서 안 나오는 문제가 실재했다.

## 결정

`lib` 세그먼트를 폐기하고 기술적 성격으로 3분리한다.

- `utils/` — 순수 함수·로더 (`date`, `format`, `pagination`, `toEvent` …)
- `hooks/` — React 훅 (`use*`)
- `model/` — 스토어·context·상수·스키마·에셋 매핑·도메인 규칙 (기존 `model/` 규칙 확장)

판단 기준: 파일이 React 훅이면 `hooks/`, 도메인을 아는 상태·스키마·상수면 `model/`, 나머지 순수 함수는 `utils/`. 같은 기준으로 `model/`에 있던 훅(`useEventStageCounts`, `useTicketTrend`)도 `hooks/`로 이동한다.

## 버린 선택지

- **FSD 표준 `lib` 유지 + 관심사별 하위 라이브러리** (`lib/date/` …) — FSD 정석이지만 현재 파일 규모(슬라이스당 1~3개)에서는 하위 폴더가 과도한 중첩이라 기각.
- **`store`/`types`/`constants`/`data` 세그먼트까지 분리** — 스토어·상수 파일이 각각 1~2건뿐이라 빈 폴더만 늘어난다. `model/`이 비대해지면 그때 `store/` 분리를 검토한다. `types/`는 Zod 스키마에서 타입을 infer하는 구조와 역할이 겹쳐 채택하지 않는다.

## 결과

- 세그먼트명이 파일의 기술적 성격을 바로 말해준다 — 탐색 비용이 줄고 새 파일의 위치가 규칙으로 정해진다.
- FSD 강제 사항(레이어 의존 방향, 슬라이스 격리)은 그대로 유지되며 세그먼트명만 React 관례를 따르는 하이브리드다. FSD 문서는 `hooks`/`types`를 "본질을 담은 나쁜 세그먼트명"으로 꼽지만 팀 관례와 멘토 지적을 우선했다.
- `eslint-plugin-boundaries`는 세그먼트명을 강제하지 않으므로 설정 변경 없이 적용됐다. 규칙 문구는 `AGENTS.md`에 반영됐다.
- 공개 API는 슬라이스 루트 `index.ts`로 유지 — `index.ts`만 바뀌고 외부 참조 경로 체계는 동일하다.
