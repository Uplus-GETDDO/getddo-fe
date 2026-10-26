# GD-348 — /login FCP 구조 개선 번들 전후 비교

- 날짜: 2026-10-25
- 측정 방식: `scripts/measureGd262Bundle.mjs`로 index.html 정적 의존 그래프만 추적(dynamic import는 초기 비용에서 제외). `VITE_ENABLE_MSW` 미설정(=false) 로컬 빌드.
- 주의: 로컬 수치는 번들 크기 근거일 뿐이다. FCP 판정은 머지·배포 후 prod Lighthouse 3회 중앙값으로 한다(`20261025-gd348-prod-verification.md` 후속).

## 초기 로드 총량

| 지표           | 전        | 후        | Δ                |
| -------------- | --------- | --------- | ---------------- |
| 초기 JS (gzip) | 245,817 B | 238,607 B | −7,210 B (−2.9%) |
| 초기 CSS(gzip) | 26,848 B  | 25,887 B  | −961 B (−3.6%)   |

## 초기 청크별 (gzip)

| 청크       | 전       | 후       | 비고                                   |
| ---------- | -------- | -------- | -------------------------------------- |
| vendor     | 95,260 B | 88,060 B | driver.js를 HomePage lazy 청크로 이동  |
| index      | 13,488 B | 13,478 B | 불변                                   |
| react      | 67,614 B | 67,614 B | 불변                                   |
| router     | 31,658 B | 31,658 B | 불변                                   |
| zod        | 25,647 B | 25,647 B | 불변 — 제외 사유는 아래 "보류한 항목"  |
| tanstack   | 11,308 B | 11,308 B | 불변                                   |
| env        | 842 B    | 842 B    | 불변                                   |
| index CSS  | 25,874 B | 25,887 B | driver.css 이동분이 상쇄돼 사실상 불변 |
| vendor CSS | 974 B    | 0 B      | driver.js 스타일이 lazy 청크로 이동    |

## 구조 변경 요약

1. `index.html` — `<div id="root">` 안에 로그인 셸(제목+부제+사용자 행 5개 스켈레톤)을 정적으로 삽입.
   React 마운트가 #root를 교체하기 전까지 브라우저가 HTML+CSS만으로 첫 페인트를 그린다 — FCP가
   entry JS 다운로드·실행을 기다리지 않는다 (프롬프트 후보 1 "프리렌더"의 무의존성 구현).
    - 행 상자(p-5)·텍스트 라인 높이(text-subhead 1.625rem, text-body-sm 1.375rem)를 LoginPage 첫
      렌더와 동일하게 맞춰 교체 시점 CLS=0을 노린다. 가상 사용자 수(5명)는 `.env.production.local` 기준.
    - 행이 `aria-hidden`인 이유: 스켈레톤은 장식이고 실제 목록이 곧 대체한다.
    - 미인증 진입은 UserGuard·AdminGuard가 전부 /login으로 보내므로 공용 index.html 하나로 충분.
    - 스플래시는 prod 가상 사용자 수에 묶인다 — 인원이 바뀌면 행 수를 맞춰야 CLS가 유지된다.
2. `vite.config.ts` — vendor 제외 목록에 `driver\.js` 추가. 온보딩 투어(`features/onboardingTour`)는
   HomePage lazy 전용인데 vendor 그룹에 흡수돼 /login 초기 로드에 끼어 있었다.
   HomePage 청크가 39.9→66.2kB(raw)로 커진 것은 driver.js가 정당하게 이동한 결과다.

## 보류한 항목 (근거)

- **zod 초기 경로 제거 (후보 2)**: `entities/user/index.ts` 배럴이 zod 스키마가 정의된
  `model/types.ts`를 재수출해, `getVirtualUsers`를 수동 검증으로 바꿔도 `sideEffects:false` 선언
  없이는 zod가 초기 그래프에 남는다. `sideEffects:false`는 `import './config/sessionSync'`와
  CSS 임포트 같은 사이드이펙트 의존을 흔들 위험이 있어 효과(25.6kB) 대비 리스크가 크다.
  스플래시가 FCP를 JS에서 분리해 이 항목의 FCP 기여분은 사라졌다 — LCP·TTI 개선 목적의 후속 후보로만 남긴다.
- **axios·sonner 지연**: sessionSync의 apiClient 인터셉터 등록과 Toaster를 지연하면 초기 JS가 더 줄지만,
  인터셉터 미등록 창에 쿼리가 나가는 경합·마운트 전 토스트 유실 위험이 있다. 스플래시가 목표를
  달성하면 불필요 — prod 판정 후 미달 시 다음 레버로 검토.
- **프리렌더 플러그인(vite-prerender·react-snap·vite-ssg)**: 신규 dependency + 빌드 체인 변경이
  필요하고, 가상 사용자 목록은 빌드 시점에 확정되지 않아(VITE_VIRTUAL_USERS_JSON은 배포 env) 어차피
  셸까지만 출력 가능 — 정적 스플래시와 출력물이 같으면서 도구 비용만 크다.

## 검증

- `format:check` 통과, `lint` 경고 0, `test:ci` 143파일/916건 통과, `build` 통과.
- `perf:budget` 통과 — initialJsGzip 238,607 B (버짓 262,144 B).
- 로컬 preview 스모크: `/login` 200, 정적 셸 마크업 서빙 확인(animate-pulse 5행 + 부제 텍스트).

## 증거 파일

- `reports/20261025-gd348-bundle-before.json` / `-after.json` — measureGd262Bundle 산출물
- 프로덕션 판정(후속): `reports/20261025-gd348-prod-verification.md` — FCP 목표 ≤1.8s, 가드레일 LCP ≤2.5s·CLS 0
