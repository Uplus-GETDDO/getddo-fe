# GD-250 관리자 사용자·응모 조회 및 응모권 운영·대시보드 실연동 계획

> 상태: 2026-10-20 사용자가 “화면 구성 승인하고, AS01도 위 집계 기준으로 연동해줘”라고 승인했다. `executing-plans`로 이 세션에서 순차 실행한다. 서브에이전트·자동 머지·배포는 수행하지 않는다.

**목표:** DB 사용자에서 응모·참여자·응모권 이력·정합성으로 이어지는 관리자 조회를 제공하고, 확인된 일별 집계로 대시보드의 조건별 요청을 대체한다.

**구조:** 기존 FSD, TanStack Query, Zod, 테이블·필터·페이지·서랍을 재사용한다. 시연 사용자와 DB 사용자 모델·조회 키를 분리한다. 조회 계약 → 화면 연결 → 집계 → 통합 검증 순으로 구현한다.

**기술:** 현재 설치된 React 19, TypeScript, TanStack Query 5, Zod 4, React Router 7, Vitest, Testing Library, MSW를 사용한다.

**계약:** `../getddo-spec/05-api/{user,ticket,entry,admin-stats,common}.md`, `00-requirements/{scope,functional-requirements}.md`. 본 계획은 FE 구현·검증을 다루며 공용 계약의 미확정 상태를 변경하지 않는다.

## 확인한 기준 상태

- 2026-10-20 `git fetch origin` 후 FE `dev = origin/dev = a49796a457841125d94f47031ed4391c7cf5644b`다. 공용 명세는 `main = origin/main = bbbe811`이다.
- `git ls-remote --heads origin '*/GD-250'` 결과는 없다. FE PR 최근 100건의 제목·브랜치에도 GD-250은 없다. Jira 키는 사용자가 제공한 GD-250을 사용하며 새 키를 만들지 않는다.
- Jira 원문은 로그인 화면으로 이동해 상태·담당·설명을 확인하지 못했다. 사용자 제공 제목과 L1 범위를 계획 기준으로 삼으며 Jira에서 확인한 것으로 기록하지 않는다.
- 시작 시 추적 문서 7개 수정과 미추적 문서 4개가 있었다. 기존 변경은 보존하며 GD-250 커밋에 일괄 포함하지 않는다. 목록과 실측은 [착수 확인 기록](../../../reports/20261020-GD-250-preflight.md)에 남긴다.
- AO01/AO02와 AO06/AO07 FE 호출은 없다. 응모권 AO03/AO04/AO05/AO08/AO09는 기존 호출·화면이 있다.
- 13:00~13:01 KST 배포 읽기 표본에서 AO01/AO02/AO06/AO07/AS01과 기존 관리자 응모권 조회가 200이었다. AO01 검색 결과 13명과 ACTIVE USER 전체 12명을 구분했고, 빈 검색·범위 밖 페이지에서도 전체 12명이 유지됐다.
- AS01은 7일·31일 200, 32일 400 `STATS-001`, USER 호출 403 `STATS-002`였다. BE PR #130은 머지됐지만 공용 명세와 BE 구현 안내 모두 여전히 **담당자 확인 전**이다. 성공 응답을 담당자 확인으로 대체하지 않는다.
- 배포 대시보드 최초 진입에서 추이용 지급 21회·사용 7회, 요약용 추가 지급 2회, 차단 목업 2회, AS01 0회를 관측했다.

## 승인 범위와 선행 조건

| 구분                            | 실행 조건                                                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 사용자·응모 조회와 응모권 연결  | 이 계획의 화면·경로·파일 책임 승인 후 진행한다. 기존 API 채택을 다시 승인받지 않는다.                                                                                               |
| AS01 전환                       | 담당자의 현행 계약 확인 근거 또는 사용자의 명시적 채택 확인을 기록한 뒤 진행한다. 배포 응답은 이번에 확인했으며 전환 시 다시 대조한다.                                              |
| 실제 API·브라우저 검증          | 배포 로그인에 제공되는 사전 등록 시연 계정을 사용한다. 일반 사용자·관리자 권한을 구분한다.                                                                                          |
| 거절·불일치·모든 등급 실물 표본 | 현재 거절 응모·불일치 목록은 빈 결과다. 단위·통합 fixture와 실서버 표본을 구분하고 실물 표본 미확보를 기록한다. 검증을 위해 운영 데이터를 훼손하지 않는다.                          |
| 로컬 실서버 화면 확인           | 환경 파일을 덮어쓰지 않는다. 기존 설정 이름의 프로세스 실행값으로 API 대상·MSW 사용 여부를 지정하는 임시 실행은 이 계획 승인 범위에 포함한다. 영구 환경 변수·빌드 설정 변경은 없다. |

