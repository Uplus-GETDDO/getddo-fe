# GD-348 — 프로덕션 배포 후 /login Lighthouse 재측정 (FCP 판정)

- 날짜: 2026-10-25
- 대상: `https://getddo-fe.vercel.app/login`, Lighthouse 13.5, 모바일 프리셋(headless Chrome, simulate throttling)
- 베이스라인: `20261025-gd342-prod-verification.md` — GD-342 머지 상태 프로덕션(FCP 중앙값 2,258ms)
- 판정: 3회 측정·중앙값 비교. FCP 목표 ≤ 1.8s, 가드레일 LCP ≤2.5s·CLS 0·TBT 회귀 없음
- 배포 반영 확인: prod HTML의 정적 셸 마커(`motion-safe:animate-pulse` 5행) grep으로 확인 — entry 해시 비교가 아닌 기능 마커 방식

## perf 점수

| 회차   | 전(GD-342) | 후(GD-348 머지) |
| ------ | ---------- | --------------- |
| 중앙값 | 0.96       | **0.96**        |

## 주요 지표 (보고 수치 = Lantern 시뮬레이션, 중앙값, ms)

회차별: r1 FCP 2,480 / r2 2,258 / r3 2,259. 중앙값 **2,259ms**.

| 지표 | 전(GD-342 중앙값) | 후        | 변화     |
| ---- | ----------------- | --------- | -------- |
| FCP  | 2,258             | **2,259** | 변화없음 |
| LCP  | 2,258             | 2,259     | 변화없음 |
| TBT  | 0                 | 0         | —        |
| SI   | 2,258             | 2,259     | —        |
| CLS  | 0                 | **0**     | 유지     |

¹ r1(FCP 2,480ms)은 cold-cache 첫 방문 변동 — 중앙값 비교가 흡수한다.

## 판정: **FCP 목표 미달** (보고 수치 기준), 가드레일은 전부 유지

- **FCP 중앙값 2,259ms > 1,800ms** — 목표 미달로 기록한다(완료 선언 아님).
- 가드레일: LCP 2,259 ≤2,500 유지, CLS 0 유지, TBT 0 유지 — 회귀 없음.

## 중요 발견 — 보고 수치(시뮬레이션)와 실측 트레이스(observed)의 괴리

Lighthouse 모바일 프리셋은 `throttling: simulate` — 보고 수치는 Lantern 시뮬레이션이고, 실제 트레이스의 관측값은 `metrics` 감사의 `observed*` 필드에 별도로 남는다.

| 지표 (r3 기준)      | 보고 수치(시뮬레이션) | 실측 관측값 |
| ------------------- | --------------------- | ----------- |
| FCP                 | 2,259ms               | **77ms**    |
| LCP                 | 2,259ms               | 116ms       |
| First Visual Change | —                     | 74ms        |
| TTI                 | 2,259ms               | 2,259ms     |

- 정적 셸은 실제 브라우저에서 **77ms에 페인트**됐다(전 GD-334 observed FCP 145ms 대비도 단축). 필름스트립도 375ms 프레임부터 스켈레톤 셸이 보인다.
- 보고 수치의 FCP·LCP·SI·TTI가 전부 2,259ms에 고정되는 패턴은 이전 측정(`20261025-gd342` r2/r3의 LCP==FCP==SI 일치)에도 있었다 — Lantern가 "첫 페인트"를 **메인 스레드가 entry JS 평가를 끝내는 시각**으로 추정하기 때문이다. modulepreload된 스크립트가 시뮬레이션에서 CSS보다 먼저 도착해 평가 태스크가 페인트 태스크보다 먼저 스케줄된다.
- 즉 보고 수치가 움직이는 조건은 "페인트가 JS를 안 기다리게 하는 것"이 아니라 **"entry 평가 태스크가 빨리 끝나거나 페인트 전까지 치명 경로 밖으로 나가는 것"**이다. 정적 셸은 실측 첫 페인트를 크게 앞당겼지만 시뮬레이션 점수에는 반영되지 않았다.

## 유지 판단

- 정적 셸·driver.js 제외 변경은 **유지**한다: 실측 첫 페인트 145→77ms 개선, 초기 JS −7.2kB(gz), 회귀 없음. Speed Insights RUM에서도 필드 FCP 개선이 누적 확인될 것으로 기대.
- 단, 프롬프트의 판정 방법(보고 수치 중앙값)으로는 목표 미달이므로 완료로 기록하지 않는다.

## 다음 선택지 (미달 근거에 따른)

1. **부트 지연(yield-before-mount) — 추천 후보**: `main.tsx`를 소형 로더로 바꾸고 앱 부팅을 별도 태스크로 미룬다(`setTimeout(() => import('./boot'))` 계열). entry의 정적 그래프가 작아지면 modulepreload 대상도 줄고, Lantern가 평가 태스크 사이/이전에 페인트를 스케줄할 가능성이 있다. 실측으로도 정적 셸 페인트와 JS 부팅이 겹치지 않는다. 리스크: 앱 인터랙티브 시점이 한 태스크+청크 요청만큼 늦어진다 — 정적 셸이 이미 보이므로 체감 악화는 작다. 검증은 Vercel preview 배포에 Lighthouse를 돌려 머지 없이 확인 가능.
2. **entry 평가 태스크 축소**: vendor에 남은 sonner·axios 지연, zod 초기 경로 제거(sideEffects 정리 필요) — 시뮬레이션 평가 시간을 직접 깎는 레버이나, −460ms 목표에는 초기 JS의 대폭 축소가 필요해 단독 도달은 어렵다. 1번과 병용.
3. **판정 기준 재정의**: 보고 수치 대신 `observed*` 지표나 Speed Insights RUM p75를 목표로 쓰는 방향 — 정책 변경이라 사용자 결정 사항.

## 증거 파일

- `reports/20261025-gd348-prod-lighthouse-login-mobile-r1.json` / `-r2.json` / `-r3.json`
- 비교 기준: `reports/20261025-gd342-prod-lighthouse-login-mobile-r1~r3.json`
- 번들 전후: `reports/20261025-gd348-bundle-diff.md` (`-before.json` / `-after.json`)
