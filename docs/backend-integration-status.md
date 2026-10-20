# 백엔드 연동 현황

## 확인 기준과 한계

- 확인일: 2026-10-21.
- FE: 원격 dev `92583c3`(GD-259 PR #110 MERGED) + `feat/GD-260` L6 작업본. GD-260의 원격 발행·머지·배포는 아직 없다.
- 공용 명세: `main`의 `bbbe811` + `3cb9fcc`(추첨 API의 병합·배포 상태 표기 최신화). 원격 갱신 후 `origin/main`과 차이 0건을 확인했다.
- 이번 확인은 공용 명세·실제 소스·Git 이력 대조와 2026-10-20 배포 라우팅 실측(추첨 경로 401/405·USER-002, `/admin/abuse-cases` 404)을 함께 반영한다.
- 팀 전달의 “백엔드 구현 완료”는 실행의 출발점이다. 배포 환경·메서드·DTO·권한·쓰기 재시도가 맞는지 별도로 확인해야 한다.
- 상태를 계약 채택, FE 호출 구현, 배포 실측, 통합 검증으로 구분한다. 아래 “실서버 전달”은 하이브리드 목업에 해당 핸들러가 없고 호출 코드가 있다는 의미다.

## 팀이 요청한 다섯 항목

### 결과 알림

N01 목록·N02 개별 읽음·N03 전체 읽음과 AN01~AN05 관리자 알림 운영은 호출 코드가 있고 하이브리드 목업 대상이 아니다. `NotificationItem`과 알림 드로어에는 결과 링크 처리도 있다.

GD-253에서 최초 발표(`result-confirmation`) 호출이 연결됐고 관리자 추첨 목업의 배포 등록이 해제됐다. 따라서 “알림 UI/API 연결·최초 발표 호출은 구현됨, 실제 공개→알림 생성→읽음→결과 이동의 통합 검증은 남음(BE 격리 이벤트 데이터 대기)”으로 판정한다. 알림 전체가 완료됐다고 단정하거나 이미 있는 드로어를 재구현하지 않는다.

근거: `entities/notification/api/queries.ts`, `features/markNotificationRead/api/queries.ts`, `entities/adminNotification/api/queries.ts`, `features/retryAdminNotification/api/queries.ts`, `widgets/notificationBell/`, `features/runDraw/api/queries.ts`.

### 게임 연결과 게임 기록

GD-257에서 G01 요약·G02 상세·G05 누적 통계를 분리하고 UUID 요청·code 선택, G03 시작→G04 원본 입력 제출을 연결했다. 색깔 answers, 타꼬런 120Hz endTick/inputs, 타이밍 누른 순간 정수 ms taps, 주문 rounds/picks를 기록한다. 임시 dailyLimit/remainingPlays·오늘 플레이 횟수·비계약 `/play`를 제거했다.

네 게임 모두 실제 API에서 VALID·동일 재제출·보상·G05·T01/T02를 대조했다. 색깔 50점·주문 18점·타이밍 50점·타꼬런 451점이 FE 계산과 일치했고 각 게임에서 1장 지급을 확인했다(BRONZE/SILVER 실물 표본). 네 게임 기준 미달 reward=null·미완료 INVALID와 통계 미반영, 404 GAME-005·409 GAME-006·413 GAME-008·429 COMMON-006 및 Retry-After 59초 뒤 동일 요청 성공을 확인했다. ADMIN은 네 게임 시작 201·결과/통계 403이다.

MSW 없는 로컬 preview 브라우저에서도 네 게임을 실제 입력으로 종료해 VALID를 확인했다. 타이밍 결과 응답 유실 후 같은 playId·입력으로 재시도했고 내 응모권 화면을 조회했다. 브라우저는 로컬 Origin을 제거하는 실제 API 프록시와 사용자 선택 목록 fixture를 사용했으므로 배포 CORS·L6 계정 공급 인수와 구분한다. PROCESSING·KST 자정·입력/점수 경계는 자동 테스트로 검증했으며 실제 서버 처리 중 경합·실제 자정·10분 연속 UI 플레이는 미검증이다.

`hybridHandlers`의 gameHandlers 등록을 해제했다. 테스트·로컬 handlers는 고정 예제 fixture로 유지하며 임의 입력의 서버 판정을 증명하지 않는다. 제출 실패의 playId/playToken/원본은 사용자·게임별 메모리에 보존한다. 새로고침 후 복구는 지원하지 않으며 토큰을 영속 저장하지 않는다.

**판정: 사용자 게임 구현·실연동 검증 완료, 배포 인수 대기. L4 전체 완료는 아니다.** 관리자 AG01~AG03·변경/예약은 여전히 미확정이며 구현하지 않았다. 관리자 운영의 확정 계약 또는 사용자 범위 조정 결정이 필요하다. 자동 머지·실제 배포는 수행하지 않았다.

근거: [L4 계획](superpowers/plans/2026-10-20-GD-257-game-integration.md), [API 성공 증거](superpowers/plans/L4-api-evidence.json), [API 오류 증거](superpowers/plans/L4-api-errors-evidence.json), [브라우저 증거](superpowers/plans/L4-browser-evidence.json), [인계](superpowers/plans/L4-handoff.md).

### 홈 배너

GD-255에서 사용자 B01 조회 훅·Zod 스키마와 홈 관리 이미지 슬라이더를 연결했다. `id/eventId/imageUrl/displayOrder`를 소비하고 서버 배열의 상대 순서를 유지한다. 연결 이벤트는 기존 `useEvent`로 조회해 `eventDetailPath`로 이동한다. B01에 제목·본문 필드를 추가하지 않았다. 빈 배열은 영역을 숨기고 목록·이미지·연결 이벤트 실패는 각각 안내한다.

**2026-10-20 이 세션의 사용자 승인으로 홈 최상단 B01 배치와 아래 기존 겟또타임 섹션으로 안내 통합을 확정했다.** 기존 AB01~AB05를 재사용하며 변경 성공 시 AB01·B01 쿼리를 함께 무효화한다. 순서 변경은 409 실패 후에도 재조회한다. 같은 QueryClient의 갱신과 다른 세션의 홈 재조회는 별개이며 전역 실시간 동기화는 제공하지 않는다.

2026-10-20 읽기 전용 실측에서 Vercel `/api/v1/banners`·`/admin/banners` 모두 200, 관리·사용자 각 5개와 같은 상대 순서를 확인했다. `demo-20261016/banner-01.svg` 등 이미지 키가 `https://dzc8oneey9mmx.cloudfront.net/images/` 아래 공개 URL로 변환됐다. 이미지 5개 모두 HEAD 200·`image/svg+xml`, Chromium에서 첫 공개 이미지가 실제 1200×400으로 디코딩됐다. 이는 현재 표본의 가용성 증거이며 SVG를 업로드 허용 형식으로 확정한 것이 아니다.

격리된 로컬 MSW 데이터에서 등록→수정→전체 순서 변경→삭제, 같은 세션 홈 무효화·다른 세션 재조회, 409 충돌 후 관리자 최신 목록, 최대 5개, null 이전 배너 수정, 이벤트 삭제·취소 사용자 숨김/관리자 보존을 검증한다. 실제 관리 목록이 이미 최대 5개이므로 기존 데이터를 변경하지 않았으며 **실서버 CRUD 통합 검증은 미실시**다. 업로드 API·형식·용량은 담당자 확인 대상으로 유지하고 폼의 임시 형식·5MB 안내는 제거했다.

로컬 Chromium에서 320/390px 가로 넘침 없음, 키보드 넘김·상세 이동, 44×44px 넘김 버튼과 포커스 링, 자동 재생·수동 조작 후 정지·동작 줄이기를 확인했다. 검증 명령과 최종 테스트 수는 [GD-255 계획·증거](superpowers/plans/2026-10-20-GD-255-home-banner.md)에 기록한다.

근거: `entities/banner/api/queries.ts`, `features/manageBanner/api/queries.ts`, `widgets/bannerSlider/ui/BannerSlider.tsx`, `pages/home/HomePage.tsx`, [배너 계약](../../getddo-spec/05-api/banner.md).

### 관리자 사용자 조회

GD-250(`feat/GD-250`)에서 AO01/AO02 호출·화면을 `/admin/users`로 구현했다. 2026-10-20 배포 실측에서 검색 결과 13명·활성 일반 사용자 12명·빈 페이지 불변을 확인했다. 로컬 실서버 연결 화면에서 목록·필터·상세 서랍·403/404를 확인했다.

AO01은 `AdminUserList`의 `totalElements`와 `totalUserCount`를 분리한다. 후자는 목록 필터와 무관한 현재 ACTIVE USER 전체 수이며 AS01 참여율 분모에 사용한다. AO02에는 해당 수치를 추가하지 않는다. 개인정보 연락처·역할 변경·정지/해제 기능은 만들지 않았다. 가상 사용자 페이지(`/admin/virtual-users`)는 별도로 유지한다.

근거: `entities/user/api/admin.ts`, `pages/admin/users/AdminUsersPage.tsx`, `pages/admin/virtualUsers/AdminVirtualUsersPage.tsx`, `app/routes/adminRoutes.tsx`, [사용자 계약](../../getddo-spec/05-api/user.md).

## 나머지 완성 범위

- 응모권 T01/T02·관리자 이력/정합성, 출석 AT01~AT03, 미션 M01~M04, 이벤트·응모·공개 결과는 현재 호출 코드와 실서버 전달 경로가 있다. 실패·중복 요청·월말·4등급·권한까지 성공한 것으로 확대하지 않는다.
- 관리자 추첨은 GD-253에서 신계약(`drawType`, `execution.*`, `executions[]`)으로 정합화하고 실패 이력·실행 감사 조회, 단일 최초 발표(본문·멱등 헤더 없는 POST 1회)를 연결했다. 배포 `drawHandlers` 등록은 해제했다. 실제 응답의 DTO 표본 검증과 격리 이벤트 시나리오(C1~C6), 알림과 결과의 일치 검증은 BE 관리자 컨텍스트·시드 데이터를 받는 대로 수행한다 — 이 잔여는 L6 인수 검증 입력으로 이관돼 다른 로드맵 항목의 진행을 차단하지 않는다.
- 지급 전 차단은 AR01/AR02 계약 미확정이다. GD-260에서 배포 목업을 제거했으므로 `/admin/abuse-cases`는 실서버 404를 표시한다. 필드·판정 근거는 담당자 확인 후 연결해야 하며 화면의 오류를 정상 지표로 읽지 않는다.
- 관리자 응모 조회 AO06/AO07은 GD-250에서 `/admin/entries`로 구현·실측했다(응모 이력·이벤트별 참여자, 404 `ENTRY-004` 확인). 출석 정책 AP01~AP04, 미션 관리 AM01~AM04 FE 기능은 GD-259에서 구현했다. AP02/AP04·AM03의 격리 실서버 쓰기 인수는 남아 있으며, 남은 인수를 완료 전에 프로젝트 완료 조건에서 누락하지 않는다.
- 관리자 게임·보상 조건 관리도 기능 요구사항에 포함된다. AG01~AG03 및 규칙/상태 변경·보상 조건 예약은 상세 계약이 남아 있다. L4에서 담당자와 최소 운영 범위를 확정해 연결하거나 사용자에게 범위 조정을 받아야 하며, 사용자 게임 4종 연결만으로 전체 게임 운영을 완료 처리하지 않는다.
- 대시보드는 GD-250에서 AS01 일별 집계 단일 조회로 전환했다. 기존 7일×4조건 28회 + 요약용 추가 조회는 제거했고 실제 Network에서 `GET /v1/admin/stats/daily` 1회로 확인했다. AS01 채택 근거는 공용 명세의 담당자 확인이 아니라 사용자의 명시적 채택 확인이다. `blockedCount`는 화면에서 “어뷰징 탐지 기록”으로 표시하며 지급 차단 확정 건수로 표시하지 않는다. 참여율 분모는 현재 활성 일반 사용자 수다.
- `toEvent.ts`의 취소 상태 축약, E01/E06 전체 페이지 수집 실패 보존, 근거 없는 공정성·자동 취소 안내 정리는 GD-259에서 완료했다. 실제 자정/월 경계·취소 반환·일부 모바일 화면 검증·배포 인수는 남은 작업이다.

## 런타임 목업 종료 (GD-260, 2026-10-21 구현)

`feat/GD-260`에서 배포 런타임 목업을 종료했다. `hybridHandlers` 구분을 제거하고 `mocks/browser.ts`는 전체 `handlers`만 등록한다 — 로컬 개발·테스트 전용이다. `vercel.json` build.env의 `VITE_ENABLE_MSW=false`로 배포 빌드는 `app/main.tsx`에서 목업을 시작하지 않으며, 대신 과거에 설치된 우리 앱의 `mockServiceWorker.js`만 등록 해제한다(`app/config/serviceWorkerCleanup.ts`, 다른 앱의 Worker는 건드리지 않는다).

- 시연 계정: `/virtual-users` HTTP 경로를 제거하고 `entities/user/model/virtualUsers.ts`가 `VITE_VIRTUAL_USERS_JSON`을 직접 읽는다. 미설정·형식 오류는 로그인 화면의 명시 안내이며 샘플 계정으로 자동 대체하지 않는다. Vercel 환경변수의 실제 등록 계정 JSON은 사용자 입력 대기다.
- `/admin/abuse-cases`는 목업 해제로 실서버 404를 그대로 받는다 — AR01/AR02 계약 확정까지 화면의 오류 표시를 유지하고 숨기지 않는다.
- 가상 시계는 배포에서 티커·`/admin/virtual-clock` 라우트·메뉴·오버라이드 저장을 모두 비활성화한다. 로컬 개발에서는 유지하며 화면에 “서버 일정은 바뀌지 않는다”를 명시한다.
- 테스트용 `mocks/server.ts`·`testSetup.ts`·fixture·로컬 전체 `handlers`는 유지한다. DB 시연 데이터 삭제는 포함하지 않는다.
- 남은 인수: 실제 등록 계정 JSON으로 재배포 후 전체 인수 시나리오 실행 — 구현 완료와 통합 인수·배포를 구분한다.

## 미확정·선행 확인

- 홈 배너 위치: GD-255 사용자 승인으로 최상단 B01·아래 겟또타임 섹션 통합을 확정했다. 별도 화면 담당자의 회신을 받은 것으로 표기하지 않는다.
- 최초 발표: GD-199는 PR #108로 병합·배포됐고 GD-253에서 단일 호출로 연결했다. 실제 응답(`isPublished`·revision·동일 재요청) 표본과 최초 공개→알림 통합 검증은 격리 이벤트(C1)를 받는 대로 확인한다.
- 추첨 실서버 기능 검증: BE에 관리자 컨텍스트와 시나리오 이벤트 C1~C6(미공개 확정·취소 가능 당첨·FAILED 2형태·취소·응모자 없음·응모자 소유 계정)를 요청한다.
- 차단 조회: AR01/AR02는 배포 미구현(404)이라 `abuseHandlers`를 유지한다. BE 확인 요청 목록 — ① 구현·배포 일정 ② `AbuseCaseSummary/Detail` 확정 필드 ③ `sourceType`·`detectionType` 값 집합 ④ `occurredAt`/`detectedAt` 차이 ⑤ 닉네임·이벤트 제목 제공 여부 ⑥ 필터·정렬 계약 ⑦ 사유·관련 요청·검증 근거 구조와 노출 범위 ⑧ 권한·오류 코드.
- `PUBLICATION-002` 문구는 재추첨 확인만 언급하는데 최초 발표도 같은 코드를 쓴다 — 공통 문구 정렬을 BE에 요청한다. `DrawExecutionAudit`의 action 값 집합과 `beforeData`/`afterData` 문자열 내용(원문 표시 가능 범위)도 함께 확인한다.
- AS01: 배포·집계 의미는 확인했고 GD-250에서 연결했다. 공용 명세의 “담당자 확인 전” 표시는 남아 있으므로 BE 담당자 확정 시 화면 문구를 대조한다. AM04도 정확한 미션 UUID와 날짜 범위로 가용성을 확인한다.
- 관리자 미션·출석 정책: GD-259 사용자 승인으로 새 메뉴/라우트·feature 구조를 확정해 구현했다. 기존 담당 경계는 유지하며 격리 실서버 예약/등록 인수가 남아 있다. (응모 조회 AO06/AO07은 GD-250에서 `/admin/entries`로 확정·구현됨)
- 관리자 게임: AG01~AG03과 규칙·보상 조건 운영 범위, 진행 중 플레이 보호·다음 KST 기준일 적용 계약을 확정한다.
- 시연 계정: 공급 방식은 `VITE_VIRTUAL_USERS_JSON` 직접 읽기로 확정·구현했고, 실제 등록 6계정(USER 5·ADMIN 1)으로 로컬 실서버 검증을 완료했다. Vercel 환경변수 입력과 재배포 후 인수가 남아 있다.
- 이미지: B01 공개 URL·현재 이미지 로딩은 확인했다. 실제 업로드 API·키 공급 절차·형식·용량과 격리 실서버 CRUD는 담당자 후속이며 B01 표시 구현과 구분한다.
- 결과 성능: 원 기획서의 화면 반영 p95 2초·알림 생성 30초 목표를 실제 발표 흐름에서 측정한다. 달성되지 않으면 개선 또는 명시적 범위 조정 없이 완료 처리하지 않는다.

위 사항은 [로드맵](superpowers/plans/2026-10-20-backend-integration-roadmap.md)의 선행 조건이다. 확인되지 않은 항목을 정상 0건·빈 배열·목업 성공으로 덮지 않는다.

## GD-259 L5 구현·검증

- 취소/대상 없는 종료/공개 상태, 전체 페이지 수집 실패 보존, 사용자 출석·미션의 중복/누적/멱등 처리와 AP01~AP04·AM01~AM04 운영 화면을 구현했다. 기존 GD-247 오류·429·표시 행 가드는 유지한다.
- AP01/AP03·AM01/AM02/AM04 및 사용자 조회의 실제 200·봉투·Zod, 일반 사용자 관리자 조회 403을 확인했다. 출석·단일 문항 퀴즈/설문은 실제 1장 지급과 동일 키/완료 재요청 추가 지급 0을 확인했다.
- E01 전체 24건·2요청·8,307바이트·122ms, E06 전체 6건·1요청·3,012바이트·31ms. 전체 합계/결과 필터를 위해 수집 범위를 유지한다. 조회 중 변하는 번호형 페이지를 원자적 스냅샷으로 보장하는 것은 아니다.
- 관리자 정책 정상 예약·실제 적용/409, 미션 실제 등록, 다문항·자정/월 경계·취소/반환의 실서버 인수는 격리 입력이 필요하다. 주입/목업 결과를 실제 서버 인수로 표시하지 않는다.
- [L5 검증 보고서](../reports/20261020-GD-259-L5.md)·[L5 인계](superpowers/plans/L5-handoff.md)에 로컬 검사, 실제 API/브라우저, L1~L4의 잔여와 L6 입력을 분리했다. 전체 L5 인수/배포 완료는 아니다.

## GD-260 L6 구현·검증

- `/virtual-users` 호출을 제거하고 `VITE_VIRTUAL_USERS_JSON` 직접 읽기로 전환했다. 샘플 자동 대체를 제거했고 미설정·형식 오류는 로그인의 명시 안내다. 사용자 전환은 기존 `sessionSync`의 전체 쿼리 리셋을 유지하며, 로그아웃 UI는 사용자 전환으로 대체하기로 승인됐다.
- `vercel.json`의 `VITE_ENABLE_MSW=false`, `main.tsx`의 `mockServiceWorker.js` 자동 해제, `hybridHandlers` 제거로 배포의 업무 가로채기를 종료했다. 가상 시계는 배포 비노출·오버라이드 무력화다.
- 검증: format/lint/test:ci(758)/build/diff --check 통과. 실제 등록 6계정으로 로컬 preview+실서버 프록시 검증 — 155건 전부 실서버 200·실제 UUID, `/virtual-users` 미호출, Worker 자동 해제, A→B 전환 시 B 헤더 재조회·A 요청 누수 0, 새로고침 세션 유지, 320/390px, 미설정 안내를 확인했다(`docs/superpowers/plans/L6-browser-evidence.json`).
- 업무 end-to-end 시나리오(적립→응모→추첨→발표→알림→취소 반환), 머지·배포·배포 후 검증은 미실시다. [L6 통합 보고서](../reports/20261021-GD-260-L6.md)·[L6 인계](superpowers/plans/L6-handoff.md) 참조.
