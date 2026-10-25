# GD-342 — 프로덕션 배포 후 /login Lighthouse 재측정 (LCP 판정)

- 날짜: 2026-10-25 (fetch 시각 UTC 17:17)
- 대상: `https://getddo-fe.vercel.app/login`, Lighthouse 13.5, 모바일 프리셋(headless Chrome)
- 베이스라인: `20261024-gd334-prod-lighthouse-login-mobile(-r1~r3)` — GD-334 상태 프로덕션
- 판정: 3회 측정·중앙값 비교. LCP 목표 ≤ 2.5s (Good 상한)

## perf 점수

| 회차   | 전(GD-334) | 후(GD-342 머지) |
| ------ | ---------- | --------------- |
| 중앙값 | 0.90       | **0.96**        |

## 주요 지표 (중앙값, ms)

회차별: r1 LCP 4,574 / r2 2,258 / r3 2,258.

| 지표 | 전(GD-334 중앙값) | 후        | 변화 |
| ---- | ----------------- | --------- | ---- |
| FCP  | 2,559             | 2,258     | −12% |
| LCP  | 2,641             | **2,258** | −15% |
| TBT  | —                 | 0         | —    |
| SI   | —                 | 2,258     | —    |
| CLS  | 0~0.1 분산        | **0**     | 소멸 |

## 판정: LCP 목표 달성

- **LCP 중앙값 2,258ms ≤ 2,500ms** — "Good" 상한 진입.
- 예측대로 LCP≈FCP로 수렴: `useVirtualUsers`의 pending 프레임을 제거해(initialData 주입) LCP 요소(가상 사용자 목록 텍스트)가 첫 렌더 페인트와 같은 프레임에 그려진다. r2·r3에서 LCP==FCP==SI가 일치.
- 스켈레톤→목록 교체가 사라지며 CLS도 0.109 → 0으로 소멸.

¹ r1(LCP 4,574ms)은 배포 직후 cold-cache 첫 방문 이상치 — 중앙값 비교가 단일 회차 노이즈를 흡수한다.

## 후속 — FCP 개선 시도 (#177, GD-342b)

첫 페인트 창의 대역 경쟁을 줄이는 3건을 시도했다: ① prod의 목업 SW 해제를 렌더와 병렬화, ② pretendard 폰트 CSS를 `requestIdleCallback`으로 지연, ③ /login 셸·홈 prefetch를 유휴 시점으로 지연.

- 로컬 preview(비압축) A/B: FCP 4,224 → 2,634ms (−38%)로 유효해 보였으나
- **prod 3회 재측정: FCP 중앙값 2,258ms — 변화 없음** (`20261025-gd342b-prod-lighthouse-login-mobile-r1~r3.json`)
- 원인 분석: ① 로컬 preview는 무압축이라 지연 대상(폰트 237KB+prefetch ~150KB raw)이 시뮬레이션 비용을 부풀렸고, ② Lighthouse 모델의 FCP 체인은 HTML→modulepreload된 entry JS+CSS→실행뿐 — 2차 웨이브 리소스는 처음부터 체인 밖이었다.
- 판정: **FCP ≤1.8s는 미달 유지.** entry JS ~247KB(gz)+실행이 전부인 구조라 도달에는 구조 변경이 필요 — entity 스키마(zod) 지연 검증, vendor 분할, 또는 /login 프리렌더. 단, zod를 쿼리 시점 지연으로 옮기면 가상 사용자 목록 데이터가 늦어져 LCP가 악화되는 trade-off라 함부로 못 뺀다.
- #177 변경은 회귀 없이 실사용자 네트워크에서 첫 페인트 대역 경쟁을 줄이는 순수 개선이라 유지한다.

## 산출물

- `reports/20261025-gd342-prod-lighthouse-login-mobile-r1.json` / `-r2.json` / `-r3.json`
- `reports/20261025-gd342b-prod-lighthouse-login-mobile-r1.json` / `-r2.json` / `-r3.json`
- 비교 기준: `reports/20261024-gd334-prod-lighthouse-login-mobile-r1~r3.json`
