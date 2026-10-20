# CONTEXT.md — 도메인 맥락과 연동 경계

기준일은 2026-10-20이다. FE `a49796a`, 공용 명세 `bbbe811`을 대조했다. 이 문서는 FE 코드의 위치와 주의사항을 설명하며, 공용 정책·API 계약을 새로 정의하지 않는다.

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
- 게임: `entities/game`, `features/playGame`, `pages/gameDetail`, `widgets/gameRail`. 서버 UUID와 `code`를 구분하고, 게임 결과·통계·보상은 서버 판정이 기준이다.
- 알림: `entities/notification`, `features/markNotificationRead`, `widgets/notificationBell`. 관리자 운영은 `entities/adminNotification`, `features/retryAdminNotification`, `pages/admin/notifications`다.
- 배너: `entities/banner`, `features/manageBanner`, `pages/admin/banners`. GD-255에서 홈 최상단 `widgets/bannerSlider`를 B01 관리 이미지 배너로 연결했다. 겟또타임 안내·현황은 아래 기존 `TicketEventSection`이 맡는다. 같은 세션의 관리 변경은 B01·AB01 무효화, 다른 세션은 홈 재진입·창 재포커스·재조회로 반영한다.
- 사용자: `entities/user`, `features/switchVirtualUser`, `pages/login`, `pages/admin/virtualUsers`. 현재 `/virtual-users` 시연 목록과 AO01/AO02 DB 사용자 조회는 별개다.
- 지급 전 차단: `entities/abuseCase`, `pages/admin/abuseCases`. 조회 계약은 담당자 확인이 남아 있으며 배포용 목업이 남아 있다.
- 공통 감사: 전용 조회 API·화면은 범위 밖이며 GD-244에서 FE 조회 코드와 목업을 제거했다. 추첨 실패·실행 감사·공개 변경 이력은 추첨 업무에 속하므로 유지한다.

## 이벤트 상태와 결과 공개

정책 원본은 [이벤트 규칙](../../getddo-spec/02-domain/event.md), [추첨 규칙](../../getddo-spec/02-domain/drawing.md), [추첨 API](../../getddo-spec/05-api/drawing.md)다.

