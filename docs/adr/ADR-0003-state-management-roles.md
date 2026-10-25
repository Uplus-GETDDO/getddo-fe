# ADR-0003: 상태관리 도구 분할 (Query/로컬/Zustand/Context/Redux/RHF)

- 상태: accepted
- 날짜: 2026-09-17

## 맥락

서버에서 온 데이터, 화면에 국한된 UI 상태, 여러 화면을 오가는 플로우 상태, 폼 상태를 하나의 스토어에 섞으면 캐시 무효화·동기화 버그가 생긴다. "아는 도구 하나로 전부 해결"하는 방식은 이 프로젝트 규모에서 유지보수 비용이 커진다.

## 결정

데이터의 출처와 수명으로 도구를 나눈다. 판단 순서는 **공유 범위 → 수명 → 변화 빈도**다.

| 데이터 종류                                          | 도구                                    |
| ---------------------------------------------------- | --------------------------------------- |
| 서버에서 받아오는 데이터                             | TanStack Query                          |
| 한 컴포넌트·페이지에 국한된 일시적 상태              | `useState`/`useReducer` (전역화 금지)   |
| 여러 컴포넌트·화면이 동기적으로 공유하는 UI 상태     | Zustand                                 |
| Provider 생명주기와 일치하고 드물게 변하는 전역 상태 | React Context (가상 시계, 인증 세션)    |
| 여러 화면에 걸친 복잡한 전역 플로우                  | Redux Toolkit                           |
| 폼 상태                                              | React Hook Form (전역 상태로 승격 금지) |

### 금지·권장 패턴

- Zustand·Redux store 안에서 API를 직접 호출해 서버 데이터를 `set()`으로 캐싱하지 않는다 — 서버 상태는 TanStack Query만 소유하고, store 이중 캐시는 무효화·일관성 버그를 만든다
- 인증·가상 사용자 같은 선행 조건이 있는 쿼리는 `enabled`로 게이팅한다
- 짧은 시간에 같은 행동이 여러 번 발생할 수 있으면 `useRef` Set으로 동기적 중복을 차단하고, 서버 측 중복은 멱등키로 막는다 (ADR-0005)
- Provider 중첩은 `QueryClientProvider`가 가장 바깥이다 — Context 상태가 쿼리의 `enabled`·queryFn에 영향을 주려면 그 안쪽에 있어야 한다

## 결과

- 새 상태를 추가할 때 먼저 위 표의 어느 행에 속하는지 판단한다
- 서버 데이터를 Zustand/Redux에 복사하지 않는다 — 캐시는 TanStack Query가 소유한다
- 비용: 도구가 여러 개라 신규 팀원의 학습 부담이 있다. 대신 각 도구의 책임이 겹치지 않는다

## 이력

- 2026-09-29: 슬라이스가 하나도 없는 빈 Redux store가 매 로드 `Store does not have a valid reducer` 오류를 내서 `ReduxProvider`·`store.ts`를 제거했다. 첫 슬라이스를 도입할 때 Provider를 함께 되살린다 (의존성은 package.json에 유지).
- 2026-10-25: 의존성만 남긴 채 한 달간 사용되지 않았으므로 `@reduxjs/toolkit`·`react-redux`를 package.json에서 제거했다 (GD-342). 표의 판단 기준은 유지한다 — 여러 화면에 걸친 복잡한 전역 플로우가 생기면 이 결정대로 Redux Toolkit을 재도입한다.
- 2026-10-02: compProject(Ephyra) 상태관리 분석을 참고해 기준을 정제했다 — "화면 국한 상태 → Zustand"라는 모호한 행을 "로컬 `useState`/`useReducer`"와 "여러 컴포넌트가 공유하는 UI → Zustand"로 분리하고, React Context(Provider 생명주기·드문 변화) 행과 store 이중 캐시 금지·enabled 게이팅·동기적 중복 차단 패턴을 추가했다.
