# 백엔드 연동 현황

## 확인 기준과 한계

- 확인일: 2026-10-20.
- FE: `dev`의 `a49796a`. `git fetch origin` 후 `origin/dev`와 차이 0건을 확인했다.
- 공용 명세: `main`의 `bbbe811`. 원격 갱신 후 `origin/main`과 차이 0건을 확인했다.
- 이번 확인은 공용 명세·실제 소스·Git 이력 대조다. 배포 API·브라우저·백엔드 PR 상태를 새로 측정한 보고서가 아니다.
- 팀 전달의 “백엔드 구현 완료”는 실행의 출발점이다. 배포 환경·메서드·DTO·권한·쓰기 재시도가 맞는지 별도로 확인해야 한다.
- 상태를 계약 채택, FE 호출 구현, 배포 실측, 통합 검증으로 구분한다. 아래 “실서버 전달”은 하이브리드 목업에 해당 핸들러가 없고 호출 코드가 있다는 의미다.

## 팀이 요청한 다섯 항목

### 결과 알림

N01 목록·N02 개별 읽음·N03 전체 읽음과 AN01~AN05 관리자 알림 운영은 호출 코드가 있고 하이브리드 목업 대상이 아니다. `NotificationItem`과 알림 드로어에는 결과 링크 처리도 있다.

다만 실제 최초 발표의 `result-confirmation` 호출이 없고 관리자 추첨은 목업이다. 따라서 “알림 UI/API 연결은 구현됨, 실제 공개→알림 생성→읽음→결과 이동의 통합 검증은 남음”으로 판정한다. 알림 전체가 완료됐다고 단정하거나 이미 있는 드로어를 재구현하지 않는다.

근거: `entities/notification/api/queries.ts`, `features/markNotificationRead/api/queries.ts`, `entities/adminNotification/api/queries.ts`, `features/retryAdminNotification/api/queries.ts`, `widgets/notificationBell/`, `features/runDraw/api/queries.ts`.

### 게임 연결과 게임 기록

`gameHandlers`가 배포용 하이브리드에 남아 있다. G01은 임시 Game 모델로 파싱하고 결과는 비계약 단일 `POST /games/{id}/play`에 점수만 보낸다. G02 상세·G05 개인 통계 훅이 없으며 기록 카드는 같은 Game 객체의 임시 통계를 소비한다.

현재 명세는 네 게임의 G03/G04 계약을 채택했다. 색깔 최소 50점, 타꼬런 400점, 타이밍 50점, 주문 18점이다. 2026-10-18 결정이 있으므로 타이밍·주문을 규칙 미확정으로 분류하지 않는다. G05의 `validPlayCount`는 누적 유효 플레이 횟수이므로 “오늘 플레이”에 그대로 넣지 않는다.

근거: `entities/game/model/types.ts`, `entities/game/api/queries.ts`, `features/playGame/api/queries.ts`, `pages/gameDetail/GameDetailPage.tsx`, `pages/gameDetail/ui/GameStats.tsx`, [게임 계약](../../getddo-spec/05-api/game.md).

### 홈 배너

관리자 AB01~AB05 호출은 실서버로 전달된다. 사용자 B01 조회 훅과 소비 화면은 없다. 현재 홈의 `BannerSlider`는 `useEventList`에서 진행 중인 겟또타임을 마감순으로 고르는 추천 슬라이더다. 관리자 배너의 이미지·순서·연결 이벤트가 홈에 반영되는 기능과 다르다.

노출 위치는 미확정이다. **추천은 홈 최상단을 B01 관리 배너로 사용하고 기존 겟또타임 정보는 아래 겟또타임 섹션으로 모으는 방식**이다. 이는 제안이며 구현 전 화면 담당자와 확정한다. 업로드 API·이미지 형식·용량은 B01 연결과 별도의 선행 확인 사항이다.

근거: `entities/banner/api/queries.ts`, `features/manageBanner/api/queries.ts`, `widgets/bannerSlider/ui/BannerSlider.tsx`, `pages/home/HomePage.tsx`, [배너 계약](../../getddo-spec/05-api/banner.md).

### 관리자 사용자 조회

GD-250(`feat/GD-250`)에서 AO01/AO02 호출·화면을 `/admin/users`로 구현했다. 2026-10-20 배포 실측에서 검색 결과 13명·활성 일반 사용자 12명·빈 페이지 불변을 확인했다. 로컬 실서버 연결 화면에서 목록·필터·상세 서랍·403/404를 확인했다.

AO01은 `AdminUserList`의 `totalElements`와 `totalUserCount`를 분리한다. 후자는 목록 필터와 무관한 현재 ACTIVE USER 전체 수이며 AS01 참여율 분모에 사용한다. AO02에는 해당 수치를 추가하지 않는다. 개인정보 연락처·역할 변경·정지/해제 기능은 만들지 않았다. 가상 사용자 페이지(`/admin/virtual-users`)는 별도로 유지한다.

근거: `entities/user/api/admin.ts`, `pages/admin/users/AdminUsersPage.tsx`, `pages/admin/virtualUsers/AdminVirtualUsersPage.tsx`, `app/routes/adminRoutes.tsx`, [사용자 계약](../../getddo-spec/05-api/user.md).

## 나머지 완성 범위