AS01 확인이 남아도 조회·화면 작업은 진행한다. 집계 작업과 L1 전체 완료 표시는 보류한다. 담당자에게 메시지를 보내거나 Jira를 수정하는 작업은 포함하지 않는다.

## 제약과 불변 조건

- 관리자 조회만 구현한다. 연락처, 정지 사유·시각, 사용자 수정·정지/해제·역할 변경, 응모권 수동 지급·회수·정정 API를 추가하지 않는다.
- `/virtual-users`와 로그인·시연 계정 전환은 별개다. AO01을 일반 사용자의 계정 선택 API로 사용하지 않는다.
- AO01 `totalElements`는 필터 결과 수다. `totalUserCount`는 필터·페이지와 무관한 현재 `role=USER AND status=ACTIVE` 전체 수다. AO02에는 이 필드가 없다.
- `membership=null`은 미설정으로 표시한다. `excellent/vip/vvip`와 `USER/ADMIN`, `ACTIVE/INACTIVE`의 대소문자를 보존한다.
- AO06 `participantId=null`을 허용하며 거절 건의 차감은 0이다. 응모 건수와 중복 제거된 참여자 수를 혼합하지 않는다.
- BRONZE/SILVER/GOLD/PLATINUM을 모두 다루며 장수와 추첨 가중치를 구분한다.
- AS01 `blockedCount`의 화면 명칭은 **어뷰징 탐지 기록**이다. 지급 차단 확정 건수로 표시하지 않는다.
- AS01 `usedTickets`는 반환을 차감하지 않은 총사용량이다. 일별 `entrantCount`·`activeUserCount`를 합산해 기간 고유 사용자 수로 표시하지 않는다.
- 조회 오류·파싱 오류를 0건이나 샘플 성공으로 대체하지 않는다. 최초 로딩, 정상 빈 결과, 오류, 마지막 성공값이 있는 갱신 실패를 구분한다.
- 서버 데이터는 Query 캐시에만 둔다. 기존 사용자 전환 캐시 초기화와 AdminGuard를 재사용하며 인증·권한 구조를 변경하지 않는다.
- 새 dependency·서버 API·전역 상태·공용 정책·빌드 설정을 추가하지 않는다.

## 화면·메뉴·경로 제안

다음 구성을 추천하며 계획 승인에 포함한다. 관리자 lazy 로딩과 AdminGuard를 유지한다.

