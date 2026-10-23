# GD-260 L6 — 런타임 목업 종료·통합 인수·시연 준비 구현 계획

> 실행자는 이 계획의 승인 범위만 구현한다. 서브에이전트·임의 Jira·자동 머지·실제 배포는 수행하지 않는다.

**목표:** 배포에서 브라우저 MSW 부팅과 가짜 업무 응답을 종료하고, 시연 계정을 `VITE_VIRTUAL_USERS_JSON` 직접 설정으로 공급한다.

**기준:** `feat/GD-260`(base dev `92583c3`, PR #110 MERGED 확인), 2026-10-21. [로드맵 L6](2026-10-20-backend-integration-roadmap.md), [연동 현황](../../backend-integration-status.md), [L5 인계](L5-handoff.md)를 함께 읽는다.

**체크박스 대조(2026-10-23, GD-316):** 아래 20개는 구현 작업이며 통합 인수 완료 표시는 아니다. `f17056c`(PR #111)의 구현·테스트·문서, `bea5642`(PR #119)의 계정 예시·라벨 정정, 현재 코드(`b396c27`)를 대조해 구현 완료분을 표시했다. 배포 검증은 `8526d3d`(GD-261, PR #112)의 [실측 보고서](../../../reports/20261021-GD-261-L6-deploy-acceptance.md)를 근거로 하며 이번 작업에서 실서버를 재측정하지 않았다.

## 승인된 결정 (2026-10-21)

| 항목           | 결정                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 시연 계정 공급 | `VITE_VIRTUAL_USERS_JSON` 직접 읽기. **모든 모드에서 fallback 없음** — 미설정·형식 오류 시 명시 안내. `.env.example`에 로컬용 샘플 JSON 제공                                    |
| 배포 MSW       | `vercel.json` build.env `VITE_ENABLE_MSW: "false"` + 부팅 시 기존 등록된 `mockServiceWorker.js`만 해제하는 코드. Vercel `VITE_VIRTUAL_USERS_JSON` 값은 사용자가 대시보드에 설정 |
| 가상 시계      | 프로덕션 빌드에서 티커·`/admin/virtual-clock` 라우트·메뉴 숨김 + 저장된 오버라이드 무시. dev에서는 유지                                                                         |
| 로그아웃       | UI 추가 안 함 — 사용자 전환이 세션 변경을 대체. 전환·새로고침의 캐시 격리는 검증한다                                                                                            |

## 구현 경계

- `/admin/abuse-cases`는 MSW 종료 후 실서버 404를 받는다 — 화면을 유지하고 오류를 그대로 표시한다(AR01/AR02 계약 미확정을 숨기지 않는다).
- 테스트용 MSW(`handlers`, `mocks/server.ts`, `testSetup.ts`, fixture)는 보존한다. 로컬 전체 목업(`handlers`)도 유지한다 — 사라지는 것은 배포 전용 `hybridHandlers`다.
- `pendingSubmissions`는 `userId:gameId` 키로 이미 사용자별 격리다. `sessionSync`의 전환 시 `resetQueries`도 유지한다.
- AO01을 사용자 선택 API로 사용하지 않는다. 비계약 `/play`·가짜 집계·오류 시 샘플 대체는 코드에 없음을 grep으로 재확인한다.

## Task 1 — 시연 계정 공급을 설정 읽기로 전환

**Files:**

- Create: `src/entities/user/model/virtualUsers.ts`, `src/entities/user/model/virtualUsers.test.ts`
- Modify: `src/entities/user/api/queries.ts`, `src/entities/user/index.ts`
- Modify: `src/pages/login/LoginPage.tsx`, `src/features/switchVirtualUser/ui/VirtualUserSwitcher.tsx`, `src/pages/admin/virtualUsers/AdminVirtualUsersPage.tsx`

- [x] `virtualUsers.ts` — 설정 파서와 오류 타입

```ts
import { z } from 'zod';

import type { VirtualUser } from './types';

import { virtualUserSchema } from './types';
import { env } from '@shared/config/env';

export class VirtualUsersConfigError extends Error {
    constructor(
        public readonly reason: 'missing' | 'invalid',
        detail?: unknown,
    ) {
        super(
            reason === 'missing'
                ? 'VITE_VIRTUAL_USERS_JSON이 설정되지 않았습니다.'
                : 'VITE_VIRTUAL_USERS_JSON의 형식이 올바르지 않습니다.',
        );
        this.name = 'VirtualUsersConfigError';
        if (reason === 'invalid') console.error('시연 계정 설정 해석 실패:', detail);
    }
}

export function getVirtualUsers(): VirtualUser[] {
    const raw = env.virtualUsersJson;
    if (!raw) throw new VirtualUsersConfigError('missing');
    try {
        return z.array(virtualUserSchema).min(1).parse(JSON.parse(raw));
    } catch (error) {
        throw new VirtualUsersConfigError('invalid', error);
    }
}
```

- [x] `api/queries.ts` — HTTP 호출 제거, 설정 읽기로 전환

```ts
import { useQuery } from '@tanstack/react-query';

import { getVirtualUsers } from '../model/virtualUsers';

export const VIRTUAL_USERS_KEY = ['virtual-users'] as const;

// 시연 계정 목록은 서버가 아니라 배포 설정(VITE_VIRTUAL_USERS_JSON)이 공급한다 —
// 설정 누락·형식 오류는 재시도로 회복되지 않으므로 retry: false다
export function useVirtualUsers() {
    return useQuery({
        queryKey: VIRTUAL_USERS_KEY,
        queryFn: getVirtualUsers,
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
    });
}
```

- [x] `index.ts` — `VIRTUAL_USERS_API_PATH` 제거, `getVirtualUsers`·`VirtualUsersConfigError` export 추가
- [x] 세 화면의 오류 문구를 설정 안내로 통일 — 네트워크 오류가 아니므로 "시연 계정 설정(VITE_VIRTUAL_USERS_JSON)이 없거나 형식이 올바르지 않습니다." 로 표시한다
- [x] `virtualUsers.test.ts` — 정상 파싱 / 미설정 missing / 잘못된 JSON invalid / 스키마 불일치 invalid / 빈 배열 invalid — env는 `vi.stubEnv` + `vi.resetModules` + dynamic import로 주입

## Task 2 — 배포 MSW 부팅 종료와 Worker 정리

**Files:**

- Create: `src/app/config/serviceWorkerCleanup.ts`, `src/app/config/serviceWorkerCleanup.test.ts`
- Modify: `src/app/main.tsx`, `src/mocks/browser.ts`, `src/mocks/handlers/index.ts`, `vercel.json`, `.env.example`

- [x] `serviceWorkerCleanup.ts`

```ts
// 배포에서 MSW를 끄면 과거에 등록된 앱의 목업 Worker가 남아 요청을 가로챌 수 있다.
// 같은 origin의 등록 중 script가 mockServiceWorker.js인 것만 해제한다 — 다른 앱의 Worker는 건드리지 않는다.
export async function unregisterMockServiceWorker(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
        registrations
            .filter((registration) =>
                [registration.active, registration.waiting, registration.installing].some(
                    (worker) => worker?.scriptURL.endsWith('/mockServiceWorker.js'),
                ),
            )
            .map((registration) => registration.unregister()),
    );
}
```

- [x] `main.tsx` — `env.enableMsw`가 false면 `unregisterMockServiceWorker()`를 실행하고 렌더한다. MSW 시작 분기는 유지한다

```ts
async function prepareRuntime() {
    if (env.enableMsw) {
        const { worker } = await import('@mocks/browser');
        await worker.start({ onUnhandledRequest: 'bypass' });
        return;
    }
    await unregisterMockServiceWorker();
}
```

- [x] `mocks/browser.ts` — `hybridHandlers` 분기를 제거하고 `handlers`만 등록한다 (배포는 enableMocking 자체가 실행되지 않는다)
- [x] `mocks/handlers/index.ts` — `hybridHandlers` export·주석을 제거하고 `handlers` 조합만 유지한다 (`abuseHandlers`·`virtualUserHandlers`는 로컬 전체 목업으로 남긴다)
- [x] `vercel.json` — `"VITE_ENABLE_MSW": "false"`
- [x] `.env.example` — `VITE_VIRTUAL_USERS_JSON`을 필수로 안내하고 로컬용 `vu-*` 샘플 JSON 한 줄을 주석 해제 예시로 제공. `VITE_ENABLE_MSW`는 로컬 개발 전용임을 명시
- [x] `serviceWorkerCleanup.test.ts` — mockServiceWorker.js 등록만 해제되고 다른 scriptURL은 유지, serviceWorker 미지원 환경에서 조용히 통과

## Task 3 — 가상 시계 프로덕션 비노출

**Files:**

- Modify: `src/app/layouts/UserLayout.tsx`, `src/app/layouts/AdminLayout.tsx`, `src/app/routes/adminRoutes.tsx`, `src/app/layouts/adminNavItems.ts`, `src/shared/model/virtualClock/VirtualClockProvider.tsx`, `src/features/controlVirtualClock/ui/VirtualClockControl.tsx`

- [x] `VirtualClockProvider.tsx` — `env.isDev`가 아니면 `readStoredOverride`가 null을 반환하고 `setOverride`도 무시한다. 프로덕션은 항상 실제 시각이다

```ts
const initialOverride = env.isDev ? readStoredOverride() : null;
// setOverride 내부 첫 줄에: if (!env.isDev) return;
```

- [x] `UserLayout.tsx`·`AdminLayout.tsx` — `<VirtualClockTicker>`를 `{env.isDev && ...}`로 감싼다 (기존 주석 의도 유지)
- [x] `adminRoutes.tsx` — `virtual-clock` 라우트를 `env.isDev` 조건부 배열로 이동한다 (`userRoutes`의 ui-gallery와 같은 패턴)
- [x] `adminNavItems.ts` — 가상 시계 항목을 `env.isDev`일 때만 포함하도록 목록 끝에서 필터한다
- [x] `VirtualClockControl.tsx` — CardDescription에 "화면 표시와 로컬 목업만 바뀌며 서버 일정·마감·추첨·발표는 실제 시각으로 동작합니다"를 명시한다
- [x] 라우트·메뉴 변경이 기존 `adminRoutes.test.tsx`에 미치는 영향을 확인해 필요한 테스트를 맞춘다

## Task 4 — 문서 현행화 (검증 통과 후)

**Files:** `.env.example`(Task 2에 포함), `README.md`, `CONTRIBUTING.md`, `docs/CONTEXT.md`, `docs/backend-integration-status.md`, `docs/adr/ADR-0002-msw-mock-strategy.md`, 로드맵 L6 체크

- [x] 배포 MSW 없음·`/virtual-users` 미호출·가상 시계 dev 전용·시연 계정 설정 절차를 반영한다
- [x] 로드맵 L6 작업 내용 체크박스는 구현 완료분만 표시하고, 외부 입력 대기(C1~C6·AR01/AR02·격리 쓰기)는 미완료로 남긴다

## 검증 계획

1. `npm run format:check`·`npm run lint`·`npm run test:ci`·`npm run build`·`git diff --check`
2. `scripts/verifyL6Browser.py` (verifyL5Browser.py와 같은 로컬 preview + CORS 프록시 방식):
    - `VITE_VIRTUAL_USERS_JSON`에 실제 등록 UUID를 넣고 `VITE_ENABLE_MSW=false`로 빌드·preview
    - 로그인 화면이 설정된 계정만 표시, `/virtual-users` 요청 없음, 업무 조회는 실서버 응답
    - `navigator.serviceWorker.getRegistrations()` 0건 — 가짜 `mockServiceWorker.js`를 등록 후 재진입하면 해제됨을 확인
    - 사용자 A 조회 → B 전환 → A의 응모권·알림이 노출되지 않음(쿼리 리셋)
    - 프로덕션 빌드에서 가상 시계 티커·메뉴·라우트 비노출
3. 미설정 빌드에서 로그인 화면에 설정 안내가 뜨는지 확인
4. 실서버 Network 증거(상태·업무 ID·MSW 미개입)를 `docs/superpowers/plans/L6-*-evidence.json`에 기록

## 외부 입력(구현 차단 아님, 완료 근거도 아님)

> 진행 상태 동기화(2026-10-23, GD-316): 실계정 JSON 설정과 머지·배포·배포 후 검증(GD-261)의 기존 증거를 확인했다. L2/L5 전체 인수 완료로 확대하지 않는다. 최신 잔여의 기준은 [통합 로드맵](2026-10-20-backend-integration-roadmap.md)이다.

- Vercel `VITE_VIRTUAL_USERS_JSON` 실제 계정 JSON(실제 등록 UUID 목록) — ~~사용자 설정~~ **설정 완료**: GD-261(PR #112) 배포 실측에서 등록 6계정 로그인·조회 200 확인
- L2: 격리 이벤트(`[TEST-GD261]`)로 마감→자동 추첨→관리자 검증→발표·마스킹→알림·취소→원래 등급 반환까지 GD-261에서 실측했다. 현재 로드맵에 남은 C1 알림 상세 시나리오·취소→재추첨→공개 격리 인수는 미완료로 유지한다. AR01/AR02는 이후 GD-141에서 계약 채택·GD-286(PR #126)에서 FE 정렬됐으나 배포 확인은 잔여다(기존 실측 404). 추첨 실패 `resume` 실측은 백엔드 담당자 소유로 유지한다.
- L5: AP02/AP04·AM03 격리 실서버 쓰기 — GD-261에서 실측 완료(AP02 201+중복 409, AP04 201+400, AM03 201+400). AP05/AP06·AM05는 GD-282(PR #121) 연결분으로 배포 후 실측은 별도 잔여
- 그 밖의 외부 입력·관측 대기: GD-261 당시 INACTIVE 계정 표본 0건, 실제 자정/월 경계 적용 관측·AM04 설문 집계 등은 기존 증거만으로 완료 처리하지 않는다. 관리자 게임 운영 계약·범위도 별도 확정이 필요하다.
- ~~실제 머지·배포는 별도 지시~~ — PR #111 사용자 머지(`f17056c`)·배포 후 GD-261 재확인 완료