- 응모권 T01/T02·관리자 이력/정합성, 출석 AT01~AT03, 미션 M01~M04, 이벤트·응모·공개 결과는 현재 호출 코드와 실서버 전달 경로가 있다. 실패·중복 요청·월말·4등급·권한까지 성공한 것으로 확대하지 않는다.
- 관리자 추첨은 실행·후보·정합성·취소·재개·명단 갱신의 기존 UI가 있다. 현행 DTO 대조, 실패 이력·실행 감사, 단일 최초 발표, 알림과 결과의 일치 검증이 남았다.
- 지급 전 차단은 목업이다. AR01/AR02 필드·판정 근거는 담당자 확인 후 연결해야 한다. UI가 표시하는 가짜 차단 건수를 실제 운영 지표로 사용하지 않는다.
- 관리자 응모 조회 AO06/AO07은 GD-250에서 `/admin/entries`로 구현·실측했다(응모 이력·이벤트별 참여자, 404 `ENTRY-004` 확인). 출석 정책 AP01~AP04, 미션 관리 AM01~AM03·설문 집계 AM04의 대응 FE 기능은 남아 있다. 기능 요구사항상 필요한 운영 기능이므로 담당 배정 전이라는 이유로 프로젝트 완료 조건에서 누락하지 않는다.
- 관리자 게임·보상 조건 관리도 기능 요구사항에 포함된다. AG01~AG03 및 규칙/상태 변경·보상 조건 예약은 상세 계약이 남아 있다. L4에서 담당자와 최소 운영 범위를 확정해 연결하거나 사용자에게 범위 조정을 받아야 하며, 사용자 게임 4종 연결만으로 전체 게임 운영을 완료 처리하지 않는다.
- 대시보드는 GD-250에서 AS01 일별 집계 단일 조회로 전환했다. 기존 7일×4조건 28회 + 요약용 추가 조회는 제거했고 실제 Network에서 `GET /v1/admin/stats/daily` 1회로 확인했다. AS01 채택 근거는 공용 명세의 담당자 확인이 아니라 사용자의 명시적 채택 확인이다. `blockedCount`는 화면에서 “어뷰징 탐지 기록”으로 표시하며 지급 차단 확정 건수로 표시하지 않는다. 참여율 분모는 현재 활성 일반 사용자 수다.
- `toEvent.ts`의 취소 상태 축약, E01/E06 전체 페이지 수집, 근거 없는 공정성·자동 취소 안내와 일부 모바일 화면 검증은 남은 정합성·완성도 작업이다.

## 런타임 목업 제거 조건

현재 `mocks/handlers/index.ts`의 `hybridHandlers`는 `abuseHandlers`, `drawHandlers`, `gameHandlers`, `virtualUserHandlers`다. `mocks/browser.ts`는 개발 전체 목업과 배포 하이브리드를 구분하고, `app/main.tsx`는 `env.enableMsw`로 시작 여부를 정한다.

1. 각 업무의 서버 요청·응답·화면 검증을 먼저 끝내고 해당 배포 핸들러를 해제한다. 목업 해제만으로 연동 완료로 보지 않는다.
2. `/virtual-users` 호출을 제거해도 로그인·계정 전환이 가능하도록 실제 등록된 시연 계정 목록의 공급 방식을 정한다. 추천은 기존 `VITE_VIRTUAL_USERS_JSON`을 명시적 시연 설정으로 읽고 샘플 사용자 자동 대체를 없애는 방식이다. 사용자 문맥·환경 설정 변경 승인을 먼저 받는다.
3. 배포에서 MSW 시작을 끄고 기존 Service Worker 등록이 남은 브라우저와 새 브라우저를 모두 검사한다. 다른 서비스의 Worker나 캐시를 무차별 삭제하지 않는다.
4. 가상 시계로 서버 응모·추첨·발표가 실행된 것처럼 안내하지 않는다. 실제 시연은 서버에 준비한 일정·계정·이벤트로 수행한다.
5. 테스트용 `mocks/server.ts`, `testSetup.ts`, fixture는 유지한다. 서비스 화면의 샘플 데이터·가짜 집계·오류 시 샘플 대체와 브라우저 업무 가로채기가 제거 대상이다. DB 시연 데이터 삭제는 포함하지 않는다.

## 미확정·선행 확인

- 홈 배너 위치: 위 추천안을 화면 담당자와 확정한다.
- 최초 발표: 명세의 GD-199 PR 대조 범위와 현재 배포 응답을 확인한다.
- 차단 조회: AR01/AR02 계약과 검증 근거·민감정보 공개 범위를 확인한다.
- AS01: 배포·집계 의미는 확인했고 GD-250에서 연결했다. 공용 명세의 “담당자 확인 전” 표시는 남아 있으므로 BE 담당자 확정 시 화면 문구를 대조한다. AM04도 정확한 미션 UUID와 날짜 범위로 가용성을 확인한다.
- 관리자 미션·출석 정책: 담당과 새 메뉴·라우트 위치를 확정한다. (응모 조회 AO06/AO07은 GD-250에서 `/admin/entries`로 확정·구현됨)
- 관리자 게임: AG01~AG03과 규칙·보상 조건 운영 범위, 진행 중 플레이 보호·다음 KST 기준일 적용 계약을 확정한다.
- 시연 계정: 실제 등록 계정의 공급 방식과 MSW 종료 후 동작을 확정한다.
- 이미지: B01 표시와 실제 업로드 저장소 연동을 구분한다. 이미지 형식·용량 제한을 임의로 만들지 않는다.
- 결과 성능: 원 기획서의 화면 반영 p95 2초·알림 생성 30초 목표를 실제 발표 흐름에서 측정한다. 달성되지 않으면 개선 또는 명시적 범위 조정 없이 완료 처리하지 않는다.

위 사항은 [로드맵](superpowers/plans/2026-10-20-backend-integration-roadmap.md)의 선행 조건이다. 확인되지 않은 항목을 정상 0건·빈 배열·목업 성공으로 덮지 않는다.
