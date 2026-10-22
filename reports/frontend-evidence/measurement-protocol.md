# 프론트엔드 정량 검증 — 측정 규약

> `docs/superpowers/plans/2026-10-21-frontend-evidence-and-optimization.md` §5의 측정 계약을 이 레포의 로컬 실행 조건으로 고정한 문서다.
> 이 규약은 기준선(baseline.json) 수집 전에 확정됐으며, after.json도 같은 조건으로 수집한다.
> 대상: 로컬 전용. 실서버 운영 쓰기·부하·실서버 정합성 검증은 이 규약의 범위 밖이다.

## 1. 실행 조건 (condition 레코드)

baseline.json의 `condition`은 아래 항목을 모두 담는다. after.json 수집 시 동일 값을 요구하고, 하나라도 다르면 해당 시나리오는 `not-comparable`로 처리해 개선율을 산출하지 않는다.

| 항목             | 이번 기준선의 고정값                             | 비고                                                  |
| ---------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `commit`         | `c8ba14843fdd8a551a5f1d9ab62ce9f0fe446fe7` (dev) | 수집 시 `git rev-parse HEAD`로 재기록                 |
| `diffIdentifier` | 작업 트리 diff의 `git diff HEAD` 또는 clean      | 미커밋 변경이 있으면 패치 해시                        |
| `node`           | v24.14.1, npm 11.11.0                            | `node --version`, `npm --version`                     |
| `os`             | Windows 11 (10.0.26200), x64                     | `os.cpus()[0].model`, `os.totalmem()`                 |
| `cpu`            | 11th Gen Intel Core i7-1165G7 @ 2.80GHz          | 제한 없음                                             |
| `memory`         | 24 GiB                                           | —                                                     |
| `browser`        | Playwright(설치본) 또는 `not-measured`           | 사용 시 `npx playwright --version`·브라우저 채널 기록 |
| `buildMode`      | production (`npm run build` → `vite preview`)    | dev+MSW 결과는 production 수치와 비교하지 않는다      |
| `environment`    | `local-mock` (MSW)                               | 실서버 호출 없음                                      |
| `viewport`       | 1280×720, `deviceScaleFactor` 1                  | 브라우저 시나리오 한정                                |
| `cpuThrottle`    | 없음 (1×)                                        | —                                                     |
| `network`        | 없음 (loopback, 제한 없음)                       | 실서버 지연을 흉내 내지 않는다                        |
| `cache`          | `cold` / `warm`을 표본별로 구분                  | 섞지 않는다                                           |
| `accountRole`    | `USER` (가상 사용자, 익명 별칭)                  | 계정 식별자는 저장하지 않는다                         |
| `fixtures`       | 테스트별 fixture ID·건수를 run에 기록            | —                                                     |

## 2. 시나리오와 반복 수

| 영역                      | 시나리오 ID                       | 수집 방법 (측정 계층)                                                                                                            | 반복                        |
| ------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 요청 수 — 응모권 이력     | `req-ticket-history-{0,5,6,1000}` | `src/entities/ticket/api/history.test.tsx`의 MSW HTTP 경계 요청 카운터                                                           | fixture당 1회 (결정적)      |
| 요청 수 — 내 응모 행 폴링 | `req-my-entry-rows-90s`           | `src/app/config/rowPolling.test.tsx`의 Axios spy 경계 카운터 (25개 접수·표시 20개, 0/30/60/90초)                                 | 1회 (결정적)                |
| 중복 차단 — 출석          | `dup-attendance`                  | `src/features/checkAttendance/api/queries.test.tsx` Axios spy                                                                    | 1회 (결정적)                |
| 중복·키 수명 — 응모       | `dup-enter-event`                 | `src/features/enterEvent/api/queries.test.tsx` Axios spy (신규)                                                                  | 1회 (결정적)                |
| 중복 보상 — 게임          | `dup-game-session`                | `src/features/playGame/hooks/useGamePlaySession.test.tsx`                                                                        | 1회 (결정적)                |
| 번들 — 빌드 산출물        | `bundle-{entry,route-*,all}`      | `scripts/measureFrontendEvidence.mjs bytes dist` — 디스크 raw·gzip 바이트, entry vs 동적 청크 분류는 `dist/index.html` 참조 기준 | 빌드 1회                    |
| 초기 로딩 — 프리뷰 HTML   | `load-preview-{route}`            | `vite preview` + Node `fetch`의 HTML 수신 시각·바이트                                                                            | 콜드·웜 구분 기록           |
| 상호작용·LCP·CLS·INP      | `ux-*`                            | Playwright 설치본으로만 시도, 도구 없으면 `null` + 사유                                                                          | 로딩 콜드 10·웜 10, 동작 30 |

