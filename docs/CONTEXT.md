# CONTEXT.md — 도메인 맥락과 연동 경계

기준일은 2026-10-23이다. FE 원격 dev `52eca83`(GD-325 PR #146까지 머지)와 공용 명세 main `6aa18ed`를 대조했다. 이 문서는 FE 코드의 위치와 주의사항을 설명하며, 공용 정책·API 계약을 새로 정의하지 않는다.

- 공용 정책: [기능 요구사항](../../getddo-spec/00-requirements/functional-requirements.md), [구현 범위](../../getddo-spec/00-requirements/scope.md), [미결정 사항](../../getddo-spec/00-requirements/pending-decisions.md).
- 코드 규칙: [AGENTS.md](../AGENTS.md). 기획 원문과 페르소나: [product-context.md](product-context.md).
- 현재 코드와 계약의 차이: [백엔드 연동 현황](backend-integration-status.md).
- 남은 구현: [통합 로드맵](superpowers/plans/2026-10-20-backend-integration-roadmap.md). 실행 입력: [작업별 프롬프트](superpowers/plans/2026-10-20-backend-integration-prompts.md).

## 서비스 핵심 원칙

실행별 응모자·응모권·가중치·조건 스냅샷과 확정 결과를 보존해 정합성을 검증한다. 난수를 다시 실행해 같은 당첨자를 재현하는 기능은 요구하지 않는다. 이미 확정된 동일 실행의 재요청에는 저장된 결과를 반환한다.

응모권은 장 단위로 관리하며 지급·차감·반환·만료·정정 이력과 현재 상태가 일치해야 한다. 사용자 화면에는 서버가 실제 공개한 결과만 표시한다. 코드에 있는 시연 필드나 목업 동작을 정책의 근거로 삼지 않는다.

## 도메인과 코드의 대응

- 이벤트·겟또타임: `entities/event`, `pages/eventList`, `pages/eventDetail`, `pages/timeRaffle`, `pages/timeRaffleDetail`. `eventType=NO_TICKET`은 기본 이벤트, `TICKET`은 겟또타임이다. 현재 `isTimeRaffle`은 API에 없으면 `eventType`에서 파생한다. GD-233 목록 개편과 GD-239 내 응모 여부 표시는 dev에 반영됐다.
- 응모·응모 현황: `entities/entry`, `features/enterEvent`, `widgets/liveEntryStatus`, `widgets/myEntryRows`. 접수와 저장된 거절을 구분하며, 관리자 참여 허용·추첨 제외 결정은 제공하지 않는다.
- 응모권: `entities/ticket`, `pages/myTickets`, `pages/admin/tickets`, `widgets/ticketWallet`. 화면 용어는 보유 응모권이다. BRONZE/SILVER/GOLD/PLATINUM 네 등급이며 멤버십 등급과 별개다.
- 추첨·공개·본인 결과: `entities/drawResult`, `entities/winner`, `features/runDraw`, `features/runRedraw`, `pages/admin/draw`. 공개 조회와 관리자 추첨 연동 상태는 다르다.
- 출석: `entities/attendance`, `features/checkAttendance`, `pages/missionList`. 일일 출석과 월간 연속 출석은 이벤트와 독립적이다.
- 미션: `entities/mission`, `features/submitMission`, `pages/missionList`, `pages/missionDetail`. 서비스 공통 설문·퀴즈이며 사용자당 미션별 보상은 한 번이다.
- 게임: `entities/game`, `features/playGame`, `pages/gameDetail`, `widgets/gameRail`. GD-257에서 네 게임의 G01~G05·서버 seed·입력 기록·누적 통계·보상을 연결하고 배포 게임 목업을 해제했다. playId/토큰/원본 재시도는 메모리에 보존하며 새로고침 복구는 지원하지 않는다. 관리자 AG·변경/예약은 2026-10-22 BE 확인으로 제공 범위 제외가 확정됐다. [L4 인계](superpowers/plans/L4-handoff.md)에서 실제 API·브라우저·목업 증거와 인수 잔여를 구분한다.
- 알림: `entities/notification`, `features/markNotificationRead`, `widgets/notificationBell`. 관리자 운영은 `entities/adminNotification`, `features/retryAdminNotification`, `pages/admin/notifications`다.
- 배너: `entities/banner`, `features/manageBanner`, `pages/admin/banners`. GD-255에서 홈 최상단 `widgets/bannerSlider`를 B01 관리 이미지 배너로 연결했다. 겟또타임 안내·현황은 아래 기존 `TicketEventSection`이 맡는다. 같은 세션의 관리 변경은 B01·AB01 무효화, 다른 세션은 홈 재진입·창 재포커스·재조회로 반영한다.
- 사용자: `entities/user`, `features/switchVirtualUser`, `pages/login`, `pages/admin/virtualUsers`. 시연 계정 목록은 서버 API가 아니라 `VITE_VIRTUAL_USERS_JSON` 설정이 공급한다(`model/virtualUsers.ts`). AO01/AO02 DB 사용자 조회와는 별개다.
- 지급 전 차단: `entities/abuseCase`, `pages/admin/abuseCases`. AR01/AR02는 계약 채택(GD-141)·FE 정렬(GD-286)·배포 후 실측(GD-317)까지 완료했다 — 목록·상세+evidence·필터·정렬·오류 코드가 배포본에서 계약대로 동작한다. `triggerScope=EVENT`·`eventId` 연결 표본은 실데이터에 없어 미관측이다.
- 공통 감사: 전용 조회 API·화면은 범위 밖이며 GD-244에서 FE 조회 코드와 목업을 제거했다. 추첨 실패·실행 감사·공개 변경 이력은 추첨 업무에 속하므로 유지한다.

## 이벤트 상태와 결과 공개

정책 원본은 [이벤트 규칙](../../getddo-spec/02-domain/event.md), [추첨 규칙](../../getddo-spec/02-domain/drawing.md), [추첨 API](../../getddo-spec/05-api/drawing.md)다.

- 시작 전·진행 예정에서만 수정하며 시작을 앞당기지 않는다. 취소 이벤트는 수정하지 않는다. 시작 전이고 응모 이력이 없을 때만 삭제한다.
- 이벤트와 경품은 함께 등록한다. 같은 등수에 여러 종류의 경품을 등록하지 않는다.
- 이벤트 삭제·취소 시 연결 배너는 사용자 B01에서 숨기며 관리자 목록에는 유지한다. 배너 삭제는 관리자의 별도 동작이다.
- 마감 +1분은 자동 최초 추첨 기준이다(GD-268, ADR-026). 최초 공개는 육안 검토 후 `POST /admin/draws/{runId}/result-confirmation` 한 번으로 최종 확인·전체 공개를 처리한다. 최초 공개에 별도 확인 요청과 `publication` 요청을 연달아 보내지 않는다.
- GD-199는 PR #108로 2026-10-17 dev에 병합·배포됐고 GD-253에서 단일 발표 호출로 연결했다. 명세의 과거 기록이나 팀의 구현 완료 메시지만으로 현재 배포를 단정하지 않는다.
- 최초 공개 전 취소·재추첨이 있으면 유지 결과와 최종 재추첨 결과를 합쳐 공개한다. 미확정 결과·일부 명단을 먼저 공개하지 않는다.
- 개별 당첨 취소는 사유와 함께 요청하며 빈 자리 재추첨이 연결된다. 정상 당첨·최초 가중치는 유지하고, 이를 이유로 응모권을 반환·회수하지 않는다. 전체 취소 후 처음부터 재추첨은 이번 범위 밖이다.
- 발표 후 취소·재추첨 사이의 사용자 중간 표시는 이번 운영에서 해당 흐름을 쓰지 않는 전제로 GD-140 범위에서 제외됐다. 관리자 API 폐지·일괄 호출 금지를 뜻하지 않는다.
- GD-259의 `toEvent.ts`는 CANCELED를 canceled, 대상 없는 종료를 ended로 구분한다. DRAW_CONFIRMED/REDRAWING은 공개 전 사용자 발표 대기로 유지하며 내부 사유를 노출하지 않는다. 실제 결과 공개는 E08의 isPublished를 따른다. 취소 상세는 기존 결과 캐시보다 취소 안내를 우선한다.

## 응모권·응모·멱등 처리

상세 필드와 오류는 [응모권 API](../../getddo-spec/05-api/ticket.md), [응모 API](../../getddo-spec/05-api/entry.md), [공통 API](../../getddo-spec/05-api/common.md)를 따른다.

- 게임·미션은 BRONZE/SILVER/GOLD/PLATINUM을 79.98/18/2/0.02%로 추첨해 1장 지급한다. 장당 가중치는 1/3/5/10이다. 가중치를 지급 장수로 표시하지 않는다. 출석은 브론즈 고정이다.
- T01은 `availableCount`, 네 등급을 모두 포함한 `countByGrade`, 등급·만료 묶음 `holdings`다. T02는 한 장당 한 행이며 수량 필드가 없다. 반환·정정은 원본 이력 ID로 연결한다.
- 일반 가중치 이벤트는 사용자당 이벤트 누적 최대 5장이다. 가중치 미적용 이벤트는 브론즈 1장만 사용한다. 월말 소진용 상한 없음은 계약의 조건을 따르며 모든 이벤트로 확대하지 않는다.
- E04는 등급별 `tickets` 맵을 전송한다. 영수증의 요청 장수와 실제 차감 장수를 구분한다. 같은 등급에서는 만료 임박순으로 차감하며 이벤트 취소 반환은 원래 등급을 유지한다.
- 응모·미션 제출은 UUID `Idempotency-Key`를 같은 의도의 재시도에 유지한다. 헤더명은 `IDEMPOTENCY_HEADER`를 사용한다. 저장된 응모 거절은 같은 키로 재시도해도 최초 4xx·오류를 반환한다.
- 출석은 사용자·KST 업무일, 게임은 서버 발급 `playId`, 추첨 취소·재개·공개는 개별 계약에 따라 중복을 구분한다. 모든 mutation에 같은 멱등 정책을 적용하지 않는다.
- GD-242의 보유 응모권 로딩·0장·오류·갱신 실패 구분과 GD-246의 T02 커서 더보기·기간 합계 처리는 dev에 반영됐다. E01·E06 전체 페이지 수집은 별도 후속이다.

## 실시간 조회와 시간

- UTC 시각을 받아 KST로 표시한다. 날짜만 있는 업무일·업무월은 시각과 구분한다. 출석·게임 일일 보상은 KST 자정, 연속 출석·응모권 월 경계는 매월 1일 KST 자정이다.
- 서버가 마감·기간·지급·공개를 판정한다. 가상 시계는 로컬 개발 전용 표시 도구다 — 배포 빌드는 티커·관리자 페이지·오버라이드 저장을 모두 비활성화한다(GD-260). 서버 시각이나 스케줄러를 바꾸지 않는다. 고정 발표 예정 시각·발표까지 카운트다운은 없다.
- E03은 `participantCount`, `totalSpentTicketCount`, `mySpentTicketCount`를 제공한다. 거절 이력은 제외하며 당첨 확률을 표시하지 않는다.
- GD-247 기준 E03은 진행 중 활성 행만 30초 폴링한다. 마감 목록은 표시 행만 최초 조회한다. E09는 필터·집계를 위한 최초 전체 조회와 표시 행의 후속 폴링을 구분한다.
- E08은 공개 완료 또는 `CANCELED/NO_ENTRANTS`에서 종료한다. E09는 공개 완료에서 종료하며, 이벤트 취소와 개별 당첨 취소를 추측해 종결하지 않는다.
- 400/401/403/404·스키마 오류는 자동 재시도·폴링을 멈춘다. 네트워크/5xx는 1회 재시도, 429는 `Retry-After` 대기를 적용한다. 성공 데이터와 마지막 성공 시각을 보존한다. 상세 정책·예외는 [ADR-0007](adr/ADR-0007-live-entry-status-refresh.md)을 따른다.
- 공용 요구사항은 E03에 SSE/WebSocket을 강제하지 않는다. 제품 원문의 결과 반영 p95 2초 목표는 현재 30초 폴링의 달성 근거가 아니므로 통합 검증에서 별도 측정·조율한다.

## 백엔드 연동 전 임시 상태

이 절은 코드 기준 현황이다. API 호출 코드가 있다는 사실은 배포·쓰기·권한·통합 검증 완료를 의미하지 않는다.

- `env.enableMsw`가 true일 때만 `app/main.tsx`가 브라우저 목업을 시작한다. 로컬 개발은 전체 `handlers`를 등록한다. 배포 빌드는 `vercel.json`의 `VITE_ENABLE_MSW=false`로 목업이 시작되지 않고, 부팅 시 과거에 설치된 우리 앱의 `mockServiceWorker.js`만 해제한다(`app/config/serviceWorkerCleanup.ts`). GD-260에서 `hybridHandlers` 구분을 제거했다.
- 배포에서 업무 가로채기는 없다. `/admin/abuse-cases`는 GD-317에서 실서버 200·계약 일치를 확인했다.
- 알림 N01~N03·AN01~AN05, 사용자 결과 E08/E09, 관리자 배너 AB01~AB05, 관리자 응모권 AO05에는 실서버로 전달하는 호출 코드가 있다. 관리자 응모권 AO03·AO04·AO08·AO09(지급·정합성·반환 조회)는 GD-293에서 화면과 호출 코드를 걷었다 — 계약은 채택 상태로 남는다. 특히 관리자 알림은 이미 계약을 반영했으므로 신규 구현으로 중복 등록하지 않는다.
- 홈 B01은 GD-255에서 연결했다. AO01/AO02와 최초 `result-confirmation`은 각각 GD-250·GD-253에서 연결했고, G02/G05·실제 G03/G04는 GD-257에서 연결했다. AO01의 `totalUserCount`는 필터와 무관한 현재 활성 일반 사용자 수이며 `totalElements`와 구분한다. E01 목록의 `winnerCount`는 GD-251 계약으로 경품 인원 합계다 — 실제 당첨자 수·응모자 수·당첨 확률이 아니다. 배너 실서버 CRUD는 격리 환경이 준비되지 않아 로컬 목업 인수와 구분한다.
- 게임은 **색깔·타꼬런·타이밍·주문 네 종류의 계약이 채택**됐다. 타이밍 50점·주문 18점 기준은 2026-10-18 결정이다. 과거 문서의 “규칙 미확정”을 유지하지 않는다. 다만 등록·배포·FE 연동 여부는 별도다.
- FE 게임은 G01/G02/G05 모델을 분리하고 G03 시작→G04 원본 제출을 사용한다. `title/dailyLimit/remainingPlays`·단일 `/play`를 제거했다. G05의 `validPlayCount`는 누적 횟수이며 “오늘 플레이”가 아니다. 네 게임의 현재 BE 배포와 로컬 변경본의 실연동은 확인했고, FE 변경본의 실제 배포 인수는 남아 있다.
- GD-259는 관리자 출석 AP01~AP04를 `/admin/attendance-policies`, 미션 AM01~AM04를 `/admin/missions`에 연결했다. AP01/AP03·AM01/AM02/AM04의 실제 200·Zod·일반 사용자 403을 확인했다. AP02/AP04·AM03의 격리 실서버 쓰기는 GD-261에서 실측했으나 성공 생성분이 운영에 잔존한다(정리 방법 확인 중). AO06/AO07은 기존 GD-250 구현을 유지한다. GD-282(PR #121)에서 예약 정책 수정 AP05·AP06, 설문 자유 서술 답변 AM05, 미션 `ENDED` 상태 표시(GD-269)를 연결했고, 배포 후 실측은 GD-296에서 AM05 200·`ENDED` 반영·AP05/AP06 409 `ATTENDANCE-007` 거절까지 확인했다 — AP05·AP06 200 성공 표본만 격리 데이터 부재로 잔여다. [L5 인계](superpowers/plans/L5-handoff.md)에 경계·증거·L6 잔여를 기록한다.
- 관리자 게임·보상 조건 관리는 2026-10-22 BE 확인으로 제공 범위에서 제외가 확정됐다 — AG01~AG03과 규칙 변경·비활성 전환·보상 조건 예약은 구현하지 않는다.
- AR01/AR02는 채택 계약의 `userNickname`·`eventTitle`·`detectionReason`·`blockedAt`/`blockedUntil`과 `evidence` 객체 구조를 따른다. evidence 세부 필드(`ruleVersion`·`triggerScope`·`requestLimit`·`rejectedCount`·`rejectionThreshold` 등)와 업무 오류(`ABUSE-001` 403·`ABUSE-002` 404)는 2026-10-22 확정·배포됐고 GD-317 실측으로 대조했다. 응모 요청 반복 초과 시 사용자별 10분 일시 차단(GD-141)이 적용되고, 차단 중 응모 거절은 기존 429 `COMMON-006`과 `Retry-After`(남은 차단 초)를 쓴다.
- 플래티넘(`PLATINUM`) 지급 활성화는 BE `main`에 병합됐다(GD-229, 확률 기본값 0.02%; GD-228 등급·응모 경로, GD-230 추첨 가중치·스냅샷 호환). 실서버 플래티넘 표본이 없어 지급·응모·추첨·화면 연동 검증은 미실시다.
- `/virtual-users` HTTP 경로는 GD-260에서 제거했다. 시연 계정은 `VITE_VIRTUAL_USERS_JSON`을 `entities/user/model/virtualUsers.ts`가 빌드 설정에서 직접 읽는다 — 미설정·형식 오류는 로그인 화면의 명시 안내로 표시하고 샘플로 대체하지 않는다. `id`는 실서버 DB 등록 UUID여야 한다. AO01을 일반 사용자 로그인용으로 호출하지 않는다.
- 배너 이미지 업로드·형식·용량, 서버 시계 변경 API를 임의로 확정하지 않는다. 관리자 응답의 이름 필드(ADR-028)는 확정 계약이며 FE는 GD-287(PR #124)에서 스키마 선택 필드·null 표시로 반영했다 — ID가 null이면 이름도 null로 표시한다. BE는 GD-284로 `main`에 병합됐고 배포 서버 응답 확인은 별도다(명세 `common.md`·`drawing.md`·`notification.md`에는 구현 예정 표기가 남아 있다). 미확정 사항과 실행 선행 조건은 [연동 현황](backend-integration-status.md)에 모은다.

## 비공개·역할·시연

- 공개 명단은 서버가 제공한 마스킹 이름과 전화번호 끝 4자리만 표시한다. 이메일·원본 개인정보·다른 사용자의 차단 근거를 노출하지 않는다. 미등록 값의 별도 대체 표시와 재추첨 과정의 사용자 연출은 범위 밖이다.
- 최초 공개 알림은 응모자 전원에게, 발표 후 명단 갱신 알림은 취소자·새 당첨자에게만 생성한다. 실제 문자·이메일·외부 푸시를 보내는 기능은 없다.
- `USER/ADMIN`은 대문자, 멤버십 `excellent/vip/vvip`는 소문자 코드다. `X-User-ID/X-User-Role`은 공통 필수이며 멤버십 헤더는 개별 계약과 DB 대조를 따른다. 클라이언트의 역할 선택으로 권한을 승격하지 않는다.
- 사용자 선택은 통제된 시연용 문맥 전달이며 신원 인증이 아니다. 관리자는 응모할 수 없다. `useSessionStore`의 현재 초기 사용자는 `null`이므로 과거의 ADMIN 자동 시작 설명은 적용하지 않는다.
- U01의 비활성 사용자 거절은 현행 계약이지만 본인 정보 전체를 확정 API로 확대하지 않는다. 비활성 계정 정책은 각 API별로 확인한다.

## 보존할 범위와 제외할 범위

배포 중 가짜 업무 응답을 제거하는 것이 연동의 목표다. Vitest용 MSW·계약 fixture·장애 재현 테스트는 유지한다. 프론트 문서만으로 DB 데이터 삭제나 새 인증 방식 도입을 승인하지 않는다.

사용자 정보 수정·탈퇴, 수동 응모권 지급·회수, 참여 허용·추첨 제외, 실제 문자·메일·외부 푸시, 미션 관리자 승인·반려, 공통 감사 조회, 전체 취소 후 처음부터 재추첨은 추가하지 않는다. 이미지·디자인 토큰은 업무 목업 데이터와 구분하며 [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)를 따른다.

## GD-260 L6 검증 경계

`feat/GD-260`에서 `/virtual-users` 호출 제거·`VITE_VIRTUAL_USERS_JSON` 직접 읽기·샘플 자동 대체 제거·배포 MSW 부팅 종료·`mockServiceWorker.js` 자동 해제·가상 시계 배포 비노출을 구현했다. 실제 등록 6계정으로 로컬 브라우저 검증을 완료해 로그인·홈·조회가 전부 실서버 200과 실제 UUID를 받았고, 전환 격리·Worker 해제·미설정 안내를 확인했다. 업무 end-to-end 시나리오와 머지·배포·배포 후 검증은 별도다. [L6 인계](superpowers/plans/L6-handoff.md)·[L6 계획](superpowers/plans/2026-10-21-GD-260-L6-runtime-mock-retirement.md)·[통합 보고서](../reports/20261021-GD-260-L6.md) 참조.

## GD-259 L5 검증 경계

E01 24건·2요청·8,307바이트·122ms, E06 시연 사용자 6건·1요청·3,012바이트·31ms를 측정했다. 전체 합계·결과 필터를 위해 전체 수집을 유지하며 없는 요약 API를 만들지 않았다. 출석·단일 문항 퀴즈/설문은 실제 보상 각 1장과 재시도 추가 지급 0을 확인했다. 다문항 누적 정답·일일/연속/월 경계·반환 정합성은 자동 테스트이며 실제 격리 인수와 구분한다. L4 PR #107 머지는 확인했지만 게임 관리자 계약·배포 인수 잔여는 그대로다. L6 구현은 이번 세션 범위 밖이다.