- 시작 전·진행 예정에서만 수정하며 시작을 앞당기지 않는다. 취소 이벤트는 수정하지 않는다. 시작 전이고 응모 이력이 없을 때만 삭제한다.
- 이벤트와 경품은 함께 등록한다. 같은 등수에 여러 종류의 경품을 등록하지 않는다.
- 이벤트 삭제·취소 시 연결 배너는 사용자 B01에서 숨기며 관리자 목록에는 유지한다. 배너 삭제는 관리자의 별도 동작이다.
- 마감 +5분은 자동 최초 추첨 기준이다. 최초 공개는 육안 검토 후 `POST /admin/draws/{runId}/result-confirmation` 한 번으로 최종 확인·전체 공개를 처리한다. 최초 공개에 별도 확인 요청과 `publication` 요청을 연달아 보내지 않는다.
- GD-199는 명세에 PR 대조 계약으로 기록돼 있다. 현재 PR 병합·배포 여부는 실행 시 다시 확인한다. 명세의 과거 OPEN 기록이나 팀의 구현 완료 메시지만으로 현재 배포를 단정하지 않는다.
- 최초 공개 전 취소·재추첨이 있으면 유지 결과와 최종 재추첨 결과를 합쳐 공개한다. 미확정 결과·일부 명단을 먼저 공개하지 않는다.
- 개별 당첨 취소는 사유와 함께 요청하며 빈 자리 재추첨이 연결된다. 정상 당첨·최초 가중치는 유지하고, 이를 이유로 응모권을 반환·회수하지 않는다. 전체 취소 후 처음부터 재추첨은 이번 범위 밖이다.
- 발표 후 취소·재추첨 사이의 사용자 중간 표시는 이번 운영에서 해당 흐름을 쓰지 않는 전제로 GD-140 범위에서 제외됐다. 관리자 API 폐지·일괄 호출 금지를 뜻하지 않는다.
- `toEvent.ts`는 아직 `CANCELED`·`REDRAWING`을 `closed`로 축약한다. GD-247의 결과 폴링 종료 개선으로 이 화면 상태 문제가 해결된 것은 아니다.

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
- 서버가 마감·기간·지급·공개를 판정한다. 가상 시계는 화면 및 로컬 목업의 시연 수단이며 서버 시각이나 스케줄러를 바꾸지 않는다. 고정 발표 예정 시각·발표까지 5분 카운트다운은 없다.
- E03은 `participantCount`, `totalSpentTicketCount`, `mySpentTicketCount`를 제공한다. 거절 이력은 제외하며 당첨 확률을 표시하지 않는다.
- GD-247 기준 E03은 진행 중 활성 행만 30초 폴링한다. 마감 목록은 표시 행만 최초 조회한다. E09는 필터·집계를 위한 최초 전체 조회와 표시 행의 후속 폴링을 구분한다.
- E08은 공개 완료 또는 `CANCELED/NO_ENTRANTS`에서 종료한다. E09는 공개 완료에서 종료하며, 이벤트 취소와 개별 당첨 취소를 추측해 종결하지 않는다.
- 400/401/403/404·스키마 오류는 자동 재시도·폴링을 멈춘다. 네트워크/5xx는 1회 재시도, 429는 `Retry-After` 대기를 적용한다. 성공 데이터와 마지막 성공 시각을 보존한다. 상세 정책·예외는 [ADR-0007](adr/ADR-0007-live-entry-status-refresh.md)을 따른다.
- 공용 요구사항은 E03에 SSE/WebSocket을 강제하지 않는다. 제품 원문의 결과 반영 p95 2초 목표는 현재 30초 폴링의 달성 근거가 아니므로 통합 검증에서 별도 측정·조율한다.

## 백엔드 연동 전 임시 상태

이 절은 코드 기준 현황이다. API 호출 코드가 있다는 사실은 배포·쓰기·권한·통합 검증 완료를 의미하지 않는다.