| 경로                                                 | 화면과 역할                                                                                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/admin/users`                                       | 새 메뉴 **사용자 조회**. 이름·UUID·역할·상태·멤버십 AND 필터, 검색 결과 수·현재 활성 일반 사용자 전체 수, 페이지·페이지 크기 선택을 제공한다.                                                          |
| `/admin/users?detail={userId}`                       | 같은 목록의 상세 서랍에서 AO02의 7개 필드를 표시한다. 직접 진입·새로고침을 지원하고 닫을 때 목록 조건을 보존한다.                                                                                      |
| `/admin/entries`                                     | 새 메뉴 **응모 조회**. 기본 보기는 AO06 응모 이력이며 사용자·이벤트 UUID, 접수/거절, KST 기간, 페이지 필터를 제공한다.                                                                                 |
| `/admin/entries?view=participants&eventId={eventId}` | 같은 페이지의 이벤트 참여자 보기에서 AO07을 호출한다. 이벤트 UUID가 없으면 입력 안내를 표시하고 요청하지 않는다. 삭제된 이벤트도 AO07 계약대로 직접 조회할 수 있게 이벤트 상세 성공에 의존하지 않는다. |
| `/admin/events/{eventId}`                            | 기존 상세에 **참여자 조회**·**응모 이력 조회** 링크를 추가한다. 별도 참여자 라우트나 중복 화면을 만들지 않는다.                                                                                        |
| `/admin/tickets?tab=histories&userId={userId}`       | 사용자 상세에서 해당 사용자 전체 응모권 이력으로 이동한다.                                                                                                                                             |
| `/admin/tickets?tab=consistency&userId={userId}`     | 해당 사용자 불일치 목록과 기존 정합성 직접 조회로 연결한다.                                                                                                                                            |
| 기존 `/admin/virtual-users`                          | **가상 사용자** 메뉴로 별도 유지한다. DB 사용자 수의 출처로 사용하지 않는다.                                                                                                                           |

사용자 상세에는 응모·응모권 이력·정합성 링크를 둔다. 응모/참여자 표에서 사용자 상세로 이동할 수 있다. ID를 직접 입력하거나 링크로 전달할 때 UUID·허용 enum·날짜를 검증한다. 검색은 제출 시 적용하고 필터·페이지 크기가 바뀌면 1페이지로 돌아간다. 상세 선택은 목록 조회 키에 넣지 않는다.

응모권 탭 전환은 유효한 `userId`를 유지한다. `date`·`operationType` 등 기존 대시보드 링크도 보존한다. 같은 컴포넌트에서 URL 사용자만 바뀌거나 뒤로 이동해도 이전 사용자의 필터·서랍이 남지 않게 한다.

## 변경 파일과 책임

`신규`는 구현 승인 후 생성할 파일이며, 테스트는 같은 책임의 기존 테스트 파일을 우선 확장한다.

| 대상                                                                                                                                         | 책임                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/entities/user/model/types.ts`, `index.ts`                                                                                               | DB 사용자 스키마·타입·조회 공개 API를 추가한다. 가상 사용자 모델은 분리한다.                                                                     |
| 신규 `src/entities/user/api/admin.ts`, `admin.test.tsx`                                                                                      | AO01/AO02 경로·조회 키·응답 봉투·스키마 검증·조회 조건을 소유한다. 기존 `api/queries.ts`의 시연 조회와 분리한다.                                 |
| `src/entities/entry/model/types.ts`, `index.ts`                                                                                              | 기존 EntryReceipt를 확장한 AdminEntry와 AdminParticipant 스키마·타입을 공개한다.                                                                 |
| 신규 `src/entities/entry/api/admin.ts`, `admin.test.tsx`                                                                                     | AO06/AO07 조회를 담당한다. 기존 사용자 `api/queries.ts`의 GD-247 폴링을 변경하지 않는다.                                                         |
| 신규 `src/pages/admin/users/AdminUsersPage.tsx`, `ui/AdminUserDetailSheet.tsx`, `AdminUsersPage.test.tsx`                                    | 사용자 목록·필터·상세·운영 링크·오류를 구성한다.                                                                                                 |
| 신규 `src/pages/admin/entries/AdminEntriesPage.tsx`, `ui/EntryHistoryPanel.tsx`, `ui/ParticipantsPanel.tsx`, `AdminEntriesPage.test.tsx`     | 응모·참여자 보기를 분리하고 공통 표·필터·페이지를 조합한다.                                                                                      |
| `src/pages/admin/eventDetail/AdminEventDetailPage.tsx`                                                                                       | 이벤트를 필터로 전달하는 운영 조회 링크를 추가한다.                                                                                              |
| `src/pages/admin/tickets/{AdminTicketsPage,GrantsTab,HistoriesTab,RefundsTab,InconsistencyTab}.tsx`, 기존 `AdminTicketsPage.test.tsx`        | 사용자 링크 필터·탭 전환·동일 화면 URL 변경·페이지 크기를 연결한다. 기존 정합성 서랍을 재사용한다.                                               |
| `src/entities/ticket/model/admin.test.ts`, `api/history.test.tsx`                                                                            | 4등급·이력·정합성 기존 회귀 테스트의 부족한 사례를 보강한다. 기존 파서 불일치가 실측되면 해당 모델·조회만 수정한다.                              |
| 신규 `src/entities/adminStats/{model/types.ts,api/queries.ts,api/queries.test.tsx,index.ts}`                                                 | AS01 전용 읽기 모델·기간·조회 키를 소유한다. 새 FSD 슬라이스를 계획 승인 대상으로 둔다.                                                          |
| `src/pages/admin/dashboard/AdminDashboardPage.tsx`, `hooks/useTicketTrend.ts`, `ui/TicketTrendPanel.tsx`, 기존 `AdminDashboardPage.test.tsx` | 최근 7일 단일 집계를 가져와 요약과 추이에 전달한다. 오류·요청 수·KST 경계·분모를 검증한다.                                                       |
| `src/widgets/adminStatSummary/ui/AdminStatSummary.tsx`                                                                                       | AS01의 오늘·어제 지표를 표시한다. 기존 이벤트 집계는 유지하며 탐지 기록 문구와 현재 사용자 분모를 명확히 한다.                                   |
| `src/pages/admin/dashboard/ui/OpenEventsPanel.tsx`                                                                                           | 이벤트별 현황에서 참여자 조회로 연결한다. 일별 AS01을 이벤트별 E03의 대체값으로 쓰지 않는다.                                                     |
| `src/entities/ticket/api/admin.ts`, `index.ts`                                                                                               | AS01 전환 후 사용처가 사라진 조건별 count 훅·타입·export만 제거한다. 운영 이력 조회는 보존한다.                                                  |
| `src/app/routes/adminRoutes.tsx`, `src/app/layouts/adminNavItems.ts`, 기존 `adminRoutes.test.tsx`                                            | 두 메뉴·lazy 라우트와 관리자 가드를 연결한다.                                                                                                    |
| 신규 `src/mocks/handlers/{adminUser,adminEntry,adminStats}.ts`, 기존 `index.ts`                                                              | 로컬 개발·테스트용 계약 fixture를 제공한다. `hybridHandlers`에 신규 관리자 조회를 등록하지 않는다. AS01 과거 미배포 주석은 실측 근거로 정정한다. |
| `docs/backend-integration-status.md`, 로드맵 L1, 필요 시 `docs/CONTEXT.md`, 본 계획, `reports/20261020-GD-250-preflight.md`                  | 구현·검증·dev 반영·배포 상태를 분리해 기록한다. 기존 문서 수정분은 덮어쓰지 않는다.                                                              |

