# GD-332 — /login 초기 로드 최적화 전후 비교

- 날짜: 2026-10-24
- 측정 방식: `scripts/measureGd262Bundle.mjs`로 index.html 정적 의존 그래프만 추적(dynamic import는 초기 비용에서 제외). 빌드는 배포 env 추출값(`VITE_ENABLE_MSW=false` + 배포본 `env-*.js`의 `VITE_VIRTUAL_USERS_JSON`)으로 수행.
- 주의: 로컬 LH 절대값은 프록시 환경이라 무의미 — 렌더블로킹 항목 목록 비교에만 사용. 프로덕션 점수 비교는 머지·배포 후속이다.

## 초기 로드 총량

| 지표                  | 전         | 후             | Δ                 |
| --------------------- | ---------- | -------------- | ----------------- |
| 초기 JS (gzip)        | 365.1 KiB  | 247.8 KiB      | −117.3 KiB (−32%) |
| 초기 JS (raw)         | 1129.9 KiB | 787.5 KiB      | −342.4 KiB        |
| 렌더블로킹 CSS (gzip) | 39.0 KiB   | 24.6 KiB       | −14.4 KiB (−37%)  |
| 초기 요청 파일 수     | 23개       | 8개 JS + 1 CSS | 절반 이하         |

## 초기 청크별 (gzip)

| 청크                 | 전                     | 후             | 비고                                             |
| -------------------- | ---------------------- | -------------- | ------------------------------------------------ |
| vendor               | 134.9 KiB              | 85.6 KiB       | framer-motion·react-hook-form 계열을 lazy로 이동 |
| index                | 61.1 KiB               | 27.7 KiB       | HomePage·widgets를 lazy로 이동                   |
| tanstack             | 20.0 KiB               | 11.0 KiB       | react-table(table-core)을 관리자 lazy로 분리     |
| react / router / zod | 66.0 / 30.9 / 25.0 KiB | 동일           | 불변                                             |
| 기타 소형 청크 10개  | ~9.5 KiB               | —              | eager 그래프 이탈로 index에 흡수 또는 lazy화     |
| index CSS            | 39.0 KiB               | 24.6 KiB       | @font-face 92개 분리                             |
| pretendard CSS       | (index에 포함)         | 13.5 KiB async | 렌더 후 비동기 로드, 비-렌더블로킹               |

## 렌더블로킹 목록 (로컬 프록시 LH 13.5)

- 전(프로덕션): `index-*.css` 38.8 KiB (300 ms 추정) — @font-face 92개 포함
- 후(로컬): `index-BcwG7BUM.css`만 — `pretendard-NPFyShNs.css`는 네트워크 요청에는 보이지만 blocking 목록에 없음
- index CSS에서 `@font-face` 0건 / pretendard CSS에 92건 확인

## 구성 변경 요약

1. `userRoutes.tsx` — HomePage를 `lazyPage` 패턴으로 전환(eager 그래프에서 framer-motion 유일 경로 차단).
2. `vite.config.ts` — vendor 제외 목록에 `framer-motion|motion-dom|motion-utils|react-hook-form|@hookform` 추가, tanstack 그룹에서 `react-table|table-core|react-store|store` 분리.
3. `globals.css`에서 `@import './pretendard.css'` 제거 → `main.tsx`가 렌더와 무관하게 `import('./styles/pretendard.css')`로 비동기 로드(`font-display: swap` 유지, FOUT 허용).

## 소명된 비조치

- msw-*.js 420 KiB 청크: 프로덕션 네트워크 목록에 없음(dynamic import·`enableMsw:false`). 조치 불필요.
- react 청크 미사용 53%: react-dom 내부 구조, 현실적 레버 없음.
- 미사용 dep(gsap·canvas-confetti·react-day-picker·@fontsource-variable/geist): 번들 미포함 — 별도 chore 후보.

## 검증

- `format:check`·`lint`(max-warnings 0)·`test:ci`(135파일/881건)·`build`(tsc -b && vite build) 전부 통과.
- 프록시 스모크: `/login` 200, 가상 사용자 버튼 5개 렌더, pretendard CSS 비동기 fetch + woff2 9개 지연 로드, `body fontFamily` Pretendard 적용, 콘솔 오류 0.

## 증거 파일

- `reports/20261024-gd332-bundle-before.json` / `-after.json` — measureGd262Bundle 산출물(파일별 initial 플래그·raw/gzip/brotli)
- `reports/20261024-gd332-local-lighthouse-login.json` — 로컬 프록시 LH 13.5(render-blocking 목록용)
- 프로덕션 비교 대상: `reports/20261024-gd330-prod-lighthouse-login-mobile(-r2).json` (unused-js 171~179 KiB, blocking css 38.8 KiB)
