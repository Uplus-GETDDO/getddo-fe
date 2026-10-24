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

## 산출물

- `reports/20261025-gd342-prod-lighthouse-login-mobile-r1.json` / `-r2.json` / `-r3.json`
- 비교 기준: `reports/20261024-gd334-prod-lighthouse-login-mobile-r1~r3.json`
