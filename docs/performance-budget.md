# 첫 화면 성능 버짓 (GD-340)

> 초기 로드 회귀를 CI에서 감지하기 위한 버짓 정의·근거·운영 절차.
> 임계값의 원천은 `perf-budget.json`, 검사 스크립트는 `scripts/checkBundleBudget.mjs`.

## 측정 대상 — "초기 로드"의 정의

- `dist/index.html`이 `src`/`href`로 참조하는 JS·CSS 루트에서 정적 `import`/`export` 그래프만 추적한다. `import()` 동적 청크(페이지 lazy, msw 등)는 초기 비용에서 제외한다 — GD-332에서 확정한 `measureGd262Bundle.mjs` 방식과 동일하며, 같은 로직을 `scripts/lib/bundleGraph.mjs`로 공유한다.
- 크기는 **gzip 바이트**로 잰다. 프로덕션(Vercel)은 brotli를 서빙하므로 gzip 기준은 다소 보수적이다. 빌드 환경과 무관하게 로컬·CI에서 동일하게 재현되는 단위라 CI 게이트에 적합하다.
- Lighthouse 계열 실측 지표(FCP/LCP)는 빌드 산출물이 아니라 네트워크·기기에 의존해 CI 게이트로 쓸 수 없다 — 아래 "관측 목표"로만 관리한다.

## 버짓

| 지표               | 기준선 (2026-10-24 실측) | 버짓                | 헤드룸 |
| ------------------ | ------------------------ | ------------------- | ------ |
| 초기 JS gzip 합계  | 237,816 B (232.2 KiB)    | 262,144 B (256 KiB) | ~10%   |
| 초기 CSS gzip 합계 | 25,178 B (24.6 KiB)      | 30,720 B (30 KiB)   | ~22%   |

근거:

- 기준선은 `npm run build` 후 `node scripts/measureGd262Bundle.mjs <out> dist` 실측값 — `reports/20261024-gd340-baseline-bundle.json`.
- 초기 JS: GD-332에서 365→248 KiB로 줄였고 GD-334에서 사용자 셸이 분리돼 232 KiB까지 내려왔다 — 256 KiB는 정상적인 기능 추가분(의존성 증가·신규 슬라이스)을 흡수하면서도 10%를 넘는 회귀는 차단하는 값이다.
- 초기 CSS: GD-332에서 @font-face 92개를 비동기 분리해 24.6 KiB로 떨어졌다. Tailwind 유틸 증가분은 천천히 자라므로 30 KiB면 충분하다.
- 파일 수·개별 청크 버짓은 두지 않는다 — 청크 분할은 `vite.config.ts`의 codeSplitting 정책이 소유하고, 총량 버짓이 회귀 감지로 충분하다.

## 관측 목표 (필드, 게이트 아님)

프로덕션 Lighthouse 모바일 `/login` 기준(GD-342 배포 후 실측, `reports/20261025-gd342-prod-verification.md`):

| 지표 | 현행 중앙값 | 목표   |
| ---- | ----------- | ------ |
| FCP  | 2,259 ms    | ≤ 1.8s |
| LCP  | 2,259 ms    | ≤ 2.5s |
| CLS  | 0           | ≤ 0.1  |

- LCP 중앙값이 "Good" 상한(2.5s) 안에 들어왔다(GD-342에서 달성, 이전 2,641ms) — FCP 목표(≤1.8s)는 미달이다. GD-342의 첫 페인트 대역 경쟁 제거(#177)는 prod 중앙값을 움직이지 못했다 — FCP 체인은 entry JS ~247KB(gz)+실행이라 도달에는 zod 지연 검증·vendor 분할·프리렌더 같은 구조 변경이 필요하다 (`reports/20261025-gd342-prod-verification.md` 후속 절 참조).
- GD-348(#181)에서 정적 로그인 셸을 심었으나 보고 수치(시뮬레이션)는 2,259ms로 변화 없음 — 실측 트레이스(observed)의 첫 페인트는 145→77ms로 단축됐다. Lantern가 첫 페인트를 entry JS 평가 종료 시점으로 추정하는 구조라, 보고 수치를 움직이려면 부트 지연(yield-before-mount)이나 entry 평가 태스크 축소가 필요하다 (`reports/20261025-gd348-prod-verification.md` 참조).
- 필드 지표는 측정 분산이 커서 게이트로 쓰지 않는다. 프로덕션 배포 후 Lighthouse 3회 중앙값 비교(GD-332·GD-334와 동일 방식)로 추적한다.

## 운영

- 로컬: `npm run build && npm run perf:budget` — 위반 시 초과 항목·실측·한도를 stderr에 출력하고 exit 1.
- CI: `ci.yml`에서 `npm run build` 직후 `npm run perf:budget`이 실행되며, 초과 시 PR이 실패한다.
- 상세 내역이 필요하면 `node scripts/measureGd262Bundle.mjs <out.json> dist`로 파일별 initial 플래그·raw/gzip/brotli를 얻는다.

### 버짓 변경 규칙

- 버짓 상향이 필요한 PR은 본문에 **신규 실측 근거**(어떤 코드가 얼마만큼 키웠는지)를 적고 이 문서의 기준선 표를 함께 갱신한다. 임계값만 올리는 diff는 리뷰에서 반려한다.
- 측정 방식(정적 그래프 추적·gzip)을 바꾸는 변경은 버짓 수치 재산정을 동반해야 한다.

## RUM(실사용자 측정) — 도입 (2026-10-25, GD-342)

Vercel Speed Insights를 도입했다. 보류 판단의 전제(수집 백엔드 부재)는 `@vercel/speed-insights`로 해소됐다 — Vercel이 수집 엔드포인트·저장·대시보드를 제공하므로 자체 백엔드가 필요 없다.

- **구현**: `src/app/main.tsx`의 `<StrictMode>` 안에 `<SpeedInsights />`를 마운트했다. 초기 번들에 포함되며 수 KB 증가분은 `perf:budget`으로 계속 게이트한다.
- **활성화**: Vercel 대시보드 → 프로젝트 → Speed Insights 탭에서 활성화해야 데이터가 쌓인다(배포 후 1회 수동). 활성화 전에는 전송 요청만 나가고 데이터는 저장되지 않는다.
- **수집 지표**: FCP·LCP·INP·CLS 등 Web Vitals가 p75 기준으로 대시보드에 누적된다. CI 번들 게이트(빌드 산출물)와 Lighthouse 재측정(배포 간 추세) 사이의 "필드 회귀" 공백을 메운다.
- **비용 전제**: Hobby 플랜은 무료 한도가 있다 — 트래픽 증가 시 과금 여부를 Vercel 플랜 정책으로 재확인한다.
