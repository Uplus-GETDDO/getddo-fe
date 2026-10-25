## 후속 — 부트 지연 (#183, GD-348b)

정적 셸이 시뮬레이션 FCP를 움직이지 못한 근거(Lantern가 첫 페인트를 entry 평가 종료로 추정)에 따라 `main.tsx`를 소형 로더로 축소하고 앱 부팅을 `setTimeout(() => import('./bootstrap'))`으로 다음 태스크로 미뤘다. `__vitePreload` 헬퍼가 router 청크에 있어 entry가 react·router를 정적 import하던 문제는 `preload-helper` 전용 그룹으로 해소 — 초기 JS 238,607 → 1,766B(gz).

- 배포 반영 확인: prod HTML의 `preload-helper` modulepreload 링크 grep.

| 지표 | GD-348a 중앙값 | GD-348b (r1 1,899 / r2 1,060 / r3 1,060) | 판정                              |
| ---- | -------------- | ---------------------------------------- | --------------------------------- |
| FCP  | 2,259          | **1,060** (−53%)                         | **목표 ≤1.8s 달성**               |
| LCP  | 2,259          | **2,710** (+451)                         | 가드레일 2.5s **초과**            |
| TBT  | 0              | 13                                       | 미세 증가                         |
| CLS  | 0              | 0                                        | 유지                              |
| TTI  | 2,259          | ~3,081                                   | 지연 (부팅이 첫 페인트 뒤로 이동) |

- r1은 cold-cache 변동(1,899) — 중앙값 흡수. observed FCP는 r2/r3에서 67~99ms로 셸이 즉시 그려짐을 재확인.
- **트레이드오프**: 부팅 청크의 fetch·평가·실제 목록 렌더가 첫 페인트 이후로 밀려 LCP가 2.5s 가드레일을 +210ms 초과. 프롬프트 지시에 따라 사용자에게 방향을 확인한다.
- LCP 회복 후보(기록): 빌드 타임에 부팅 그래프의 modulepreload 링크를 index.html에 주입(소형 Vite 플러그인, dep 목록은 entry의 `__vite__mapDeps`에 이미 존재) — 평가는 지연 유지한 채 fetch만 첫 페인트 창에 미리 끝내는 방식. 되돌리기는 `git revert 1349ad9`.

## 후속 — modulepreload 주입 시도와 기각 (#184 → revert, GD-348c)

후보 ①을 `preloadBootGraph` 플러그인으로 구현해 prod 판정했다 — **가설 기각, 리버트 결정**.

- 구현: `transformIndexHtml`에서 bootstrap 동적 entry 청크+정적 의존 그래프를 찾아 `<link rel="modulepreload">` 주입. 전체 주입은 로컬 sim에서 FCP +1.4s로 붕괴해 vendor·react(157KB gz)만 제외한 선행 84.7KB(gz) 변형으로 배포.
- prod 판정 (모바일 sim ×3, 본 디렉터리 `20261025-gd348c-prod-lighthouse-login-mobile-r*.json`):

| 지표 | GD-348b 중앙값 | GD-348c 중앙값 | 판정                       |
| ---- | -------------- | -------------- | -------------------------- |
| FCP  | 1,060          | **1,509**      | 목표 내지만 **+449 회귀**  |
| LCP  | 2,710          | **2,708**      | **무효(−2ms)** — 회복 실패 |
| TBT  | 13             | 12             | 동일                       |
| CLS  | 0              | 0              | 유지                       |

- **기각 근거**: LCP는 부팅 그래프의 fetch 시점이 아니라 post-paint 평가·렌더에 묶여 있다 — 84.7KB를 앞당겨도 LCP가 0ms 움직이지 않았다. prod는 gzip이라 fetch 비중이 로컬(무압축, LCP −457)보다 훨씬 작다. 전체 preload는 FCP를 깨고, 부분 preload는 LCP를 못 움직인다 — fetch 시점 레버로는 두 목표를 동시에 만족할 수 없다.
- **다음 레버(기록)**: LCP를 깎으려면 로그인 초기 경로의 **평가 바이트 축소**가 필요 — 부팅 그래프에서 tanstack·zod·router 같은 무거운 dep를 첫 렌더 경로 밖으로 빼는 방향. 별도 티켓급 작업.
- 동일 실험 재시도 금지 — 측정 이득 없는 변경이라 `git revert d274e39`로 원복한다 (#184 → revert PR).