- `env.enableMsw`가 true일 때만 `app/main.tsx`가 브라우저 목업을 시작한다. 개발 모드는 전체 `handlers`, 배포 빌드는 `hybridHandlers`를 등록한다.
- 현재 하이브리드에는 **관리자 추첨·게임·지급 전 차단·가상 사용자**가 남아 있다. 감사 조회는 없다. 주석의 “추첨 전체 404”는 현재 배포의 증거로 사용하지 않는다.
- 알림 N01~N03·AN01~AN05, 사용자 결과 E08/E09, 관리자 배너 AB01~AB05, 관리자 응모권 AO03/AO04/AO05/AO08/AO09에는 실서버로 전달하는 호출 코드가 있다. 특히 관리자 알림은 이미 계약을 반영했으므로 신규 구현으로 중복 등록하지 않는다.
- 홈 B01은 GD-255에서 연결했다. AO01/AO02와 최초 `result-confirmation`은 각각 GD-250·GD-253에서 연결했고, G02/G05·실제 G03/G04는 남은 작업이다. AO01의 `totalUserCount`는 필터와 무관한 현재 활성 일반 사용자 수이며 `totalElements`와 구분한다. 배너 실서버 CRUD는 격리 환경이 준비되지 않아 로컬 목업 인수와 구분한다.
- 게임은 **색깔·타꼬런·타이밍·주문 네 종류의 계약이 채택**됐다. 타이밍 50점·주문 18점 기준은 2026-10-18 결정이다. 과거 문서의 “규칙 미확정”을 유지하지 않는다. 다만 등록·배포·FE 연동 여부는 별도다.
- 현재 FE 게임 목록은 임시 `title/dailyLimit/remainingPlays` 모델이고 제출은 단일 `/play`다. G01/G02/G05 모델 분리와 G03 시작→G04 결과 제출 전환이 필요하다. G05의 `validPlayCount`는 누적 횟수이며 “오늘 플레이”가 아니다.
- 관리자 출석 AP01~AP04·미션 AM01~AM03·응모 AO06/AO07은 공용 명세에 현행 구현이 기록됐지만 대응 FE 화면·호출이 남아 있다. AS01은 구현 기록과 담당자 확인 전 상태가 함께 있고, AM04는 설문 집계 계약을 따른다. 현재 배포 가용성은 새로 검증한다.
- 관리자 게임·보상 조건 관리는 기능 요구사항에 포함되지만 AG01~AG03과 규칙 변경·비활성 전환·보상 조건 예약의 상세 계약은 제안/후속 상태다. 네 게임의 사용자 계약 채택을 관리자 운영 계약 채택으로 확대하지 않는다. 로드맵 L4에서 계약·범위를 확정하고 완료 조건에 반영한다.
- AR01/AR02의 차단 사유·요청·검증 근거 DTO는 담당자 확인이 필요하다. 기존 목업의 이름·이벤트 표시 필드를 최종 계약으로 채택하지 않는다.
- `/virtual-users`는 spec 외 시연 경로다. `VITE_VIRTUAL_USERS_JSON`은 현재 목업 핸들러가 소비하므로 플래그만 끄면 선택 화면이 깨진다. 실제 등록된 시연 계정 선택은 유지하되 런타임 MSW 없이 읽는 방식은 로드맵의 승인 항목이다. AO01을 일반 사용자 로그인용으로 호출하지 않는다.
- 배너 이미지 업로드·형식·용량, 차단 상세 계약, 서버 시계 변경 API를 임의로 확정하지 않는다. 미확정 사항과 실행 선행 조건은 [연동 현황](backend-integration-status.md)에 모은다.

## 비공개·역할·시연

- 공개 명단은 서버가 제공한 마스킹 이름과 전화번호 끝 4자리만 표시한다. 이메일·원본 개인정보·다른 사용자의 차단 근거를 노출하지 않는다. 미등록 값의 별도 대체 표시와 재추첨 과정의 사용자 연출은 범위 밖이다.
- 최초 공개 알림은 응모자 전원에게, 발표 후 명단 갱신 알림은 취소자·새 당첨자에게만 생성한다. 실제 문자·이메일·외부 푸시를 보내는 기능은 없다.
- `USER/ADMIN`은 대문자, 멤버십 `excellent/vip/vvip`는 소문자 코드다. `X-User-ID/X-User-Role`은 공통 필수이며 멤버십 헤더는 개별 계약과 DB 대조를 따른다. 클라이언트의 역할 선택으로 권한을 승격하지 않는다.
- 사용자 선택은 통제된 시연용 문맥 전달이며 신원 인증이 아니다. 관리자는 응모할 수 없다. `useSessionStore`의 현재 초기 사용자는 `null`이므로 과거의 ADMIN 자동 시작 설명은 적용하지 않는다.
- U01의 비활성 사용자 거절은 현행 계약이지만 본인 정보 전체를 확정 API로 확대하지 않는다. 비활성 계정 정책은 각 API별로 확인한다.

## 보존할 범위와 제외할 범위

배포 중 가짜 업무 응답을 제거하는 것이 연동의 목표다. Vitest용 MSW·계약 fixture·장애 재현 테스트는 유지한다. 프론트 문서만으로 DB 데이터 삭제나 새 인증 방식 도입을 승인하지 않는다.

사용자 정보 수정·탈퇴, 수동 응모권 지급·회수, 참여 허용·추첨 제외, 실제 문자·메일·외부 푸시, 미션 관리자 승인·반려, 공통 감사 조회, 전체 취소 후 처음부터 재추첨은 추가하지 않는다. 이미지·디자인 토큰은 업무 목업 데이터와 구분하며 [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)를 따른다.
