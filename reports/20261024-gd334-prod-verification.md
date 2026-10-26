# GD-334 — 프로덕션 배포 후 /login Lighthouse 재측정

- 날짜: 2026-10-24
- 대상: `https://getddo-fe.vercel.app/login`, Lighthouse 13.5, 모바일(headless Chrome), performance 카테고리만
- 베이스라인: `20261024-gd332-prod-verification.md` — GD-332 머지 직후 프로덕션, 동일 조건
- 배포 확인: prod HTML의 index 청크가 `_07R25oe`(gzip 12,280 B ≈ GD-334 실측 12.1 KiB) — GD-332 시절 `M54-Wbwg`(27.7 KiB)와 달라 GD-334 반영 확인 (prod는 dev 브랜치 추적, main은 미반영 상태)
- 판정: 3회 측정·중앙값 비교

## perf 점수

| 회차   | 전(GD-332) | 후(GD-334 배포)  |
| ------ | ---------- | ---------------- |
| r1     | 0.92       | 0.93             |
| r2     | 0.95       | 0.91             |
| r3     | 0.86       | 0.93             |
| 중앙값 | 0.92       | **0.93** (+0.01) |

## 주요 지표 (중앙값, ms)

| 지표 | 전   | 후   | 변화          |
| ---- | ---- | ---- | ------------- |
| FCP  | 2334 | 2559 | +9% (분산 내) |
| LCP  | 2678 | 2641 | ±0 수준       |
| TBT  | 3    | 1    | ±0 수준       |
| SI   | 2334 | 2559 | +9% (분산 내) |
| CLS  | 0    | 0    | 동일          |

r2는 CLS 0.109의 이상치 — 전 회차(r3, CLS 0.109)와 같은 폰트 스왑 분산 패턴. 중앙값 비교가 흡수한다.

## 감사 항목 대조 (r1 기준)

| 항목              | 전(GD-332 r2)                  | 후(GD-334 r1)                      |
| ----------------- | ------------------------------ | ---------------------------------- |
| 미사용 JS 절감액  | 103.0 KiB (105,528 B)          | **73.1 KiB** (49,374 + 25,538 B)   |
| └ vendor          | 48 KiB                         | 49.4 KiB (해시 동일, 측정 분산)    |
| └ index           | 21 KiB                         | 목록에서 제거됨 — 셸 분리 효과     |
| └ react           | 33 KiB                         | 25.5 KiB (청크 동일, 측정 분산)    |
| 렌더블로킹 리소스 | index-CFMDx1Tc.css (score 0.5) | index-CFMDx1Tc.css (score 0, 동일) |

- 미사용 JS 항목에서 index 청크가 빠짐 — UserLayout 등 사용자 셸 ~16 KiB가 /login 초기 그래프에서 분리된 것이 prod 감사로 확인.
- vendor·react 청크의 wastedBytes는 실행 타이밍 분산에 민감 — 해시는 전과 동일(CMh3bwyp, BXQkwMDF).

## 결론

- perf 중앙값 **0.92 → 0.93** — 통계적으로 유의한 개선은 아니지만 회귀도 없음. 번들 −16 KiB는 /login 점수보다 로그인 후 첫 사용자 화면 진입 비용을 줄이는 방향으로 작용(셸이 지연 청크로 이동).
- 정적 그래프 예측(초기 JS −16.0 KiB)이 prod에서도 확인: index 청크가 미사용 JS 목록에서 소거, 초기 index 크기 27.7 → 12.1 KiB.
- 추가 레버 후보는 없음 — 남은 미사용 JS는 vendor·react-dom 내부 영역.

## 증거 파일

- `reports/20261024-gd334-prod-lighthouse-login-mobile-r1.json` / `-r2.json` / `-r3.json`
- 비교 기준: `reports/20261024-gd332-prod-verification.md`, `reports/20261024-gd332-bundle-after.json`
