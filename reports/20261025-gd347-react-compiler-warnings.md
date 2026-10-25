# GD-347 — React Compiler 경고(Todo) 해소

- 날짜: 2026-10-25
- 기준: `dev` @ `034696b` → 작업 브랜치 `refactor/GD-347`
- 판정: `npm run build`·`npm run test:ci` 출력에서 `react-compiler(Todo)`를 `grep -c`로 계수

## 전후 경고 수

| 출력              | 전              | 후      |
| ----------------- | --------------- | ------- |
| `npm run build`   | 19건 / 15파일   | **0건** |
| `npm run test:ci` | 14건(부분 집합) | **0건** |

`'use no memo'` 지시어는 한 곳도 쓰지 않았다 — 전부 컴파일러가 받아들이는 형태로 고쳤다.

## 패턴별 조치

| 패턴                         | 건수 | 조치                                                      | 대상                                                                                                                                                                                          |
| ---------------------------- | ---- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `try`/`finally` (catch 없음) | 2    | `promise.finally()`로 양쪽 해제                           | `submitMission/api/queries.ts`, `MyEntryRefreshStatus.tsx`                                                                                                                                    |
| `try`/`catch`/`finally`      | 9    | 성공·실패 양 분기에서 `busy`/`frame` 직접 해제            | `checkAttendance/api/queries.ts`, `manageMission`, `manageAttendancePolicy`×2, `useGamePlaySession` send, `useDrawRunDerived`, `AttendanceCheckCard`, `useTakkoRunGame`, `useTakkoTimingGame` |
| `for(;;)` 빈 조건            | 1    | 수집 상한(`events.length < totalElements`)을 for 조건으로 | `entities/event/api/queries.ts`                                                                                                                                                               |
| 람다 캡처 `page++`           | 1    | `while` 순회 + `page += 1`                                | `useDrawRunDerived.ts`                                                                                                                                                                        |
| `try` 안 `throw`             | 1    | 시작 요청만 try로 묶고 버전 불일치 거절을 try 밖으로      | `useGamePlaySession.ts` begin                                                                                                                                                                 |
| 기본값 화살표 함수           | 1    | 모듈 상수 `allGroups`로 승격                              | `useMyEntryRows.ts`                                                                                                                                                                           |
| 동적 `import()` 표현식       | 2    | 모듈 함수 `prefetchUserShell`로 승격                      | `userRoutes.tsx`                                                                                                                                                                              |
| 논리 할당 `??=`              | 1    | `if` 문으로                                               | `useLoopingBgm.ts`                                                                                                                                                                            |

## 가드 보존 확인

- `busy.current` 중복 제출 가드: mutationFn 4곳은 성공 직전·catch 안에서 각각 `false`로 해제 — 요청 처리 중 잠금 유지 범위가 원래와 같다.
- `entities/event` 전체 수집 루프: `totalElements` 도달 종료와 `items.length===0` 조기 실패를 동일하게 유지한다 (빈 페이지이면서 전량 미달일 때만 throw).
- `userRoutes` prefetch: `requestIdleCallback` 타이밍과 대상 청크(`UserLayout`·`HomePage`)는 그대로 — 호출 위치만 모듈 함수로 옮겼다 (GD-342 의도 유지).
- `useGamePlaySession` 버전 불일치: `start.mutateAsync` 성공 후 `ruleVersion`이 다르면 같은 안내 문구로 세션 진입을 막는다.
- `useDrawRunDerived` 취소 탐색: `cancelled` 시 `setEarlierSearch`를 쓰지 않고 `searchingRef`만 해제하는 흐름을 유지한다.
- 프레임 루프 2곳(타꼬런·타이밍): 프레임 오류가 나도 다음 `requestAnimationFrame`이 반드시 이어지는 불변식을 유지한다.

## 검증

| 명령                                | 결과                              |
| ----------------------------------- | --------------------------------- |
| `npm run format:check`              | 통과                              |
| `npm run lint` (`--max-warnings=0`) | 0 경고 통과                       |
| `npm run test:ci`                   | 143파일 · 916개 전부 통과         |
| `npm run build`                     | 통과 — `react-compiler(Todo)` 0건 |

> 테스트 수가 베이스라인(137파일·893개)보다 늘어난 것은 dev에 새 머지(#167·#178·#179)가 반영된 탓이다.
