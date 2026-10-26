# 백엔드 연동 현황

## 확인 기준과 한계

- 확인일: 2026-10-23.
- FE: 원격 dev `52eca83`(GD-325 PR #146까지 머지). `https://getddo-fe.vercel.app` 프로덕션은 이전 확인에서 머지 후 dev 소스(청크 해시 일치)와 실계정 `VITE_VIRTUAL_USERS_JSON`으로 서빙 중이었고, 2026-10-23 재확인에서 신규 엔트리 청크 `index-CL6m5Ctq`·신규 `AdminAbuseCasesPage-BY0ZstoE`(`role=region` 시그니처 포함)로 GD-317 이후 머지분이 배포된 것을 확인했다 — `/admin/abuse-cases`·`/admin/events`의 320px 가로 넘침이 109px→0px로 해소됐고 AR01/AR02 실데이터 10행·필터·드로어 evidence·콘솔 오류 0을 배포본에서 재측정했다([증거](../reports/20261023-gd317-abuse-page.json)).
- 공용 명세: `main`의 `6aa18ed`. 전회 확인(`bb3de26`) 이후 반영된 변경은 GD-141 evidence 필드·조회 오류 계약 확정(아래 AR01/AR02 실측에 반영), 타꼬 주문 화면 초안 갱신(판정 시점·지우기·노출 시간 — FE 화면 변경분을 초안에 기록), GD-314 `PUBLICATION-002` 문구·실행 감사 표시·실패 복구 기준, 관리자 응답 이름 필드(GD-284)·플래티넘(GD-228~230)의 구현 현황 갱신이다.
- 이번 확인은 공용 명세·실제 소스·Git 이력 대조와 2026-10-20 배포 라우팅 실측(추첨 경로 401/405·USER-002, `/admin/abuse-cases` 404)을 함께 반영한다.
- 팀 전달의 “백엔드 구현 완료”는 실행의 출발점이다. 배포 환경·메서드·DTO·권한·쓰기 재시도가 맞는지 별도로 확인해야 한다.
- 상태를 계약 채택, FE 호출 구현, 배포 실측, 통합 검증으로 구분한다. 아래 “실서버 전달”은 하이브리드 목업에 해당 핸들러가 없고 호출 코드가 있다는 의미다.

## 팀이 요청한 다섯 항목

### 결과 알림

N01 목록·N02 개별 읽음·N03 전체 읽음과 AN01~AN05 관리자 알림 운영은 호출 코드가 있고 하이브리드 목업 대상이 아니다. `NotificationItem`과 알림 드로어에는 결과 링크 처리도 있다.

GD-253에서 최초 발표(`result-confirmation`) 호출이 연결됐고 관리자 추첨 목업의 배포 등록이 해제됐다. 2026-10-24 GD-331에서 목록·읽음 필터·커서 페이징·개별 읽음·`linkUrl` 이동·빈 목록을 배포본에서 실측했다 — “알림 UI/API 연결·최초 발표 호출은 구현·실측됨, 실제 공개→알림 생성 도착의 트리거 연동은 남음(BE 격리 이벤트 데이터 대기)”으로 판정한다. 알림 전체가 완료됐다고 단정하거나 이미 있는 드로어를 재구현하지 않는다.

근거: `entities/notification/api/queries.ts`, `features/markNotificationRead/api/queries.ts`, `entities/adminNotification/api/queries.ts`, `features/retryAdminNotification/api/queries.ts`, `widgets/notificationBell/`, `features/runDraw/api/queries.ts`.

### 게임 연결과 게임 기록

GD-257에서 G01 요약·G02 상세·G05 누적 통계를 분리하고 UUID 요청·code 선택, G03 시작→G04 원본 입력 제출을 연결했다. 색깔 answers, 타꼬런 120Hz endTick/inputs, 타이밍 누른 순간 정수 ms taps, 주문 rounds/picks를 기록한다. 임시 dailyLimit/remainingPlays·오늘 플레이 횟수·비계약 `/play`를 제거했다.

네 게임 모두 실제 API에서 VALID·동일 재제출·보상·G05·T01/T02를 대조했다. 색깔 50점·주문 18점·타이밍 50점·타꼬런 451점이 FE 계산과 일치했고 각 게임에서 1장 지급을 확인했다(BRONZE/SILVER 실물 표본). 네 게임 기준 미달 reward=null·미완료 INVALID와 통계 미반영, 404 GAME-005·409 GAME-006·413 GAME-008·429 COMMON-006 및 Retry-After 59초 뒤 동일 요청 성공을 확인했다. ADMIN은 네 게임 시작 201·결과/통계 403이다.

MSW 없는 로컬 preview 브라우저에서도 네 게임을 실제 입력으로 종료해 VALID를 확인했다. 타이밍 결과 응답 유실 후 같은 playId·입력으로 재시도했고 내 응모권 화면을 조회했다. 브라우저는 로컬 Origin을 제거하는 실제 API 프록시와 사용자 선택 목록 fixture를 사용했으므로 배포 CORS·L6 계정 공급 인수와 구분한다. PROCESSING·KST 자정·입력/점수 경계는 자동 테스트로 검증했으며 실제 서버 처리 중 경합·실제 자정·10분 연속 UI 플레이는 미검증이다.

`hybridHandlers`의 gameHandlers 등록을 해제했다. 테스트·로컬 handlers는 고정 예제 fixture로 유지하며 임의 입력의 서버 판정을 증명하지 않는다. 제출 실패의 playId/playToken/원본은 사용자·게임별 메모리에 보존한다. 새로고침 후 복구는 지원하지 않으며 토큰을 영속 저장하지 않는다.

**판정: 사용자 게임 구현·실연동 검증 완료, 배포 인수 대기.** 관리자 AG01~AG03·변경/예약은 2026-10-22 BE 담당 답변으로 제공 범위 제외가 확정됐다(사용자 범위 조정 결정에 해당). 자동 머지·실제 배포는 수행하지 않았다.

근거: L4 계획 문서(완료 후 정리로 삭제 — Git 이력 참조), [API 성공 증거](superpowers/plans/L4-api-evidence.json), [API 오류 증거](superpowers/plans/L4-api-errors-evidence.json), [브라우저 증거](superpowers/plans/L4-browser-evidence.json), [인계](superpowers/plans/L4-handoff.md).

### 홈 배너

GD-255에서 사용자 B01 조회 훅·Zod 스키마와 홈 관리 이미지 슬라이더를 연결했다. `id/eventId/imageUrl/displayOrder`를 소비하고 서버 배열의 상대 순서를 유지한다. 연결 이벤트는 기존 `useEvent`로 조회해 `eventDetailPath`로 이동한다. B01에 제목·본문 필드를 추가하지 않았다. 빈 배열은 영역을 숨기고 목록·이미지·연결 이벤트 실패는 각각 안내한다.

**2026-10-20 이 세션의 사용자 승인으로 홈 최상단 B01 배치와 아래 기존 겟또타임 섹션으로 안내 통합을 확정했다.** 기존 AB01~AB05를 재사용하며 변경 성공 시 AB01·B01 쿼리를 함께 무효화한다. 순서 변경은 409 실패 후에도 재조회한다. 같은 QueryClient의 갱신과 다른 세션의 홈 재조회는 별개이며 전역 실시간 동기화는 제공하지 않는다.

2026-10-20 읽기 전용 실측에서 Vercel `/api/v1/banners`·`/admin/banners` 모두 200, 관리·사용자 각 5개와 같은 상대 순서를 확인했다. `demo-20261016/banner-01.svg` 등 이미지 키가 `https://dzc8oneey9mmx.cloudfront.net/images/` 아래 공개 URL로 변환됐다. 이미지 5개 모두 HEAD 200·`image/svg+xml`, Chromium에서 첫 공개 이미지가 실제 1200×400으로 디코딩됐다. 이는 현재 표본의 가용성 증거이며 SVG를 업로드 허용 형식으로 확정한 것이 아니다.

격리된 로컬 MSW 데이터에서 등록→수정→전체 순서 변경→삭제, 같은 세션 홈 무효화·다른 세션 재조회, 409 충돌 후 관리자 최신 목록, 최대 5개, null 이전 배너 수정, 이벤트 삭제·취소 사용자 숨김/관리자 보존을 검증한다. 실제 관리 목록이 이미 최대 5개이므로 기존 데이터를 변경하지 않았으며 **실서버 CRUD 통합 검증은 미실시**다. 업로드 API·형식·용량은 담당자 확인 대상으로 유지하고 폼의 임시 형식·5MB 안내는 제거했다.

로컬 Chromium에서 320/390px 가로 넘침 없음, 키보드 넘김·상세 이동, 44×44px 넘김 버튼과 포커스 링, 자동 재생·수동 조작 후 정지·동작 줄이기를 확인했다. 검증 명령과 최종 테스트 수는 GD-255 계획·증거 문서에 기록했다(완료 후 정리로 삭제 — Git 이력 참조).

근거: `entities/banner/api/queries.ts`, `features/manageBanner/api/queries.ts`, `widgets/bannerSlider/ui/BannerSlider.tsx`, `pages/home/HomePage.tsx`, [배너 계약](../../getddo-spec/05-api/banner.md).

### 관리자 사용자 조회

GD-250(`feat/GD-250`)에서 AO01/AO02 호출·화면을 `/admin/users`로 구현했다. 2026-10-20 배포 실측에서 검색 결과 13명·활성 일반 사용자 12명·빈 페이지 불변을 확인했다. 로컬 실서버 연결 화면에서 목록·필터·상세 서랍·403/404를 확인했다.

AO01은 `AdminUserList`의 `totalElements`와 `totalUserCount`를 분리한다. 후자는 목록 필터와 무관한 현재 ACTIVE USER 전체 수이며 AS01 참여율 분모에 사용한다. AO02에는 해당 수치를 추가하지 않는다. 개인정보 연락처·역할 변경·정지/해제 기능은 만들지 않았다. 가상 사용자 페이지(`/admin/virtual-users`)는 별도로 유지한다.

근거: `entities/user/api/admin.ts`, `pages/admin/users/AdminUsersPage.tsx`, `pages/admin/virtualUsers/AdminVirtualUsersPage.tsx`, `app/routes/adminRoutes.tsx`, [사용자 계약](../../getddo-spec/05-api/user.md).

## 나머지 완성 범위

- 응모권 T01/T02·관리자 이력/정합성, 출석 AT01~AT03, 미션 M01~M04, 이벤트·응모·공개 결과는 현재 호출 코드와 실서버 전달 경로가 있다. 실패·중복 요청·월말·4등급·권한까지 성공한 것으로 확대하지 않는다.
- 관리자 추첨은 GD-253에서 신계약(`drawType`, `execution.*`, `executions[]`)으로 정합화하고 실패 이력·실행 감사 조회, 단일 최초 발표(본문·멱등 헤더 없는 POST 1회)를 연결했다. 배포 `drawHandlers` 등록은 해제했다. 실제 응답의 DTO 표본 검증과 격리 이벤트 시나리오(C1~C6), 알림과 결과의 일치 검증은 BE 관리자 컨텍스트·시드 데이터를 받는 대로 수행한다 — 이 잔여는 L6 인수 검증 입력으로 이관돼 다른 로드맵 항목의 진행을 차단하지 않는다.
- 지급 전 차단은 AR01/AR02 계약이 2026-10-21 채택됐다(GD-141, 경로·필드·조회 기준). `entities/abuseCase`의 구 시연 필드는 GD-286(PR #126)에서 채택 계약으로 정렬했다. 2026-10-22 석종수 답변으로 세부가 확정됐다: ① 구현은 당일 완료·배포는 오후 수동 또는 익일 오전 CD 예정 ② evidence 필드 — `ruleVersion`(string), `triggerScope`(string: USER/EVENT), `windowStartedAt`·`windowEndsAt`(instant, UTC Z), `requestLimit`·`rejectedCount`·`rejectionThreshold`(int) ③ `triggerScope`는 두 기준 동시 충족 시 `USER`를 대표로 반환하고 이벤트 기준만 충족 시 `EVENT`로 기록 ④ 업무 오류 번호도 확정(문서 반영 작업 중) — 비관리자·비활성 관리자 접근 403 `ABUSE-001`, 상세 이력 없음 404 `ABUSE-002`, 사용자 헤더 누락·미등록·불일치는 기존 `USER-*`, UUID·날짜 형식 오류는 `COMMON-005`, 페이지·크기·필터 검증 실패는 `COMMON-002`, 예상 못한 DB 조회 실패는 `COMMON-001` ⑤ 기존 검토 데이터는 리셋 예정이라 조회 호환은 불필요. 2026-10-23 GD-317 배포 후 실측으로 AR01 목록·AR02 상세+evidence·필터·정렬·ABUSE-001/002가 계약대로 동작함을 확인했다 — 실데이터 10건 전부 `sourceType=ENTRY`·`triggerScope=USER`·`eventId=null` 표본이라 EVENT 기준·이벤트 연결 사례는 미관측으로 남긴다([증거](../reports/20261023-gd317-abuse-reads.json)).
- 관리자 응모 조회 AO06/AO07은 GD-250에서 `/admin/entries`로 구현·실측했다(응모 이력·이벤트별 참여자, 404 `ENTRY-004` 확인). 출석 정책 AP01~AP04, 미션 관리 AM01~AM04 FE 기능은 GD-259에서 구현했다. AP02/AP04·AM03의 실서버 쓰기 인수는 GD-261에서 실측했으나(아래) 성공 생성분이 운영에 잔존한다 — 2026-10-22 윤태형 확인으로 출석 정책 2건(다음 자정 일일·2026-11 연속)은 본인 수정 확인용 데이터로 원복 완료, `[TEST-GD261]` 이벤트 2건·미션은 정리 방법 확인 중이다. 개정된 검증 스크립트는 성공 생성을 실행하지 않고 보장된 중복 거절만 보낸다.
- 관리자 게임·보상 조건 관리는 2026-10-22 BE 전민규 답변으로 **제공 범위에서 제외**가 확정됐다 — "게임 연동과 실측 부분까지만 진행, 따로 게임 등록은 없는 걸로 진행". AG01~AG03과 규칙/상태 변경·보상 조건 예약은 구현하지 않으며, "변경은 다음 KST 기준일부터 적용" 이해는 담당자가 맞다고 확인했다(적용 대상 기능이 없으므로 참고 기록). L4의 관리자 게임 잔여는 범위 조정으로 해소됐다.
- 대시보드는 GD-250에서 AS01 일별 집계 단일 조회로 전환했다. 기존 7일×4조건 28회 + 요약용 추가 조회는 제거했고 실제 Network에서 `GET /v1/admin/stats/daily` 1회로 확인했다. AS01 채택 근거는 공용 명세의 담당자 확인이 아니라 사용자의 명시적 채택 확인이다. `blockedCount`는 화면에서 “어뷰징 탐지 기록”으로 표시하며 지급 차단 확정 건수로 표시하지 않는다. 참여율 분모는 현재 활성 일반 사용자 수다.
- `toEvent.ts`의 취소 상태 축약, E01/E06 전체 페이지 수집 실패 보존, 근거 없는 공정성·자동 취소 안내 정리는 GD-259에서 완료했다. 사용자 화면의 375px 모바일 검증은 2026-10-24 GD-341에서 실측했다(아래 절) — 실제 자정/월 경계·취소 반환·배포 인수가 남은 작업이다.

## 런타임 목업 종료 (GD-260, 2026-10-21 구현)

`feat/GD-260`에서 배포 런타임 목업을 종료했다. `hybridHandlers` 구분을 제거하고 `mocks/browser.ts`는 전체 `handlers`만 등록한다 — 로컬 개발·테스트 전용이다. `vercel.json` build.env의 `VITE_ENABLE_MSW=false`로 배포 빌드는 `app/main.tsx`에서 목업을 시작하지 않으며, 대신 과거에 설치된 우리 앱의 `mockServiceWorker.js`만 등록 해제한다(`app/config/serviceWorkerCleanup.ts`, 다른 앱의 Worker는 건드리지 않는다).

> 이후 변경: 서버가 닿지 않을 때(5xx·연결 실패·시간 초과)만 그 방문을 목업으로 시작하도록 바꿨다. 실서버가 응답하면 지금처럼 목업 없이 동작하고, 화면 바닥글에 데이터 출처를 표시한다 — 자세한 규칙은 [CONTEXT](CONTEXT.md)의 목업 항목.

- 시연 계정: `/virtual-users` HTTP 경로를 제거하고 `entities/user/model/virtualUsers.ts`가 `VITE_VIRTUAL_USERS_JSON`을 직접 읽는다. 미설정·형식 오류는 로그인 화면의 명시 안내이며 샘플 계정으로 자동 대체하지 않는다. Vercel 환경변수의 실제 등록 계정 JSON은 사용자 입력 대기다.
- `/admin/abuse-cases`는 목업 해제로 실서버를 그대로 받는다 — 2026-10-23 배포가 확인돼 GD-317 실측에서 200·계약 일치를 확인했다.
- 가상 시계는 배포에서 티커·`/admin/virtual-clock` 라우트·메뉴·오버라이드 저장을 모두 비활성화한다. 로컬 개발에서는 유지하며 화면에 “서버 일정은 바뀌지 않는다”를 명시한다.
- 테스트용 `mocks/server.ts`·`testSetup.ts`·fixture·로컬 전체 `handlers`는 유지한다. DB 시연 데이터 삭제는 포함하지 않는다.
- 남은 인수: 실제 등록 계정 JSON으로 재배포 후 전체 인수 시나리오 실행 — 구현 완료와 통합 인수·배포를 구분한다.

## 미확정·선행 확인

- 홈 배너 위치: GD-255 사용자 승인으로 최상단 B01·아래 겟또타임 섹션 통합을 확정했다. 별도 화면 담당자의 회신을 받은 것으로 표기하지 않는다.
- 최초 발표: GD-199는 PR #108로 병합·배포됐고 GD-253에서 단일 호출로 연결했다. 실제 응답(`isPublished`·revision·동일 재요청) 표본과 최초 공개→알림 통합 검증은 격리 이벤트(C1)를 받는 대로 확인한다.
- 추첨 실서버 기능 검증: BE에 관리자 컨텍스트와 시나리오 이벤트 C1~C6(미공개 확정·취소 가능 당첨·FAILED 2형태·취소·응모자 없음·응모자 소유 계정)를 요청한다.
- 차단 조회: AR01/AR02는 2026-10-21 경로·필드·조회 기준이 채택됐다(GD-141, [abuse 계약](../../getddo-spec/05-api/abuse.md)) — 기존 확인 요청 중 필드·`sourceType`/`detectionType` 값·닉네임/이벤트 제목·필터/정렬은 계약으로 해소했다. FE 스키마·화면·목업은 GD-286(PR #126)으로 채택 계약에 정렬했다. 2026-10-22 석종수 답변으로 잔여 4건 중 3건이 해소됐다 — 배포는 당일 오후 수동 또는 익일 오전 CD 예정, evidence 필드·`triggerScope` 규칙 확정(위 나머지 완성 범위 절 참조), 기존 데이터는 리셋 예정으로 호환 불필요. 업무 오류 번호도 확정됐다(403 `ABUSE-001`·404 `ABUSE-002` 신설, 나머지 기존 `USER-*`·`COMMON-*` 재사용). 2026-10-23 GD-317 실측 완료 — AR01·AR02 200+Zod, 기본 정렬·필터·빈 결과, `ABUSE-001`(USER)·`ABUSE-002`(없는 이력, 공개 메시지 일치)·`COMMON-002`(size·sourceType)·`COMMON-005`(UUID)·`USER-003` 전부 대조 통과. 관리자 화면 실데이터 렌더·상세 드로어 evidence·userId 필터도 배포본에서 확인([화면 증거](../reports/20261023-gd317-abuse-page.json)). ~~잔여 관측 제한: `triggerScope=EVENT`·이벤트 연결 표본은 현재 데이터에 없다.~~ → 2026-10-26 GD-352 재확인에서 `triggerScope=EVENT` 표본 1건을 확인했다 — evidence 계약 필드는 모두 존재하나 `eventId`·`eventTitle`이 null이라 이벤트 연결 여부는 담당자 질의로 남긴다(아래 GD-352 절·요청 R7).
- `PUBLICATION-002` 문구와 `DrawExecutionAudit` 표시는 2026-10-23 BE 회신·GD-314로 확정됐다 — 문구는 "추첨 결과가 아직 발표 가능한 상태가 아닙니다."로 FE 매핑·목업을 정렬했고, 감사 `action`은 `DRAW_EXECUTE`(추첨 실행)·`DRAW_RESUME`(추첨 재개) 두 값만 오며 처리자 UUID와 `beforeData`/`afterData`는 화면에서 숨긴다(`05-api/drawing.md` 실행 감사 표시 계약). 같은 GD-314에서 실패 복구 기준도 확정됐다 — 재시도 가능 분류(`TRANSIENT_STORAGE`·`INTERRUPTED`)는 최대 3회 자동 재시도를 10·30·60초 간격으로 예약하고, 그 구간의 네 번째 실패부터 다음 예약 없이 관리자 확인을 기다린다. 정합성·실행 불가·미분류 오류는 자동 재시도하지 않으며, 장애·재시도 소진만으로 이벤트·당첨을 자동 취소하지 않는다([실패 복구 기준](../../getddo-spec/02-domain/drawing.md#실패-복구와-관리자-판단)). FE는 서버 응답의 `retryAt`·`waitingForOperator`를 그대로 소비하며 재시도를 스스로 예약하지 않는다.
- AS01: 배포·집계 의미는 확인했고 GD-250에서 연결했다. 공용 명세의 “담당자 확인 전” 표시는 남아 있으므로 BE 담당자 확정 시 화면 문구를 대조한다. AM04 실측용 데이터는 2026-10-22 윤태형 답변으로 확보됐다 — 선택형 집계는 `[DEMO-20261016] 08 설문`(미션 `01a143a8-b6df-7cbd-a070-7a196e668677`, 응답 5건), 서술 답변(AM05)은 `[DEMO-20261016] 09 설문`(미션 `01a143a8-b6df-7557-b040-1b65deb194cb`·questionId `01a143a8-b6df-78eb-947e-2cccf4bcb83c`, 응답 3건; 대체 07 설문 미션 `01a143a8-b6df-73fa-9ec8-5e3d4f3fb668`·questionId `01a143a8-b6df-7c59-bc7f-409949111210`, 응답 2건). 조회 기간은 from=2026-10-16·to=2026-10-22(31일 제한 이내)이고 AM05는 questionId·from·to가 필수다. GD-296에서 실측 완료했다 — AM04 선택형 집계 일별·선택지 합계 각 5건(커피 쿠폰 5), AM05 주 3건·대체 2건 모두 BE 대조값과 일치(응답 200·Zod 통과, [증거](../reports/20261022-GD-296-remaining-reads.json)).
- 최초 자동 추첨 마감+1분(GD-268·ADR-026): 정책은 확정됐고 BE의 `fix/GD-268` PR #145는 머지·배포됐다. 아래 통합 인수 잔여 실측의 "마감+5분 자동 추첨"은 변경 전 관측이다 — GD-296 실측(2026-10-22)으로 관리자 이벤트 15건 전부 `drawScheduledAt - endsAt` = 60초를 확인해 신기준 배포 반영을 확인했다. FE는 서버 `drawScheduledAt`을 그대로 표시한다. 2026-10-23 재측정도 15건 전부 `delta=60초`였다(엔트리 청크 `index-Cv47TR7p.js`, [최초 증거](../reports/20261023-gd268-drawscheduledat.json), [정렬·배포 식별 재검증](../reports/20261023-gd268-drawscheduledat-review.json)).
- GD-269~271 → GD-282(PR #121)에서 예약 정책 수정 AP05·AP06, 설문 자유 서술 답변 AM05, 미션 `ENDED` 상태 표시를 FE에 연결했다. 배포 후 실측(GD-296, 2026-10-22): AM05 응답 200·대조값 일치, 종료 시각 경과 미션이 `ENDED`로 반영됨(필터 8건·잔여 ACTIVE 0, 서버 주기 처리 최대 약 1분 안내 문구 노출), AP05·AP06은 적용 중 정책 대상 동일값 PUT 각 1회로 409 `ATTENDANCE-007` 거절·무결성 확인. 미측정 잔여였던 AP06 200은 2026-10-24 GD-331에서 미래 `effectiveMonth` 예약 표본으로 실측했다 — AP05는 일일 예약 표본 부재로 미측정 유지다(아래 GD-331 절).
- 관리자 응답 이름 필드(ADR-028): 추첨·응모·알림·응모권 정합성·미션·출석 DTO에 `userName`·`actorName`·`createdByName` 등 표시용 현재 이름이 확정 계약으로 추가됐다. FE는 GD-287(PR #124)에서 스키마 선택 필드·null 표시로 선반영했고, BE는 GD-284(PR #153, 2026-10-22 병합·`main` 반영)로 구현을 완료했다. ~~배포 서버의 실제 응답 확인은 별도다~~ → **2026-10-26 GD-352 실측 완료** — 관리자 응모·알림·응모권 이력의 `userName`과 미션·출석 정책의 `createdByName`이 표본 전 건에 존재하고, 실행 감사의 `actorName`은 짝이 되는 ID 유무에 따라 값/null로 계약대로 온다(GD-284 배포 반영 확인, 아래 GD-352 절). 명세의 `common.md`·`drawing.md`·`notification.md`에 남은 "구현 예정" 표기는 각 담당자가 갱신한다.
- 플래티넘(`PLATINUM`): 등급·응모 경로 지원(GD-228), 추첨 가중치 10·스냅샷 호환(GD-230), 지급 활성화(GD-229, 확률 기본값 0.02%)가 BE `main`에 병합됐다(2026-10-23 명세 갱신). ~~개발 서버의 플래티넘 응모권은 2026-10-22 시점 0장이라 지급·응모·추첨의 실서버 동작과 FE 연동 검증은 미실시다~~ → **2026-10-26 GD-352 실측 완료** — 가상 계정 4명 전원이 PLATINUM을 보유하고 지급 이력·내 응모권·응모(201)·`/my-tickets`·`/time-raffle`·`/admin/tickets` 화면 표시를 실측했다(아래 GD-352 절). 추첨 가중치가 실제 결과에 반영되는지는 추첨 시나리오 표본이 필요해 별도다.
- 관리자 미션·출석 정책: GD-259 사용자 승인으로 새 메뉴/라우트·feature 구조를 확정해 구현했다. 기존 담당 경계는 유지하며 격리 실서버 예약/등록 인수가 남아 있다. (응모 조회 AO06/AO07은 GD-250에서 `/admin/entries`로 확정·구현됨)
- 관리자 게임: ~~AG01~AG03과 규칙·보상 조건 운영 범위, 진행 중 플레이 보호·다음 KST 기준일 적용 계약을 확정한다.~~ 2026-10-22 전민규 답변으로 관리자 게임 등록·운영은 제공 범위 제외로 확정 — 선행 확인 대상에서 해소. KST 기준일 적용 방향은 맞다고 확인받았으나 적용할 기능이 없다.
- 시연 계정: 공급 방식은 `VITE_VIRTUAL_USERS_JSON` 직접 읽기로 확정·구현했고, 실제 등록 6계정(USER 5·ADMIN 1)으로 로컬 실서버 검증을 완료했다. Vercel 환경변수에 실계정 JSON이 설정돼 현재 프로덕션 번들에 베이크돼 있고, 배포 후 검증에서 계정 목록 일치·실서버 응답을 확인했다. 쓰기·서버 일정 의존 인수는 GD-261에서 실측 완료했다(아래 GD-260 절) — 잔여는 INACTIVE 계정·추첨 실패 재개와 아래 미확정 항목(자정/월 경계 적용 관측 등)이다. AR01/AR02는 GD-317에서 배포 후 실측을 완료했다.
- 이미지: B01 공개 URL·현재 이미지 로딩은 확인했다. 실제 업로드 API·키 공급 절차·형식·용량과 격리 실서버 CRUD는 담당자 후속이며 B01 표시 구현과 구분한다.
- 결과 성능: 원 기획서의 화면 반영 p95 2초·알림 생성 30초 목표를 실제 발표 흐름에서 측정한다. 달성되지 않으면 개선 또는 명시적 범위 조정 없이 완료 처리하지 않는다.

위 사항은 [로드맵](superpowers/plans/2026-10-20-backend-integration-roadmap.md)의 선행 조건이다. 확인되지 않은 항목을 정상 0건·빈 배열·목업 성공으로 덮지 않는다.

## GD-259 L5 구현·검증

- 취소/대상 없는 종료/공개 상태, 전체 페이지 수집 실패 보존, 사용자 출석·미션의 중복/누적/멱등 처리와 AP01~AP04·AM01~AM04 운영 화면을 구현했다. 기존 GD-247 오류·429·표시 행 가드는 유지한다.
- AP01/AP03·AM01/AM02/AM04 및 사용자 조회의 실제 200·봉투·Zod, 일반 사용자 관리자 조회 403을 확인했다. 출석·단일 문항 퀴즈/설문은 실제 1장 지급과 동일 키/완료 재요청 추가 지급 0을 확인했다.
- E01 전체 24건·2요청·8,307바이트·122ms, E06 전체 6건·1요청·3,012바이트·31ms. 전체 합계/결과 필터를 위해 수집 범위를 유지한다. 조회 중 변하는 번호형 페이지를 원자적 스냅샷으로 보장하는 것은 아니다.
- 관리자 정책 정상 예약·실제 적용/409·미션 실제 등록의 실서버 인수는 GD-261 배포 쓰기 인수에서 실측했다(성공 생성분은 운영에 잔존, 아래 잔여 데이터 참조). 다문항·자정/월 경계의 실서버 적용 관측은 미실시다. 주입/목업 결과를 실제 서버 인수로 표시하지 않는다.
- [L5 검증 보고서](../reports/20261020-GD-259-L5.md)·[L5 인계](superpowers/plans/L5-handoff.md)에 로컬 검사, 실제 API/브라우저, L1~L4의 잔여와 L6 입력을 분리했다. 전체 L5 인수/배포 완료는 아니다.

## GD-260 L6 구현·검증

- `/virtual-users` 호출을 제거하고 `VITE_VIRTUAL_USERS_JSON` 직접 읽기로 전환했다. 샘플 자동 대체를 제거했고 미설정·형식 오류는 로그인의 명시 안내다. 사용자 전환은 기존 `sessionSync`의 전체 쿼리 리셋을 유지하며, 로그아웃 UI는 사용자 전환으로 대체하기로 승인됐다.
- `vercel.json`의 `VITE_ENABLE_MSW=false`, `main.tsx`의 `mockServiceWorker.js` 자동 해제, `hybridHandlers` 제거로 배포의 업무 가로채기를 종료했다. 가상 시계는 배포 비노출·오버라이드 무력화다.
- 검증: format/lint/test:ci(758)/build/diff --check 통과. 실제 등록 6계정으로 로컬 preview+실서버 프록시 검증 — 155건 전부 실서버 200·실제 UUID, `/virtual-users` 미호출, Worker 자동 해제, A→B 전환 시 B 헤더 재조회·A 요청 누수 0, 새로고침 세션 유지, 320/390px, 미설정 안내를 확인했다(`docs/superpowers/plans/L6-browser-evidence.json`).
- 업무 end-to-end 시나리오(적립→응모→추첨→발표→알림→취소 반환)는 GD-260 구현 시점 기준 미실시다 — GD-261 배포 인수(아래)에서 실측했다. [L6 통합 보고서](../reports/20261021-GD-260-L6.md)·[L6 인계](superpowers/plans/L6-handoff.md) 참조.
- 배포 후 검증(2026-10-21, GD-261): `getddo-fe.vercel.app` 실측 — 신규 세션 Worker 0건, 실제 `mockServiceWorker.js` 등록 재현 후 재진입 시 해당 Worker만 자동 해제(같은 origin의 다른 Worker 유지), 로그인 6계정 = 번들 env, `/virtual-users` 0건, 계정 선택→홈→이벤트 상세 실서버 GET 200·실제 업무 ID, A→B 전환 헤더 격리·누수 0, 새로고침 세션 유지, 가상 시계 비노출, 사용자 읽기 6페이지·관리자 읽기 11페이지 GET 200(`/admin/abuse-cases`만 의도된 404), 320/390px, 키보드, 오프라인→재연결, 200% 확대 실측(640 CSS px·DPR 2) 넘침 없음 — 총 34 checks·244 요청·쓰기 0건. [배포 후 검증 보고서](../reports/20261021-GD-261-L6-deploy-acceptance.md)·[증거 JSON](../reports/20261021-L6-deploy-evidence.json).
- 배포 쓰기 인수(2026-10-21, 사용자 승인·테스트사용자1): 출석 201→200 동일 영수증, QUIZ·SURVEY 완료+BRONZE 각 1장, 게임 4종 VALID(50/18/435/50) 보상 BRONZE 3·SILVER 1·중복 제출 동일 결과·ADMIN 403, BRONZE·SILVER 응모 201 ACCEPTED·멱등키 재시도 동일 영수증·새 키는 상한 내 별도 접수, PLATINUM 409 `TICKET-006` 잔액부족·`EVENT_NOT_OPEN` 409 `ENTRY-005` 마감 거절 — 잔액·이력 델타 전부 일치.
- 통합 인수 잔여 실측(2026-10-21, `[TEST-GD261]` 격리 데이터): 격리 이벤트 생성→응모→서버 마감+5분 자동 추첨(CONFIRMED, 자동 `DRAW_EXECUTE`, GD-268 변경 전 관측)→AD04 검증 5개 항목 통과→`result-confirmation` 발표→E08 마스킹(`테*****1`)·E09 WON→`RESULT_PUBLISHED` 잡 완료→사용자 알림 도착; 이벤트 취소→`refundedTicketCount:1` 원래 등급 반환→AO08·사용자 이력 일치; `ENTRY-006`·`ENTRY-007` 거절; 기존 데이터로 당첨 취소→REPLACEMENT 재추첨·재발표(revision 2) 확인; L3 배너 CRUD 전 과정·복원, L5 AP02/AP04/AM03 생성·검증·중복 거절; 429 실발동(`Retry-After:60`), p95 113/117ms. **미검증 잔여**: INACTIVE(DB 0건), ~~AR01/AR02~~(GD-317에서 배포 후 실측 완료 — 목록·상세·필터·오류 코드 전부 계약 일치), 추첨 실패 재개(실패 실행 없음), 자정/월 경계의 정책 적용 관측, ~~AP05·AP06 200~~(AP06은 GD-331 실측 완료, AP05는 일일 예약 표본 부재로 미측정 유지), `[TEST-GD261]` 잔여 데이터(이벤트 2건·미션 — 삭제 API 부재, 정리 확인 중. 출석 정책 2건은 10-22 원복 완료로 해소, 이에 따라 다음 자정 정책 적용 관측은 별도 데이터가 필요). ~~AG01~AG03·관리자 게임/보상 조건 운영~~은 2026-10-22 전민규 답변으로 제공 범위 제외 확정. ~~AM04 설문 집계 실측·GD-268 +1분 배포 반영·GD-282 배포 후 실측(AM05·ENDED·AP05/AP06 409)~~은 GD-296에서 실측 완료했다.

## GD-296 잔여 실측·저장소 정리 (2026-10-22)

- 배포본 `getddo-fe.vercel.app`의 읽기 실측은 AR01을 제외하고 전부 200·Zod 통과 — AM04 집계(일별·선택지 합계 5건), AM05 서술 답변(주 3건·대체 2건), AM01 `ENDED` 필터 8건·잔여 ACTIVE 0, AP01 3건·AP03 2건, GD-268 `drawScheduledAt-endsAt` 15건 전부 60초. AR01은 미배포로 404 유지(완료로 표시하지 않음), INACTIVE 표본 0건·추첨 실패 표본 없음·자정/월 경계 시점 미도래로 해당 항목은 관측 불가로 기록. AP05·AP06은 적용 중 정책 대상 동일값 PUT 1회씩으로 409 `ATTENDANCE-007`만 확인했고 200은 격리 데이터 부재로 미측정. 증거: [측정 보고서](../reports/20261022-GD-296-deployment-measurement.md)·[읽기 JSON](../reports/20261022-GD-296-remaining-reads.json).
- 배포본은 측정 시점 GD-295 미반영(엔트리 청크 `index-Dx52IYfp.js`, 구 상세 패널·영문 `ENDED`). 모달 접근성은 동일 커밋(`4b6ffd6`)의 로컬 빌드+실서버 프록시(`scripts/serveLocalRealApi.mjs`)로 대체 실측했다. ~~배포 갱신 후 재확인 필요~~ → 2026-10-24 GD-341에서 배포본(`index-C66o-cjo.js`) 재확인 완료(아래 GD-341 절).
- 저장소 잔여물: `feat-gd-294-stale`(미등록 폐기물)·`perf-gd-262`+`perf/GD-262`(PR #131 스쿼시 반영 확인)·`test-gd-264`+`test/GD-264`(PR #132 동일)·`gd262-baseline-dev`(detached)를 미커밋 0건·내용 동등 확인 후 제거. 잠금 원인은 stale `vite preview` 프로세스 2개였다.
- 메인 `dev`는 `origin/dev`보다 뒤처지며 미커밋 문서 변경과 겹쳐 pull을 보류했다 — 이 문서는 메인 트리 작업본을 기준으로 갱신했다.

## 관리자 화면 피드백 티켓 처리 결과 (2026-10-22 BE 피드백)

윤태형 피드백의 세 Jira 작업은 모두 dev에 머지됐다. Jira 양식과 실행 프롬프트는 [관리자 화면 피드백 티켓](superpowers/plans/2026-10-22-admin-feedback-tickets.md)에 있다.

- 티켓 A — 응모권 이력 화면 단일화: GD-293(PR #133)으로 완료. 정합성·지급·반환 탭을 제거하고 전체 이력(AO05)만 남겼으며, `?tab=` 기존 링크는 전체 이력으로 연다. AO03·AO04·AO08·AO09 전용 훅·테이블·목업은 화면 미사용으로 정리했다(계약 폐기 아님).
- 티켓 B — 출석 정책 현재/예약 재편: GD-294(PR #135)로 완료. 최신순 목록 대신 현재 정책 카드 + 예약 영역으로 재편했고, AP05·AP06 수정 다이얼로그는 GD-282 연결분을 유지한다.
- 티켓 C — 미션 상세 모달화: GD-295(PR #134)로 완료. MissionDetailPanel → MissionDetailDialog, 상태 한글, AM05 서술 답변 구역을 반영했고 GD-296에서 실서버 브라우저 실측했다 — role=dialog·aria-labelledby/describedby·구역 라벨·Tab 순서·포커스 가둠·ESC 닫힘·320px 전체 화면·기본 기간 자동 집계 전부 확인, 콘솔 오류 0. 닫힘 후 포커스가 트리거로 복귀하지 않는 결함 1건은 GD-296에서 트리거 ref 복원으로 수정했다. 배포본은 측정 시점 GD-295 미반영(구 패널·영문 상태)이었으나 2026-10-24 GD-341에서 최신 배포본(`index-C66o-cjo.js`)으로 재확인했다 — role=dialog·aria-labelledby/describedby·한글 상태·ESC 닫힘·닫기 버튼·재오픈·트리거 포커스 복귀·375px 전체 화면 전부 통과(아래 GD-341 절).

## GD-330 미실측 표본 재확인 (2026-10-23)

배포본을 읽기 전용(GET만, 쓰기 0건)으로 순회해 잔여 표본의 존재 여부를 재확인했다([스크립트](../scripts/verifyGd330SpecSamples.py), [증거](../reports/20261023-gd330-spec-samples.json)):

- **표본 확보**: 응모권 이력에 실물 GOLD 2건·PLATINUM 87건이 존재한다(기존 "플래티넘 0장" 기록 갱신). 연속 출석 정책에 미래 `effectiveMonth` 예약 1건이 있어 AP06 200의 관측 대상이 생겼다(AP05는 일일 예약 표본이 여전히 없다) — 다만 200 측정 자체는 예약 수정 PUT이라 읽기 범위를 넘어 미측정으로 남겼다(2026-10-24 GD-331에서 사용자 쓰기 승인으로 AP06을 실측, 아래 절).
- **표본 부재 유지**: abuse-case 10건 전부 `triggerScope=USER`(EVENT 기준 사례 없음), 관리자 사용자 전원 `ACTIVE`(INACTIVE 0건), 이벤트 58건의 추첨 실행 60건이 `CONFIRMED 44`·`NO_ENTRIES 16`으로 실패 실행 없음(실패 재개 미검증 유지).
- **알림 목록 배포 확인**: 사용자 알림 목록은 FE 계약 경로 `GET /v1/notifications/me`로 200 — 총 23건·표본 20건 전부 이벤트 연결(eventId)·미읽음 7건. 최초 측정의 404는 미사용 경로(`/v1/notifications`)를 호출한 측정 오류였으며, 알림 통합의 목록 관측은 가능해졌다(도착 트리거 연동은 별도 시나리오). 2026-10-24 GD-331에서 목록·필터·커서 페이징·개별 읽음·`linkUrl` 이동·빈 목록을 실측했고, 발표→알림 생성 도착의 트리거 연동만 남는다(아래 절).
- 자정/월 경계 적용 관측은 여전히 시점 의존이며, 배너 CRUD는 쓰기 인수(GD-261)에서 이미 실측됐으므로 재측정하지 않았다.

## GD-331 AP06 200 실측·알림 통합 관측 (2026-10-24)

사용자 승인 쓰기 3건(AP06 수정·원복 PUT 2회, N02 읽음 PUT 1회)과 읽기 관측을 배포본에서 수행했다(엔트리 청크 `index-DRCSlZyx.js`로 최신 배포 확인):

- **AP06 200 실측 완료**: 관리자 출석 정책 화면의 '예약된 변경' 수정 다이얼로그로 2026-11 연속 정책 묶음을 두 번 수정했다(28일 마일스톤 보상 7→8, 확인 후 8→7 원복). 두 PUT 모두 200·`{success, code:SUCCESS, message}` 봉투와 `effectiveMonth`·`milestones(milestoneDays·rewardTicketCount)` 값·`id`/`createdByName`/`createdAt` 존재를 대조했다(마일스톤 `id`·`createdBy` 불변 대조는 스크립트 보강으로 추가 — 기록된 증거에는 불린 대조가 없다). `effectiveMonth`와 마일스톤 구성(일수·보상·개수)은 원복 후 GET 재조회로 원본(7→1/14→3/28→7)과 일치함을 확인했고, 화면 예약 카드가 각 변경을 즉시 반영했다. 스크린샷은 `reports/gd331-ap06/`, 증거는 [AP06 JSON](../reports/20261024-gd331-ap06-streak-update.json)·[스크립트](../scripts/verifyGd331Ap06Update.py).
- **AP05는 미측정 유지**: 일일 정책 3건 전부 적용 중·과거라 미래 예약 표본이 없다. 표본을 만드는 AP02 생성은 예약 삭제 API가 없어 영구 잔존하므로 수행하지 않았다 — 표본이 생기면 같은 절차로 측정한다.
- **알림 N01 읽기 실측**: API로 커서 페이징을 추적했다(size=5, 5쪽·23건, `nextCursor` 종단까지, `createdAt` 내림차순·id 중복 0·`totalElements` 일치). `isRead` 필터는 false 7·true 16·합계 23으로 대조 일치하고 필터 결과는 전부 미읽음이었다. UI에서는 드로어의 미읽음 배지(`알림, 읽지 않음 N개`)·'읽지 않음 N개' 문구·목록 렌더와 `/my-notifications`의 번호 페이징(2쪽 이동 시 서버 커서 추적 요청 확인)·'읽지 않음' Segmented 필터(요청 `isRead=false`, 표시 6건=미읽음 잔여)를 확인했다.
- **N02 읽음 전이 실측**(승인 1건): 미읽음 알림 1건 클릭 → `PUT /v1/notifications/{id}/read` 200·`{id, isRead:true}` 봉투 → `linkUrl`로 내부 이동(클릭한 알림은 `/events/{id}` 계열 → 래플 이벤트라 `EventDetailPage`가 `/time-raffle/{id}`로 안내) → 무효화 재조회로 벨 미읽음 7→6 감소.
- **빈 목록 상태**: 알림 0건인 ADMIN 계정으로 사용자 화면(`/my-notifications`)에 접근해 '새 알림이 없어요' 빈 상태와 '모두 읽었어요' 문구를 확인했다(UserGuard는 로그인 여부만 본다).
- **잔여 관측 불가**: 발표→알림 생성 도착의 트리거 연동은 서버 이벤트 없이 유발할 수 없어 미관측으로 남긴다. N03 전체 읽음은 이번 쓰기 승인 범위 밖이라 미측정이다.
- 증거: [알림 JSON](../reports/20261024-gd331-notifications.json)·[스크립트](../scripts/verifyGd331Notifications.py)·스크린샷 `reports/gd331-notifications/`. 콘솔 오류 0건.

## GD-335 DB 일시 장애(503 `COMMON-007`) 대응 (2026-10-24)

운영 DB 이중화 전환 동안 백엔드가 DB 연결 장애에 503 `COMMON-007`(`DB_TEMPORARILY_UNAVAILABLE`)을 반환한다(공개 메시지 "일시적으로 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.", `data=null`, `Retry-After` 비필수 — BE PR #176, 명세상 운영 미반영). `common.md`는 "503은 미저장의 증거가 아니다"를 명문으로 둔다 — 커밋 후 응답만 유실될 수 있으므로 응모·미션은 같은 사용자·대상·키·본문으로 재시도한다.

- **수정 전 결함**: `useEnterEvent`의 `onError`가 응답이 있는 모든 오류(4xx·5xx)에서 멱등키를 초기화했다 — 503 수신 후 재시도가 새 키로 가 중복 차감 가능했다.
- **수정**: 4xx(저장 확정 거절)에서만 키를 초기화하고 5xx·무응답(네트워크·timeout)은 키·본문을 유지 — `useSubmitMission`의 기존 분기와 같은 기준이다. `useSubmitMission`·`CancelWinDialog`·`mutations.retry: 0`(자동 재전송 없음)은 변경 전부터 부합했다.
- **문구**: `errorMessage.ts`에 `COMMON-007`·`DB_TEMPORARILY_UNAVAILABLE` 매핑을 추가했다 — 5xx는 서버 문구를 신뢰하지 않으므로 매핑이 없으면 공통 기본 문구로 떨어졌다.
- **잔여**: 실서버 503 표본은 운영 배포 전이라 목업·단위 테스트 수준 검증이 한계다 — 장애 시험 완료를 뜻하지 않는다. 응모는 429(4xx)에 키를 초기화하고 미션은 429에 키 유지+대기로 다른 점이 의도인지 ADR-0005 갱신에 명시했다(응모의 429는 멱등키 저장 전에 차단되므로 새 키 재시도가 안전).

## GD-341 배포본 재검증 — GD-295 미션 모달·미션 제출·모바일 사용자 화면 (2026-10-24)

배포본(`index-C66o-cjo.js`, GD-340 머지 후 최신)을 Playwright로 실측했다. 쓰기는 승인된 미션 제출 POST 정확히 1회(테스트사용자1, QUIZ 미션, 201)이며 그 외 쓰기 0건이다. 증거: [JSON](../reports/20261024-gd341-deploy-verification.json)·[스크립트](../scripts/verifyGd341Deploy.py)·스크린샷 `reports/gd341/`.

- **미션 상세 모달(GD-295) 배포 실측 완료**: `/admin/missions` 상세 → `role="dialog"`·aria-labelledby/describedby·'미션 상세' 제목·한글 상태 라벨·ESC 닫힘·닫기 버튼·재오픈·닫힘 후 트리거 버튼 포커스 복귀 전부 통과. 375px에서는 전체 화면(375×812)·가로 넘침 0·ESC 닫힘.
- **미션 제출 플로우**: QUIZ 미션 상세에서 OX 답 선택 → 제출 → 201·완료·보상 신호 확인.
- **503 안내 문구(GD-335)**: 제출 POST를 프록시 계층에서 503 `COMMON-007`로 차단 시 토스트에 "일시적으로 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요."가 표시되고 '원본 답변으로 결과 다시 확인' 버튼이 뜬다. 차단 해제 후 재시도는 **같은 `Idempotency-Key`**로 전송돼 실제 201을 받았다 — 5xx에서 키 유지 동작을 배포본에서 확인. 실서버가 돌리는 실 503 표본은 여전히 미관측(운영 배포·장애 시험 전).
- **모바일 375px 사용자 화면 13경로 실측**: `/`, `/events`, `/events/:id`, `/events/:id/results`, `/time-raffle`, `/time-raffle/:id`, `/missions`, `/missions/:id`, `/missions/games/:id`, `/my-tickets`, `/my-entries`, `/my-notifications`, `/mypage` — **가로 넘침 전부 0px**, 페이지 오류(pageerror) 0건. 햄버거 메뉴 탭 → '이벤트' 링크 탭 이동으로 터치 동작 확인. 관리자 화면의 375px 점검은 GD-317/GD-328 기준(320px 넘침 해소)이며 나머지 관리자 화면은 미점검으로 남긴다.
- ~~**발견 이슈 — 24px 미만 터치 대상**~~: WCAG 2.5.8 기준 미달 컨트롤은 GD-353에서 전부 해소했다(아래 GD-353 절의 재측정 표 참조).
- **관측 한계**: Playwright 모바일 컨텍스트에서 `ERR_INSUFFICIENT_RESOURCES` 콘솔 오류가 다수 발생했다 — 앱 오류가 아니라 도구의 리소스 한계이며 pageerror·4xx/5xx 업무 응답은 없었다. `/my-tickets` 네트워크 유휴 대기가 길어 보조 관측에서 goto 타임아웃 1회(본 스윕에서는 통과) — 폴링·긴 요청의 영향일 가능성이 있다.

## GD-352 통합 검증 잔여 정리 (2026-10-26)

배포본(`getddo-fe.vercel.app`, 엔트리 청크 `index-CfMwQGNi.js`)을 읽기 위주로 재측정하고 사용자 승인 쓰기 3건(N02 PUT 1회·N03 PUT 1회·E04 PLATINUM POST 1회, 모두 테스트 계정)을 실행했다. 증거: [읽기 JSON](../reports/20261026-gd352-remaining-reads.json)·[쓰기 JSON](../reports/20261026-gd352-approved-writes.json)·[화면 JSON](../reports/20261026-gd352-platinum-screen.json)·스크린샷 `reports/gd352-platinum/`·스크립트 `scripts/verifyGd352RemainingReads.py`·`verifyGd352ApprovedWrites.py`·`verifyGd352PlatinumScreen.py`.

- **관리자 응답 이름 필드 실측 완료(ADR-028)**: 관리자 응모·알림·응모권 이력 표본 100건씩 `userName` present, 미션·출석 정책 `createdByName` present, 실행 감사 `actorName` present 4·null 6(ID null이면 이름 null인 계약과 일치) — GD-284 배포 반영 확인.
- **PLATINUM 실측 완료**: 관리자 응모권 이력 PLATINUM 72/100건, 가상 USER 4명 전원 보유. 승인 쓰기로 OPEN 가중치 이벤트에 `{"tickets":{"PLATINUM":1}}` 응모 201·잔량 1000→999 차감을 확인했다. `/my-tickets`·`/time-raffle` 상세·`/admin/tickets`에서 플래티넘 표시를 배포본 스크린샷으로 확인했다. 추첨 가중치 반영은 추첨 시나리오 표본 대기.
- **abuse `triggerScope=EVENT` 표본 신규 확인**: AR02 상세 11건 중 EVENT 1건 — evidence 필드(ruleVersion·triggerScope·windowStartedAt/EndsAt·requestLimit·rejectedCount·rejectionThreshold) 전부 존재. 단 `eventId`·`eventTitle`이 null이라 이벤트 연결 계약 충족 여부는 담당자 질의로 남긴다(요청 R7).
- **N02·N03 실측 완료**: 미읽음 최소 계정(user0, 8건)에서 개별 읽음 PUT 200·`isRead:true`·미읽음 8→7, 전체 읽음 PUT 200·`updatedCount:7`·미읽음 7→0을 대조했다.
- **미관측 유지**: INACTIVE 사용자(100명 전원 ACTIVE), 추첨 FAILED 실행(72건 전부 CONFIRMED 54·NO_ENTRIES 18), AP05 대상 일일 미래 예약 표본(AP01 3건 전부 적용 중·과거 — 연속 정책의 미래 `effectiveMonth` 1건은 AP06 측정 대상으로 이미 소비됨).
- **잔여 이관**: 추첨 시나리오 C1~C6·발표→알림 트리거·503 `COMMON-007` 장애 시험·배너 실서버 CRUD+업로드 계약·`[TEST-GD261]` 정리·INACTIVE/FAILED 표본·배송 정보 계약(product-context 범위 제외 표기와 WinnerBanner TODO의 충돌 — FE 버튼·TODO는 GD-353에서 제거, 계약 확정 자체는 R8 대기 유지)·자정/월 경계 관측·결과 성능 측정·AP05 일일 예약 표본은 [BE 요청 문구](superpowers/plans/2026-10-26-gd352-be-requests.md)로 정리했다. Speed Insights 누적은 사용자가 Vercel 대시보드에서 확인한다.

## GD-353 FE 잔여 해소 — 배송 버튼·터치 대상·GAME 문구·관리자 목업 (2026-10-26)

GD-352/GD-341 실측에서 남은 FE 자체 해결 항목을 `feat/GD-353`에서 처리했다. 검증: `format:check`·`lint`(경고 0)·`test:ci`(924개)·`build` 전부 통과, 브라우저 실측은 로컬 dev+MSW(Chrome DevTools, 페이지 단위 `getBoundingClientRect`) 기준.

- **배송 정보 버튼 제거**: `WinnerBanner`의 disabled '배송 정보 입력하기' 버튼과 TODO를 제거하고 '가입하신 연락처로 따로 보내 드려요' 안내 문구는 유지했다. 320·375·1280px에서 배너 렌더·가로 넘침 0·버튼 부재를 확인했다. 수령 정보 계약 자체는 R8로 BE 확정 대기를 유지한다 — 계약이 생기면 버튼을 되돌린다.
- **터치 대상 24px(WCAG 2.5.8) 해소 — 375px 재측정**:

    | 경로                                                  | 대상                                             | 수정 전 | 수정 후                           |
    | ----------------------------------------------------- | ------------------------------------------------ | ------- | --------------------------------- |
    | `/time-raffle`                                        | 캐러셀 이전·다음 버튼                            | 20×20   | 24×24                             |
    | `/time-raffle`                                        | 응모권 등급 안내 버튼                            | 16×16   | 24×24                             |
    | `/missions`                                           | 응모권 등급 안내 버튼                            | 16×16   | 24×24                             |
    | `/missions`                                           | '내역' 텍스트 링크                               | ~42×22  | 42.2×26                           |
    | `/missions`                                           | '전체보기' 텍스트 버튼(`size="text"`)            | ~72×20  | 72×25.6                           |
    | mission-detail·my-tickets·my-entries·my-notifications | 뒤로가기·모두 읽음·재시도·행 링크 등 보조 컨트롤 | 18~22px | 전부 24px 이상(스윕에서 미달 0건) |

    아이콘 그림 크기는 그대로 두고 패딩·최소 크기·음수 마진으로 누름 칸만 키웠다. 미션 상세의 라디오 점(20×20)은 실제 포인터 대상이 감싸는 label 카드(327×53)라 WCAG 2.5.8 '동등 대상' 예외로 남겼다.

- **GAME 오류 문구 매핑**: `errorMessage.ts`에 GAME-001~008을 추가했다 — 게임 플레이 화면이 쓰는 공개 문구와 같은 문장이다. GAME-004는 '아직 지원하지 않는 게임입니다' 별도 분기가 없어 오류 경로에서 매핑 문구("상세 정보를 제공할 수 없는 게임입니다.")를 보여 준다.
- **관리자 목업 보강(로컬 전용)**: MSW에 AM01~AM03(미션 관리 목록·상세·등록)과 AP01·AP03(출석 일일·연속 정책 목록)을 추가했다 — `/admin/missions`·`/admin/attendance-policies`가 로컬에서도 목업 데이터를 표시한다. AM04 설문 집계·AM05 자유 서술 답변은 아직 미커버로, 상세 시트의 집계 패널만 로컬에서 조회 실패로 보인다. 배포 빌드는 `VITE_ENABLE_MSW=false`라 영향 없다.
- **`entities/event` TODO 정리**: 주석을 현행 계약·구현 상태로 고쳤다 — `detailImageUrl`은 R4 대기 표기, `myEntryCount`·`myTicketCount`는 `useMyEventEntries` 계산 경로가 구현 완료임을 명시, `eventType` 전환은 계약 영향 별도 작업으로 표기했다(실제 전환 없음).