- 요청 수 시나리오는 테스트 안의 카운터가 그대로 지표다. HTTP 경계(MSW)와 Axios spy 경계를 `metrics.*.method`로 구분해 적는다 — 둘을 같은 계층 수치로 합치지 않는다.
- 테스트는 결정적이라 fixture당 1 표본이다. 브라우저·타이밍 표본은 위 반복 수를 따른다.
- 로컬 API 정합성 fixture는 시나리오별 독립 초기화 100회가 목표이나, 이는 앱 코드 변경 없이 테스트 러너로만 실행 가능한 범위로 제한한다.

## 3. 지표·단위·기록 형식

- 단위: 시간 `ms`, 크기 `byte`, 횟수 `count`, 비율 `%`. metrics의 각 값은 `{ value, unit, method }`다.
- 결측은 `null` + `reason`을 함께 적는다. 실패한 표본도 삭제하지 않고 `status: "failed"`로 보존한다.
- baseline.json 구조: `{ schemaVersion: 1, condition: {...}, runs: [{ scenario, sampleIndex, metrics, status, evidencePath }] }`.
- API 응답 실패를 지연 표본에서 제외한 경우 `excluded` 필드에 실패율과 제외 사유를 별도로 남긴다.

## 4. 집계 규칙

`scripts/measureFrontendEvidence.mjs`의 `summarize`가 아래 순수 함수와 동등하게 동작한다 (`measureFrontendEvidence.test.mjs`가 검증).

```js
function p95(samples) {
    if (!samples.length || samples.some((x) => !Number.isFinite(x))) return null;
    const sorted = [...samples].sort((a, b) => a - b);
    return sorted[Math.ceil(sorted.length * 0.95) - 1];
}
function reductionPercent(before, after) {
    if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0) return null;
    return ((before - after) / before) * 100;
}
```

- 중간값·p95·최솟값·최댓값·IQR·실패 수·표본 수를 함께 보고한다.
- n=10의 p95는 사실상 극단값이므로 `exploratory: true` 표시로만 쓴다.
- `condition`의 환경·fixture·cache가 다르면 개선율을 계산하지 않고 `not-comparable`로 남긴다.
- 임의로 유리한 표본을 빼지 않는다.

## 5. 프라이버시·보존

- HAR·trace 수준의 원시 자료는 저장하지 않는다. timing·바이트·상태만 보존한다.
- `X-User-ID` 등 계정 식별자·토큰·쿠키는 어떤 산출물에도 넣지 않는다 (역할 별칭만).

## 6. 명령 고정

```bash
npm ci                                        # 의존성 고정 (package-lock 기준)
npm run build                                 # 기준 빌드 — dist/ 생성
node scripts/measureFrontendEvidence.mjs bytes dist        # 번들 표본 수집
npm run test:ci -- src/entities/ticket/api/history.test.tsx \
    src/app/config/rowPolling.test.tsx \
    src/features/checkAttendance/api/queries.test.tsx \
    src/features/enterEvent/api/queries.test.tsx \
    src/features/playGame/hooks/useGamePlaySession.test.tsx # 요청·중복 표본
node scripts/measureFrontendEvidence.mjs summarize reports/frontend-evidence/baseline.json
```

브라우저 표본을 추가할 때는 `python`(Playwright 설치본) 경로의 기존 스크립트 관례(`scripts/verifyL6Browser.py`)를 따르고, 새 의존성은 설치하지 않는다.
