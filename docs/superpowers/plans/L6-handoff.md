# L6 인계 — 런타임 목업 종료·통합 인수·시연 준비 (GD-260)

> 인계일: 2026-10-21. 상태 구분: 구현 완료 ✅ / 통합 인수 부분 ⏳ / 머지·배포·배포 후 검증 미실시 ❌.

## 기준

- 브랜치 `feat/GD-260`(base dev `92583c3` = GD-259 PR #110 MERGED), 커밋 `a7855c1`(구현) + `2cd6d18`(이 문서). 원격 미발행 — push·PR·머지는 사용자 지시 대기다.
- 승인된 결정: 시연 계정은 `VITE_VIRTUAL_USERS_JSON` 직접 읽기 + 모든 모드 fallback 없음 · 배포 MSW 종료 + `mockServiceWorker.js` 자동 해제 · 가상 시계 배포 비노출 · 로그아웃 UI 없이 사용자 전환으로 대체.
- 계획: [L6 계획](2026-10-21-GD-260-L6-runtime-mock-retirement.md). 보고서: [reports/20261021-GD-260-L6.md](../../../reports/20261021-GD-260-L6.md). 운영 절차: [docs/demo-operations.md](../../demo-operations.md).

## 무엇이 바뀌었나

| 변경                                                            | 파일                                                                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 계정 설정 파서·오류 타입(신규)                                  | `entities/user/model/virtualUsers.ts` (+test)                                                             |
| `useVirtualUsers` HTTP→설정 읽기, `VIRTUAL_USERS_API_PATH` 제거 | `entities/user/api/queries.ts`, `index.ts`                                                                |
| 설정 오류 안내 문구                                             | `pages/login`, `features/switchVirtualUser`, `pages/admin/virtualUsers`                                   |
| MSW 미시작 시 Worker 해제(신규)                                 | `app/config/serviceWorkerCleanup.ts` (+test), `app/main.tsx`                                              |
| `hybridHandlers` 제거, 로컬 전용 `handlers`                     | `mocks/browser.ts`, `mocks/handlers/index.ts`                                                             |
| 배포 MSW off                                                    | `vercel.json` (`VITE_ENABLE_MSW=false`)                                                                   |
| 계정 JSON 필수화 문서                                           | `.env.example`                                                                                            |
| 가상 시계 배포 비노출                                           | `VirtualClockProvider`, `UserLayout`/`AdminLayout`, `adminRoutes`, `adminNavItems`, `VirtualClockControl` |
| 문서 현행화                                                     | README·CONTRIBUTING·CONTEXT·연동현황·ADR-0002·로드맵 L6                                                   |

주의: `useVirtualUsers`는 여전히 TanStack Query(`['virtual-users']`, `retry: false`, `staleTime: Infinity`)다 — 쿼리 무효화·에러 처리 경로는 그대로다. `/admin/abuse-cases`는 실서버 404를 표시한다(AR01/AR02 미확정, 숨기지 않음). 로그아웃은 `localStorage`의 `getddo-session` 삭제 후 새로고침 절차로 문서화했다.

## 검증 증거

- 로컬: format:check / lint / test:ci 758 / build / diff --check 전부 통과 (2026-10-21)
- 브라우저: `scripts/verifyL6Browser.py` → [L6-browser-evidence.json](L6-browser-evidence.json), [스크린샷](L6-evidence/). **실제 등록 6계정**(USER 5·ADMIN 1, 사용자 제공)으로 실행해 155건 전부 실서버 200·실제 UUID를 확인했다
- 확인된 항목: `/virtual-users` 미호출, Worker 자동 해제(등록→재진입 0건), A→B 전환 헤더 격리·누수 0, 새로고침 세션 유지, 가상 시계 비노출, 320/390px, 미설정 안내, 관리자 계정의 admin API 200
- 주의: 200% 확대는 `body.zoom` 근사 측정에서 넘침 — 실제 브라우저 확대와 동작이 달라 정밀 재측정 필요(320px 실제 뷰포트는 정상)

## 배포 후보와 실행안 (승인 대기)

배포 후보: `feat/GD-260`(`a7855c1`+`2cd6d18`) → dev 머지 → Vercel 배포.

1. Vercel 환경변수 `VITE_VIRTUAL_USERS_JSON`에 **실제 등록 계정 JSON** 설정(USER 여럿·ADMIN·INACTIVE, `id`는 DB UUID) — 사용자 제공 필요
2. `feat/GD-260` push → PR → CI 통과 → dev 스쿼시 머지
3. Vercel 배포 → 즉시 확인: 로그인 계정 목록, Service Worker 없음, 계정 선택 후 실서버 응답
4. 실패 시 복귀: 대시보드에서 이전 배포 Promote — [demo-operations.md](../../demo-operations.md) 4절

## 남은 사용자 결정·외부 입력

| 항목                           | 필요한 것                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| 머지·배포                      | `feat/GD-260` push·PR·머지 지시 + Vercel `VITE_VIRTUAL_USERS_JSON`에 실계정 6개 JSON 입력 후 배포 |
| 전체 인수 시나리오             | 격리 이벤트 데이터(C1~C6), 서버 마감·추첨·발표 일정, INACTIVE 계정                                |
| AR01/AR02                      | 계약 확정 — `/admin/abuse-cases`가 실서버 404이므로 계약 없이는 미구현 상태로 남는다              |
| L3 격리 배너 CRUD·L5 격리 쓰기 | 격리 환경·계정 입력 — L6 구현과 무관하게 미검증 유지                                              |
| 성능 측정                      | p95 목표의 측정 조건 합의 — 미측정 유지                                                           |

## 배포 후 검증 절차

1. 배포 URL에서: 신규 브라우저 + 이전 목업 배포를 쓰던 브라우저 모두 Worker 0건, 로그인 계정 목록이 Vercel 설정과 일치하는지 확인
2. 계정 선택→홈→이벤트 상세의 실제 Network 응답·업무 ID 기록 (로컬 preview에서는 실계정 155건 200 확인 완료)
3. 로드맵 L6 전체 인수 시나리오 1~8 실행 — 격리 데이터 준비 후
4. 확인 항목을 reports/ 에 추가하고 로드맵·연동 현황을 갱신한다
