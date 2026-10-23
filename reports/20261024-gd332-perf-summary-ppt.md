# 성능 최적화 요약 (발표용) — /login 모바일

> 슬라이드용 초안. 수치 출처는 각 줄의 근거 파일. GD-328 기준선 → GD-330 폰트/SEO → GD-332 번들 정리.

## 1. 배경 — 왜 했나

- 로그인 페이지가 모든 사용자의 첫 화면. 모바일 Lighthouse Performance 0.84(GD-328 기준선, LH 12.8.2).
- 주요 병목 2가지: 폰트 CDN CSS 왕복(760 ms 렌더블로킹)과 초기 JavaScript 과다(365 KiB gzip, 그중 75~83%가 /login에서 미사용).

## 2. GD-330 — 폰트 CDN 제거·SEO

- Pretendard CDN `@import` → woff2 92개 subset 셀프호스트로 교체해 외부 왕복 제거.
- 프로덕션 재측정(LH 13.5): 렌더블로킹 목록에서 CDN 항목 소멸, perf 0.78~0.89(측정 분산 존재).
- 근거: `reports/20261023-gd328-baseline-lighthouse-login-mobile.json` ↔ `reports/20261024-gd330-prod-lighthouse-login-mobile(-r2).json`

## 3. GD-332 — 초기 번들 정리

원인 실사 후 3가지 수술:

| 조치               | 내용                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------- |
| HomePage 지연 로딩 | `/` 화면을 기존 lazy 패턴으로 전환 — framer-motion(300+ 모듈)의 유일한 초기 경로를 차단 |
| 청크 그룹 정리     | framer-motion·react-hook-form·@tanstack/react-table을 초기 청크에서 lazy 청크로 이동    |
| 폰트 CSS 분리      | @font-face 92개(13.5 KiB gzip)를 별도 CSS로 분리해 렌더 후 비동기 로드(swap 유지)       |

## 4. 전후 비교 (같은 빌드 조건, 정적 초기 그래프 기준)

| 지표                  | 전                         | 후          | 변화               |
| --------------------- | -------------------------- | ----------- | ------------------ |
| 초기 JS (gzip)        | 365.1 KiB                  | 247.8 KiB   | **−32%**           |
| 렌더블로킹 CSS (gzip) | 39.0 KiB                   | 24.6 KiB    | **−37%**           |
| vendor 청크           | 134.9 KiB                  | 85.6 KiB    | −37%               |
| index(앱 코드) 청크   | 61.1 KiB                   | 27.7 KiB    | −55%               |
| tanstack 청크         | 20.0 KiB                   | 11.0 KiB    | −45%               |
| 초기 요청 파일 수     | 23개                       | 9개         | 절반 이하          |
| 렌더블로킹 목록       | index.css(+폰트 선언 포함) | index.css만 | 폰트 선언 비동기화 |

- 근거: `reports/20261024-gd332-bundle-before/after.json`(measureGd262Bundle — index.html 정적 그래프만 추적, gzip 크기), `reports/20261024-gd332-bundle-diff.md`, 로컬 LH `reports/20261024-gd332-local-lighthouse-login.json`(blocking 목록 비교용)
- 기능 회귀 없음: 881개 테스트·lint·빌드 통과, 프록시 스모크에서 로그인 목록·폰트 적용·콘솔 0오류 확인.

## 5. 정직한 주석 (발표 시 첨언용)

- LH의 "미사용"은 /login 기준 — 다른 화면 진입 시 해당 코드를 lazy 청크로 받는다. 코드를 지운 게 아니라 **받는 시점을 늦춘 것**이다.
- 프로덕션 Lighthouse(모바일, /login) 재측정 확정: perf 중앙값 **0.84 → 0.92**, FCP·LCP·SI 23~25% 단축, 미사용 JS 170.5 → 103.0 KiB — `reports/20261024-gd332-prod-verification.md`.
- 잔여 과제: react 청크(react-dom 내부 ~53%)는 레버 없음. msw 청크는 이미 프로덕션에서 미요청. UserLayout 지연화·미사용 dep 정리는 후속 후보.
