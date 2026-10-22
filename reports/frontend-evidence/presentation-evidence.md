# 발표 근거 — 수치·문장·한계

> 규칙: 주장마다 이전값/이후값/단위/표본/환경/커밋/증거를 적는다. 관측값·과거 기록·목표·가설을 구분한다.
> 커밋: `c8ba14843fdd8a551a5f1d9ab62ce9f0fe446fe7` (dev, 2026-10-22 KST 측정). 환경: 로컬 Windows 11 x64, i7-1165G7, 24GB, Node v24.14.1, production 빌드 + MSW 로컬 목업(`local-mock`). 실서버 측정 없음.

## 1. 요청 비용 (관측값 — 테스트 카운터, 로컬)

| 항목                                           | 값                                              | 표본·계층                    | 증거                                                                        |
| ---------------------------------------------- | ----------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| 응모권 이력 최초 조회 요청 (원시 0/5/6/1000건) | 각 1회 (size=5)                                 | fixture당 1회, MSW HTTP 경계 | `src/entities/ticket/api/history.test.tsx`, baseline `req-ticket-history-*` |
| 이력 더보기 1회 누적                           | 2회 (6·1000건 fixture)                          |                              |                                                                             |
| 내 응모 행 90초 누적 결과 조회                 | 25개 접수·표시 20개 → 85회 (최초 25 + 3주기×20) | 1회, Axios spy 경계          | `src/app/config/rowPolling.test.tsx`, baseline `req-my-entry-rows-90s`      |
| 월 합계 조회                                   | 조건별 size=1 `totalElements`, 이력 목록과 분리 |                              | `history.test.tsx` '월 합계는 size=1'                                       |

- 과거 기록(인용, 이번 재측정 아님): GD-246은 '1000건 최초 조회 10→1'을 보고했다. 현 코드에서 확인한 최초 요청은 fixture와 무관하게 1회 — 과거 '이전 10회'는 당시 커서 전체 수집 구현의 기록이며 현 코드 비교값이 아니다. 감소율 90%(10→1)·15%(100→85)·주기당 20%(25→20)는 각각 해당 모의 조건 한정이다. 서비스 속도 개선율로 확대하지 않는다.

## 2. 번들 (관측값 — 디스크 raw·gzip, production 빌드)

| 항목                  | raw                       | gzip                     | 파일 수 | 증거                                                                       |
| --------------------- | ------------------------- | ------------------------ | ------- | -------------------------------------------------------------------------- |
| 초기(entry) 청크 합계 | 1,476,865 B (≈1.41 MiB)   | 431,902 B (≈422 KiB)     | 25      | `scripts/measureFrontendEvidence.mjs bytes dist` → baseline `bundle-entry` |
| 전체 산출물 합계      | 16,839,176 B (≈16.06 MiB) | 14,684,318 B (≈14.0 MiB) | 249     | baseline `bundle-all`                                                      |

- 구조 확인(코드 관측): 게임 4종은 `GamePlayer.tsx`의 `React.lazy`, 관리자 라우트 전체는 `adminRoutes.tsx` lazy, 벤더·차트는 `vite.config.ts` codeSplitting으로 분리돼 있다 — 기존 작업이며 이번 세션의 성과가 아니다.
- 분류 관측: entry 집합(index.html 참조 25파일)에 게임·관리자·msw 청크가 없고 `vendor`·`react`·`router`·`tanstack`·`zod` 청크만 유입된다 — 기존 분리 경계가 초기 로딩에서도 유지됨을 바이트로 확인.
- 한계: 디스크 바이트≠네트워크 전송량. 첫 화면이 실제로 요청한 청크·캐시 hit·실전송은 브라우저 표본이 있어야 단정할 수 있다.

## 2.5 프리뷰 HTML 응답 (관측값 — vite preview + Node fetch, loopback)

| 시나리오                       | cold n=1                           | warm n=10 중간값 | warm 범위    | 증거                                                 |
| ------------------------------ | ---------------------------------- | ---------------- | ------------ | ---------------------------------------------------- |
| `/`                            | 180.94 ms (서버 첫 요청 웜업 포함) | 4.89 ms          | 4.16–7.10 ms | baseline `load-preview-/`, `preview-load.raw.json`   |
| `/login`                       | 8.11 ms                            | 4.51 ms          | 3.95–7.70 ms | baseline `load-preview-/login`                       |
| `/events/evt-001`              | 7.03 ms                            | 4.50 ms          | 3.96–7.11 ms | baseline `load-preview-/events/evt-001`              |
| `/missions`                    | 6.78 ms                            | 4.16 ms          | 3.76–4.93 ms | baseline `load-preview-/missions`                    |
| `/missions/games/takko-timing` | 6.33 ms                            | 4.17 ms          | 3.73–5.71 ms | baseline `load-preview-/missions/games/takko-timing` |

