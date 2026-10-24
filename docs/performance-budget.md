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

프로덕션 Lighthouse 모바일 `/login` 기준(GD-334 배포 후 실측, `reports/20261024-gd334-prod-verification.md`):

| 지표 | 현행 중앙값 | 목표   |
| ---- | ----------- | ------ |
| FCP  | 2,559 ms    | ≤ 1.8s |
| LCP  | 2,641 ms    | ≤ 2.5s |
| CLS  | 0~0.1 분산  | ≤ 0.1  |

- LCP 중앙값이 "Good" 상한(2.5s)을 이미 넘는다 — 이 버짓으로는 더 나빠지는 것만 감지하고, LCP 자체 개선은 별도 후속이다.
- 필드 지표는 측정 분산이 커서 게이트로 쓰지 않는다. 프로덕션 배포 후 Lighthouse 3회 중앙값 비교(GD-332·GD-334와 동일 방식)로 추적한다.

## 운영

- 로컬: `npm run build && npm run perf:budget` — 위반 시 초과 항목·실측·한도를 stderr에 출력하고 exit 1.
- CI: `ci.yml`에서 `npm run build` 직후 `npm run perf:budget`이 실행되며, 초과 시 PR이 실패한다.
- 상세 내역이 필요하면 `node scripts/measureGd262Bundle.mjs <out.json> dist`로 파일별 initial 플래그·raw/gzip/brotli를 얻는다.

### 버짓 변경 규칙

- 버짓 상향이 필요한 PR은 본문에 **신규 실측 근거**(어떤 코드가 얼마만큼 키웠는지)를 적고 이 문서의 기준선 표를 함께 갱신한다. 임계값만 올리는 diff는 리뷰에서 반려한다.
- 측정 방식(정적 그래프 추적·gzip)을 바꾸는 변경은 버짓 수치 재산정을 동반해야 한다.

## RUM(실사용자 측정) 판단 — 보류

web-vitals 기반 RUM은 이번 범위에서 도입하지 않는다. 판단 근거:

1. **수집 백엔드가 없다.** 지표를 전송할 엔드포인트·저장소·대시보드가 없어, 측정 코드만 넣으면 데이터가 남지 않는다. dev 콘솔 로깅만으로는 실사용자 회귀를 볼 수 없다.
2. **dependency 승인 게이트.** `web-vitals`(~4 KB)나 `@vercel/speed-insights` 추가는 명세상 신규 dependency 승인 대상이다.
3. **현재 관측 체계로 감지 가능하다.** CI가 초기 번들 총량을 게이트하고, 배포 후 Lighthouse 재측정 절차(GD-332·GD-334에서 검증된 프로세스)가 prod FCP/LCP를 추적한다 — 둘 사이의 공백은 "배포 간 추세"인데, 이벤트성 서비스라 트래픽이 집중되는 짧은 기간에 실시간 알림이 필요한 수준은 아니다.

전제가 갖춰지면(수집 엔드포인트 또는 Vercel Speed Insights 활성화 승인) 최소 구현은 `main.tsx`에서 `onLCP/onINP/onCLS/onFCP`를 `navigator.sendBeacon`으로 보내는 수준이다 — Vercel 배포 환경상 `@vercel/speed-insights`가 가장 저비용 경로다.
