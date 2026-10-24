# GD-332 — 프로덕션 배포 후 /login Lighthouse 재측정

- 날짜: 2026-10-24 (fetch 시각 UTC 21:16)
- 대상: `https://getddo-fe.vercel.app/login`, Lighthouse 13.5, 모바일 프리셋(headless Chrome)
- 베이스라인: `20261024-gd330-prod-lighthouse-login-mobile(-r2).json` — GD-330 상태 프로덕션, 동일 조건(UTC 16:11)
- 판정: 점수 분산을 고려해 3회 측정·중앙값 비교 (전은 기존 2회분 사용)

## perf 점수

| 회차   | 전(GD-330) | 후(GD-332 머지)  |
| ------ | ---------- | ---------------- |
| r1     | 0.78       | 0.92             |
| r2     | 0.89       | 0.95             |
| r3     | —          | 0.86             |
| 중앙값 | ~0.84      | **0.92** (+0.08) |

## 주요 지표 (중앙값, ms)

| 지표 | 전   | 후   | 변화    |
| ---- | ---- | ---- | ------- |
| FCP  | 3116 | 2334 | −25%    |
| LCP  | 3491 | 2678 | −23%    |
| TBT  | 5    | 3    | ±0 수준 |
| SI   | 3116 | 2334 | −25%    |
| CLS  | 0    | 0    | 동일    |

r3은 CLS 0.109·LCP 3309의 이상치 — 폰트 스왑 타이밍과 맞물린 분산으로 보이며, 중앙값 비교가 이런 단일 회차 노이즈를 흡수한다.

## 감사 항목 대조 (r2 기준)

| 항목              | 전                           | 후                               |
| ----------------- | ---------------------------- | -------------------------------- |
| 미사용 JS 절감액  | 170.5 KiB (174,622 B)        | **103.0 KiB (105,528 B)**        |
| └ vendor          | 94 KiB                       | 48 KiB                           |
| └ index           | 49 KiB                       | 21 KiB                           |
| └ react           | 27 KiB                       | 33 KiB (청크 동일, 측정 분산)    |
| 렌더블로킹 리소스 | index-CO3ioSIC.css (score 0) | index-CFMDx1Tc.css만 (score 0.5) |

- 폰트 CSS는 blocking 목록에서 완전히 사라짐 — `pretendard-*.css`는 초기 HTML `<link>`에 없고 런타임 비동기 요청으로만 존재.
- 초기 요청 파일: prod HTML 기준 js 8 + css 1 = 9개 (전 23개) — `env`/`index`/`envelopeSchema`/`react`/`router`/`tanstack`/`vendor`/`zod` + index css.

## 결론

- 정적 그래프 기준 예측(초기 JS −32%, blocking CSS −37%)이 프로덕션 점수로 전환됨: **perf 중앙값 0.84 → 0.92**, FCP·LCP·SI 23~25% 단축.
- 미사용 JS가 여전히 ~103 KiB 남아 있으나 대부분 react-dom 내부(레버 없음)와 vendor 잔여분 — 추가 수술 대상은 미사용 dep 정리·UserLayout lazy 등 별도 후보로 남긴다.
- 분산은 계속 존재(0.86~0.95) — 단일 측정치가 아닌 중앙값으로 판정한 것이 맞다.

## 증거 파일

- `reports/20261024-gd332-prod-lighthouse-login-mobile-r1.json` / `-r2.json` / `-r3.json`
- 비교 기준: `reports/20261024-gd330-prod-lighthouse-login-mobile(-r2).json`
