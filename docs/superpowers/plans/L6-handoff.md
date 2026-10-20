# L6 인계 — 런타임 목업 종료·통합 인수·시연 준비 (GD-260)

> 인계일: 2026-10-21. 상태 구분: 구현 완료 ✅ / 머지 완료 ✅ / 배포 완료 ✅ / 배포 후 검증 완료 ✅ / 통합 인수 부분 ⏳.

## 기준

- GD-260 PR #111은 dev에 스쿼시 머지됐다(`f17056c`). `https://getddo-fe.vercel.app` 프로덕션이 머지 후 dev 소스+실계정 `VITE_VIRTUAL_USERS_JSON`으로 서빙 중이며, 배포 후 검증(GD-261)은 [reports/20261021-GD-261-L6-deploy-acceptance.md](../../../reports/20261021-GD-261-L6-deploy-acceptance.md)에 기록했다.
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

## 배포 실행 결과 (완료)

배포 후보였던 PR #111 → dev 스쿼시 머지(`f17056c`) → Vercel 배포까지 완료됐다. `VITE_VIRTUAL_USERS_JSON`은 실제 등록 6계정(ADMIN 1·USER 5, INACTIVE 없음)으로 설정돼 현재 번들에 베이크돼 있다. 배포 후 검증 34 checks 전부 통과(신규 세션 Worker 0, `mockServiceWorker.js`만 자동 해제·다른 Worker 유지, `/virtual-users` 0건, 사용자 6·관리자 11 읽기 페이지 GET 200, 200% 확대 실측 넘침 없음 등). 실패 복귀 절차는 [demo-operations.md](../../demo-operations.md) 4절 그대로 유효하다.

## 남은 사용자 결정·외부 입력

| 항목                            | 필요한 것                                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| 머지·배포·배포 후 검증          | ✅ 완료 (dev `f17056c`, `getddo-fe.vercel.app` 실측 34 checks 통과)                                |
| 인수 시나리오 2~3의 쓰기 부분   | ✅ 완료 — 출석·미션·게임·응모·`ENTRY-005/006/007`·`TICKET-006` 실측 통과                           |
| 전체 인수 시나리오 4~6          | ✅ 대부분 완료 — 격리 이벤트로 마감→자동 추첨→검증→발표·알림, 취소→반환 실측. INACTIVE는 계정 없음 |
| AR01/AR02                       | 계약 확정 — `/admin/abuse-cases`가 실서버 404이므로 계약 없이는 미구현 상태로 남는다               |
| L3 격리 배너 CRUD·L5 격리 쓰기  | ✅ 완료 — 배너 등록·수정·순서·삭제·복원, AP02·AP04·AM03 생성·거절 실측                             |
| 성능·429                        | ✅ 실측 — p95 113/117ms(클라이언트 관측), 429 실발동 `Retry-After:60`                              |
| 추첨 실패 재개                  | 실패한 실행 없음 — `resume` 경로는 장애 주입 환경이 필요                                           |
| AG01~AG03 관리자 게임·보상 조건 | 계약 미확정·FE 미구현 — 담당자 확정 또는 범위 조정 결정 필요                                       |
| AM04 설문 집계·정책 적용 시점   | 정확한 미션 UUID·날짜 범위와 실제 적용 시점(다음 자정·월)의 서버 일정 관측이 필요                  |
| 잔여 시연 데이터                | `[TEST-GD261]` 이벤트 2건·미션·다음 자정 일일 정책·2026-11 연속 정책 — 삭제 API 부재로 운영 잔존   |

## 배포 후 검증 절차

1~2번(Worker·계정 목록·실서버 응답)은 `scripts/verifyL6Deployed.py`로 완료했다 — [reports/20261021-L6-deploy-evidence.json](../../../reports/20261021-L6-deploy-evidence.json). 재실행: `python scripts/verifyL6Deployed.py` (대상 변경 시 `L6_DEPLOY_URL`).
3번(로드맵 L6 전체 인수 시나리오 1~8)은 격리 데이터 생성 포함 실측까지 완료 — 외부 입력 대기는 INACTIVE·AR01/AR02·추첨 실패 재개·AG01~AG03·AM04·정책 적용 시점 관측이다. 쓰기 인수는 `scripts/verifyL6DeployRemaining.mjs`(모드별 재실행 가능, `L6_DEPLOY_URL` 필수 — 운영 오실행 방지로 기본 대상 없음. admin-writes 모드는 성공 생성 대신 보장된 중복 거절만 보낸다), 증거는 `reports/20261021-L6-deploy-remaining-*.json`. 수동 실행분은 각 JSON의 `source`/`provenance`에 표시. 4번(기록)은 본 문서·[연동 현황](../../backend-integration-status.md)·로드맵 L6에 반영했다.