- 측정 대상은 SPA fallback의 `index.html` 수신(TTFB+본문, 3,083 B)이다 — React 렌더·API 응답 시간이 아니며 화면 완성 시간으로 읽으면 안 된다.
- `cold`는 preview 프로세스 시작 후 경로별 첫 요청 1표본이다 — 정적 서버라 브라우저 캐시 의미의 cold가 아니며 n=1 극단값이다.

## 3. 중복·거절 처리 (관측값 — Axios spy·MSW, 로컬)

| 시나리오                           | 시도/요청                               | 관측                                                 | 증거                                                              |
| ---------------------------------- | --------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| 출석 같은 틱 2회                   | 2 시도 → post 1회                       | FE 송신 차단                                         | `checkAttendance/api/queries.test.tsx`, baseline `dup-attendance` |
| 출석 429 대기 중 재클릭            | 2 시도 → post 1회                       | 대기 우회 없음                                       |                                                                   |
| 응모 응답 유실 후 같은 장수 재시도 | 2 시도 → post 2회, 같은 Idempotency-Key | 재시도 식별 (서버 멱등이 같은 키를 같은 의도로 처리) | `enterEvent/api/queries.test.tsx`, baseline `dup-enter-event`     |
| 응모 지연 응답 중 같은 장수 연타   | 2 시도 → post 2회, 같은 키              |                                                      |                                                                   |
| 응모 접수 성공 후 추가 응모        | 2 시도 → post 2회, 새 키                | 새 의도는 막히지 않음                                |                                                                   |
| 응모 서버 응답 거절 후 재시도      | 2 시도 → post 2회, 새 키                | 거절 결과는 키에 묶여 저장되므로 다음은 새 건        |                                                                   |
| 게임 응답 유실 후 재시도           | 원본 본문 그대로 재전송, 새 판 미발급   | 보상 중복 방지는 원본 보존으로                       | `useGamePlaySession.test.tsx`, baseline `dup-game-session`        |

- FE 송신 차단과 서버 멱등 보장은 별개다 — 위 표는 FE가 보낸 요청 수와 키 관측이며, '실제 차감 1회'는 MSW 목업(`mocks/handlers/entry.test.ts`)과 과거 실서버 기록(GD-261)이 담당한다.
- `attemptRef` 수명은 훅 인스턴스 한정 — 탭 간·새로고침의 중복 차단은 서버 멱등키에 의존한다 (한계로 명시).

## 4. 화면 성능·상호작용 (미측정 — 도구/승인 경계)

- LCP·CLS·INP·클릭→피드백 지연·실전송량·발표 반영 지연은 표본을 수집하지 않았다 — Playwright 1.64.1·chromium-1247은 설치돼 있으나 production 빌드는 `VITE_ENABLE_MSW=false`라 preview에서 API가 전부 실패해 화면 표본이 무의미하고, dev+MSW는 production과 비교 금지 규약·MSW 활성 빌드는 `buildMode`가 달라 동일 조건 불가로 판단했다. baseline `ux-web-vitals` run에 `null`과 사유를 남겼다. 목표값(LCP 2.5s·CLS 0.1·피드백 200ms)은 프로젝트 내부 후보 기준이며 미달·달성 판정을 내리지 않는다.
- 'API p95 113/117ms이므로 발표 반영 2초' 같은 연결은 하지 않는다 — 30초 폴링 주기와 원문 2초 목표의 불일치는 계획서에 기록된 열린 항목이다.

## 5. 개발 효율 (기준선만 — 비교군 없음)

- `development-efficiency.csv`에 이번 세션 작업의 시작·대기·검증 시간을 남긴다. 과거 PR/Jira의 실제 작업시간 기록은 이 레포에 없어 소급 추정하지 않았다 — 개발속도 향상률은 제시하지 않는다.

## 6. 검증 범위와 한계

- 로컬 목업(MSW)·Axios spy 관측이다. 실서버 지연·SQL 비용·실사용자 p75는 어떤 수치에도 들어있지 않다.
- 요청 수는 결정적 테스트 카운터(표본 1)다 — 브라우저 네트워크 경계와 다른 계층이므로 혼합하지 않는다.
- 사람 과제 수행 기록 없음 — '페르소나 사용성 평가 완료'로 표현하지 않는다. 페르소나는 구현 점검 기준으로 썼다 (persona-traceability.md).