재사용 대상은 `shared/ui/{table,filter-fields,paged-result,pagination,sheet,chip-tabs}`, `shared/model/filterConstants`, `shared/utils/date`, `shared/api/{client,envelopeSchema,errorMessage,queryPresets}`, `TicketConsistencyDrawer`다. 조회를 mutation feature로 만들지 않는다.

## 조회 인터페이스와 날짜·요청 정책

| 공개 인터페이스                         | 입력·출력·키                                                                                                                                        |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAdminUsers(params)`                 | `page,size,userId?,keyword?,role?,status?,membership?` → `AdminUserList`. `ADMIN_USERS_KEY = ['admin','users']`, 목록 키는 `[..., 'list', params]`. |
| `useAdminUser(userId)`                  | `string \| null` → `AdminUser`. 키는 `[..., 'detail', userId]`. 유효한 상세 ID가 없으면 비활성이다.                                                 |
| `useAdminEntries(params)`               | `page,size,userId?,eventId?,status?,from?,to?` → `Page<AdminEntry>`. `ADMIN_ENTRIES_KEY = ['admin','entries']`, `[..., 'list', params]`.            |
| `useAdminParticipants(eventId, params)` | `string \| null`, `page,size` → `Page<AdminParticipant>`. `[..., 'participants', eventId, params]`.                                                 |
| `useAdminDailyStats({from,to})`         | KST `YYYY-MM-DD` 양끝 포함 → `DailyStats`. `ADMIN_STATS_KEY = ['admin','stats']`, `[..., 'daily', {from,to}]`.                                      |

- API client 경로는 `/v1/admin/...`이고 기존 base URL `/api`와 결합한다. 모든 응답을 기존 봉투와 업무 Zod 스키마로 검증한다.
- 관리자 목록은 기존 `queryPresets.noCache` 방식을 기본으로 사용한다. 명시적 400/403/404는 반복 자동 재시도하지 않는다. 필터 변경 중 이전 목록을 새 검색 결과로 표시하지 않는다.
- AO01 이름은 trim 후 최대 20자다. `%`·`_`를 인코딩해 문자 그대로 서버에 전달하고 클라이언트에서 와일드카드 검색하지 않는다. 기본 page=1, size=20이며 화면의 크기 선택은 20/50/100을 사용한다.
- AO06·응모권 이력의 날짜 입력은 KST 시작일 00:00부터 종료일 다음 날 00:00까지의 UTC `[from,to)`로 변환한다. 예: 10월 20일 하루는 `2026-10-19T15:00:00Z` 이상, `2026-10-20T15:00:00Z` 미만이다.
- AS01은 위 UTC 변환을 적용하지 않고 KST 날짜 문자열을 그대로 보낸다. 범위 내 날짜가 빠지거나 중복되면 0으로 보충해 성공 처리하지 않고 계약 오류로 알린다.
- 최근 7일 범위는 기존 `useVirtualClock().now()`와 `recentKstDays`로 한 번 계산한다. AS01은 서버 저장 데이터를 조회할 뿐 가상 시계가 서버 시간을 변경하지 않는다고 안내한다.
- 대시보드 페이지에서 AS01 조회를 한 번 소유하고 요약·추이에 같은 결과와 재조회 상태를 전달한다. 응모권 count 훅·차단 목업 조회와 AO01 분모 전용 추가 조회를 제거한다. 기존 이벤트·알림·정합성 업무 조회는 각각 유지한다.
- AS01은 기존 `queryPresets.standard`를 사용하고 별도 자동 폴링을 추가하지 않는다. 수동 재조회 중 중복 요청을 잠근다. 같은 기간의 재렌더·요약/차트 동시 렌더는 요청을 늘리지 않는다.
- 요약에는 기존 이벤트·지급·사용 카드와 **오늘 어뷰징 탐지 기록** 카드를 둔다. 추가 요약 행에서 오늘 응모자 수·접수 건수·활동 사용자 수·현재 활성 일반 사용자 수를 구분한다.
- 참여율은 `오늘 activeUserCount / 현재 totalUserCount × 100`의 참고값으로 표시한다. 분모 0이면 `계산 불가`로 표시하며 Infinity/NaN을 출력하지 않는다. 과거 활동자에는 현재 비활성 사용자가 포함될 수 있으므로 100% 초과를 임의로 자르지 않고 분모 기준을 설명한다.
- 탐지 기록 카드에서 아직 목업인 차단 상세로 이동해 실제 근거를 본 것처럼 오인시키지 않는다. L1에서는 해당 카드의 상세 이동을 제공하지 않고 기존 차단 메뉴의 실연동은 L2에 남긴다.

## 순차 실행과 작은 커밋

### T1. 관리자 조회 계약

- [x] 승인 후 다시 fetch·작업트리를 확인하고 동일 키 원격 브랜치가 생겼으면 재사용한다. 없으면 `origin/dev`에서 `feat/GD-250`을 생성한다.
- [x] `user/api/admin.test.tsx`, `entry/api/admin.test.tsx`에 정상 봉투·필터 전달·빈 페이지·403/404·nullable·4등급 실패 테스트를 추가한다.
- [x] `npx vitest run src/entities/user/api/admin.test.tsx src/entities/entry/api/admin.test.tsx`로 실패를 확인한다.
- [x] 위 인터페이스와 모델·공개 export·로컬 fixture를 구현한다. 목록 전체 수를 별도 요청이나 현재 페이지 길이로 계산하지 않는다.
- [x] 같은 테스트와 lint를 통과시키고 `feat: 관리자 사용자·응모 조회 계약 연결 (GD-250)`로 커밋한다. → `7e8aed9`

### T2. 사용자·응모·참여자 화면

- [x] 사용자·응모 페이지 테스트에 검색 제출·초기화·페이지·크기·상세 404·권한 403·링크·키보드 사례를 추가하고 실패를 확인한다.
- [x] 승인된 두 경로와 상세 서랍·참여자 보기를 기존 UI로 구현한다. AO07 조회는 이벤트 상세의 존재 여부에 의존하지 않는다.
- [x] 이벤트 상세·대시보드 이벤트 행에 참여자 조회 링크를 추가하고 라우트 가드 테스트를 확장한다.
- [x] `npx vitest run src/pages/admin/users src/pages/admin/entries src/app/routes/adminRoutes.test.tsx`와 lint·build로 검증한다.
- [x] `feat: 관리자 사용자·응모 운영 화면 연결 (GD-250)`로 커밋한다. → `f7ea5b1`

### T3. 응모권 운영 연결

- [x] 기존 `AdminTicketsPage.test.tsx`에 userId 링크, 네 탭 이동, 같은 경로의 사용자 교체·뒤로가기, 검색 초기화, 페이지 크기, 정합성 서랍을 검증하는 실패 테스트를 추가한다.
- [x] 탭 URL과 적용 필터를 연결하고 사용자 상세에서 기존 이력·정합성으로 이동하게 한다. 새 사용자 상태를 전역 store로 복사하지 않는다.
- [x] AO03 미션·지급 근거·4등급 필터, AO04 일치/불일치/없는 사용자, AO05 전체 이력, AO08 이벤트 취소 반환, AO09 빈 불일치를 검증한다.
- [x] `npx vitest run src/pages/admin/tickets src/entities/ticket`와 lint를 통과시키고 `feat: 사용자별 응모권 이력·정합성 연결 (GD-250)`로 커밋한다. → `74cc9d5`

### T4. 일별 집계 전환

- [x] AS01 담당자 확인 근거를 기록한다. 확인이 없으면 이 단계만 보류한다. → 사용자가 “AS01도 위 집계 기준으로 연동해줘”로 현행 계약 채택을 명시했다.
- [x] AS01 파서·조회 테스트와 기존 대시보드 테스트에 아래 요청 수·날짜·집계 의미 사례를 추가하고 실패를 확인한다.
- [x] AS01 모델·조회와 단일 데이터 소비를 구현하고 조건별 count 훅을 제거한다. 기존 차트 표현·공통 오류·날짜 유틸을 재사용한다.
- [x] `npx vitest run src/entities/adminStats src/pages/admin/dashboard src/shared/utils/date.test.ts`와 lint·build로 검증한다.
- [x] `perf: 관리자 집계를 일별 API로 통합 (GD-250)`로 커밋한다. → `a1bb1a0`

### T5. 실제 API·브라우저·문서

- [x] 실제 GET 표본에 구현된 Zod 파서를 적용하고 HTTP·업무 코드·필드·배포 식별자·확인 시각을 기록한다. → `reports/20261020-GD-250-live-verification.md`
- [x] 로컬 변경 화면을 실제 API에 연결해 사용자 검색→상세→응모→참여자→응모권 이력→정합성을 확인한다.
- [x] 콜드 캐시 대시보드에서 AS01 1회, 추이용 지급·사용 조건별 요청 0회, 요약용 차단 목업 0회를 Network로 기록한다. 수동 재조회 1회와 KST 날짜 변경 시 새 범위 1회도 확인한다.
- [x] 키보드 Tab/Enter/Escape·서랍 닫기 후 포커스, 320/390px·200% 확대, 빈 결과·403/404·실패 재시도를 검증한다.
- [x] `npm run format:check`, `npm run lint`, `npm run test:ci`, `npm run build`를 모두 실행한다. 새 코드의 필요한 포맷·import 정렬은 기존 도구를 사용한다.
- [x] diff와 요구사항을 직접 검토하고 검증 기록·로드맵 L1·연동 현황을 갱신한다. 기존 미커밋 문서 변경을 보존하고 이 작업의 변경 부분만 분리한다.
- [x] `test: 관리자 실연동 검증과 현황 기록 (GD-250)`로 커밋한다. → `8c7ce9a`. PR·dev 반영·배포는 실행하지 않았다.

## 검증 사례

| 영역      | 입력·행동                                                                           | 기대 결과                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| AO01 필터 | USER/ADMIN, ACTIVE/INACTIVE, 3개 멤버십, UUID, 공백·`%`·`_` 이름을 조합한다.        | AND 조건과 trim·문자 검색을 전달한다. 잘못된 UUID/20자 초과는 안내하고 유효하지 않은 요청을 보내지 않는다.                  |
| 전체 수   | 검색 결과 0, 상세 열기, 페이지 1→마지막→범위 밖, size 20→50을 반복한다.             | `totalElements`와 `totalUserCount`를 분리한다. fixture에서 후자는 12로 유지하고 누락 시 0으로 대체하지 않는다.              |
| AO02      | nullable membership, 없는 UUID, USER 호출을 재현한다.                               | 미설정, 404 USER-010, 403 USER-009를 구분하고 수정 요청은 0회다.                                                            |
| AO06      | ACCEPTED·REJECTED, null participantId, 네 등급 요청/차감 맵을 제공한다.             | 거절의 요청량은 보존하고 차감은 0으로 표시한다. 차감 장수와 참여자 수를 혼합하지 않는다.                                    |
| AO07      | 이벤트 미선택·빈 참여자·범위 밖·존재하지 않음·삭제된 이벤트를 제공한다.             | 미선택은 요청 0회, 빈 결과는 정상, 404 ENTRY-004와 403 ENTRY-010은 오류다. 삭제된 이벤트 응답도 표시한다.                   |
| 응모권    | missionId+sourceType+grade, AO04 false·null 이력 상태·404, AO09 빈 결과를 제공한다. | 한 행=한 장이며 정상·빈 불일치·존재하지 않음을 구분한다.                                                                    |
| 반환      | AO08 spendHistoryId와 AO05 originalUseHistoryId를 실제 표본으로 대조한다.           | 이벤트 취소 반환만 연결하며 등급·만료 시각을 보존한다. 당첨 취소 반환을 생성하지 않는다.                                    |
| T01/T02   | 네 등급 합계·서버 만료, T02 다음 커서·필터 변경을 확인한다.                         | T01 합계=availableCount, 커서 중복/누락 없이 이력을 읽고 총 건수 의미를 유지한다.                                           |
| KST       | UTC 10월 31일 14:59:59/15:00:00, 9월→10월·12월→1월, 1/31/32일 범위를 검증한다.      | 이력 UTC 반개구간과 AS01 KST 날짜 양끝 포함을 구분한다. 31일 허용·32일 거절이다.                                            |
| AS01      | 활동 없는 날, 세 지급 근거, NO_TICKET 응모, 거절 제외, 탐지 기록을 제공한다.        | 날짜 누락을 성공 0으로 감추지 않고, 장수·응모 건수·고유 인원·탐지 기록을 구분한다.                                          |
| 참여율    | 분모 0, 활동자 0, 활동자>현재 활성 사용자, 여러 날 같은 사용자 활동을 제공한다.     | 0 분모는 계산 불가, 양의 분모·0 활동은 0%, 100% 초과는 값과 기준을 보존하고 기간 고유 인원을 합산하지 않는다.               |
| 요청 수   | 같은 기간의 요약·차트 동시 렌더, 재렌더, 재조회 연타, 날짜 변경을 수행한다.         | 초기 AS01 1회, 단일 재조회 1회, 날짜 변경 새 범위 1회다. 이전 조건별 집계 요청은 0회다.                                     |
| 실패·권한 | 초기 500, 재조회 실패, 403/404, ADMIN→USER 전환을 재현한다.                         | 오류를 0으로 숨기지 않고 이전 데이터는 마지막 조회값으로 구분한다. 기존 캐시 초기화·가드가 관리자 데이터를 노출하지 않는다. |

실서버에서 없는 거절·불일치·희귀 등급 표본은 MSW 테스트 통과와 실서버 미검증을 따로 기록한다. 전체 L1 완료를 주장하려면 미검증 사항을 해결하거나 사용자가 검증 범위 조정을 명시해야 한다.

## 실행 상태

- [x] 계약·현재 소스·원격 dev·관련 BE PR을 대조했다.
- [x] 배포 API 읽기 표본과 기존 대시보드 요청 수를 측정했다.
- [x] 변경 전 format:check·lint·test:ci·build를 실행했다.
- [x] 본 계획의 경로·메뉴·파일 책임·검증 범위를 승인받았다.
- [x] AS01 현행 계약의 사용자 채택 확인을 기록했다. 별도 담당자 확인을 받은 것으로 기록하지 않는다.
- [x] T1 → T2 → T3 → T4 → T5를 실행했다. 커밋: `7e8aed9`·`f7ea5b1`·`74cc9d5`·`a1bb1a0`.
- [x] 구현 후 공통 검증·브라우저 증거·로드맵 갱신을 마쳤다. 검증 증거: `reports/20261020-GD-250-live-verification.md`.

일반 승인은 T1~T3와 T5의 해당 부분을 실행할 수 있다는 뜻이다. AS01 확인이 별도로 남으면 T4는 대기하며 동일 범위를 재승인받지 않는다.

**남은 미검증 항목 (실서버 표본 부재):** 거절 응모·AO09 불일치·GOLD/PLATINUM 실물 표본, AS01 월 경계 실측은 현재 데이터에 없어 MSW 테스트로만 검증했다. L1의 나머지는 실제 API·브라우저 증거가 있다. PR 생성·dev 반영·배포는 별도 지시가 있을 때까지 실행하지 않는다.
