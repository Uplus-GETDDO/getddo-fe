# 백엔드 연동 작업별 프롬프트

[로드맵](2026-10-20-backend-integration-roadmap.md)의 L1~L6과 일대일로 대응한다. 각 코드 블록은 새 세션에 그대로 붙여 넣는다. Jira 제목은 제안이며 이슈 생성·담당 배정·브랜치 생성은 아직 하지 않았다.

**추천 시작점은 L1이다.** L4/L5는 기존 화면 담당자와 병행하고, L6은 도메인 연동이 끝난 뒤 실행한다. 이미 승인된 계획이 있는 세션에서는 그 승인을 재사용하되 변경된 범위·새 계약·새 라우트·환경 설정만 추가 확인한다.

## L1 — 관리자 사용자·응모권·응모 조회와 운영 집계

Jira 제목: **`[FE] 관리자 사용자·응모 조회 및 응모권 운영·대시보드 실연동`**

```text
getddo-fe의 백엔드 연동 로드맵 L1을 진행하려고 한다.

먼저 AGENTS.md, docs/CONTEXT.md, docs/backend-integration-status.md,
docs/superpowers/plans/2026-10-20-backend-integration-roadmap.md의 L1을 읽어라.
../getddo-spec/05-api/user.md, ticket.md, entry.md, admin-stats.md, common.md와
00-requirements/scope.md를 실제 계약의 기준으로 사용하라.
git branch/status와 원격 dev를 확인하고 현재 코드·기존 Jira/브랜치와 대조하라.
문서의 2026-10-20 상태를 현재 배포 상태로 간주하지 마라.

송동현 영역 중심으로 AO01/AO02 사용자 목록·상세, AO06/AO07 응모·참여자 조회,
기존 관리자 응모권 이력·정합성 연결, AS01 대시보드 집계를 한 작업으로 묶어라.
AO01 totalUserCount는 필터와 무관한 ACTIVE USER 전체 수이고
totalElements는 검색 결과 수다. 가상 사용자 목록과 관리자 DB 조회를 분리하라.
연락처·정지/해제·역할 변경 등 명세에 없는 사용자 수정 기능은 추가하지 마라.
AS01의 담당자 확인 전 상태와 배포를 확인한 뒤 28개 조건별 조회를 대체하라.
탐지 기록 수를 차단 확정 건수로 바꾸지 마라.

변경 파일·책임·새 메뉴/라우트·검증 사례와 선행 조건을 먼저 제시하고 계획 승인을 받아라.
이미 승인된 동일 범위는 재승인을 요구하지 마라. 실제 Jira 키 없이 키를 만들지 마라.
승인 후 조회→화면→집계·통합 검증 순서로 작은 커밋 단위로 구현하라.
새 라이브러리나 서버 API를 임의로 만들지 말고 기존 FSD·테이블·필터를 재사용하라.

필터·빈 페이지·totalUserCount 불변·403/404·nullable participantId·4등급·정합성·
KST 날짜 경계·중복 요청 제거를 테스트하고 실제 API·브라우저 증거를 남겨라.
format:check, lint, test:ci, build를 실행하고 로드맵·연동 현황을 갱신하라.
서브에이전트·자동 머지·배포는 수행하지 마라.
```

## L2 — 추첨·결과 알림·차단

Jira 제목: **`[FE] 관리자 추첨·최초 발표·결과 알림 및 차단 내역 실연동`**

```text
getddo-fe 로드맵 L2를 송동현 담당 영역 중심으로 진행하려고 한다.
AGENTS.md, docs/CONTEXT.md, docs/backend-integration-status.md,
docs/superpowers/plans/2026-10-20-backend-integration-roadmap.md의 L2를 읽어라.
../getddo-spec/05-api/drawing.md, notification.md, abuse.md,
02-domain/drawing.md, notification.md, 00-requirements/pending-decisions.md가 기준이다.
git 상태·원격 dev·현재 소스와 기존 작업을 확인하라.

관리자 추첨 조회·실패/실행 감사·최초 발표·취소/재개와 결과 알림 검증,
지급 전 차단 조회 계약 전환을 한 작업으로 묶어라.
기존 N01~N03·AN01~AN05와 알림 드로어는 재사용한다.
GD-199 result-confirmation의 현재 병합·배포·입출력을 확인하라.
명세의 과거 OPEN 기록이나 hybridHandlers의 추첨 404 주석을 현재 사실로 쓰지 마라.
최초 발표는 최신 검토 runId로 본문·추가 멱등 헤더 없는 요청 한 번이다.
확인 버튼과 publication을 최초 발표에 연달아 호출하지 마라.
개별 취소는 사유·동일 멱등키를 유지하고 202를 최종 성공으로 표시하지 마라.
공통 감사 조회나 참여 허용·추첨 제외·응모권 회수는 복구하지 마라.
AR01/AR02 계약이 미확정이면 필요한 필드·사유·근거·권한을 담당자 확인 항목으로 제시하라.

변경 파일·조회→행동→통합 검증 단계·계약 차이·차단 항목을 먼저 제시해 승인받아라.
이미 승인된 범위는 그대로 진행한다. 미확정 계약을 목업 형상으로 확정하지 마라.
격리 이벤트에서 공개 전 비공개, 취소/빈 자리 재추첨, 단일 전체 공개,
명단 변경 충돌·동일 공개 재시도·응모자 없음·실패 재개를 검증하라.
실제 공개→알림 생성→커서 조회→읽음→결과 이동과 최종 실패 복구를 확인하라.
시작 10분 전 알림·일정 변경/취소 안내도 검증하고 없는 구독 API를 추가하지 마라.
도메인별 실서버 검증 후 drawHandlers·abuseHandlers의 배포 등록을 해제하라.
테스트용 MSW와 업무별 이력은 유지한다.

관련 테스트, format:check, lint, test:ci, build, 브라우저 검증 결과를 남기고
로드맵·연동 현황을 갱신하라. 서브에이전트·자동 머지·배포는 수행하지 마라.
```

## L3 — 홈 관리 배너

Jira 제목: **`[FE] 홈 관리 배너 API 연결 및 관리자 변경 반영`**

```text
getddo-fe 로드맵 L3의 홈 관리 배너 연동을 진행하려고 한다.
AGENTS.md, docs/CONTEXT.md, docs/backend-integration-status.md,
docs/superpowers/plans/2026-10-20-backend-integration-roadmap.md의 L3,
../getddo-spec/05-api/banner.md와 02-domain/banner.md를 읽어라.
git 상태·원격 dev·기존 작업과 실제 BannerSlider·HomePage·배너 API 코드를 대조하라.

현재 BannerSlider는 이벤트 추천이며 B01 소비 코드가 없다.
B01의 id/eventId/imageUrl/displayOrder를 소비하고 서버 상대 순서를 유지하라.
홈 최상단을 관리 배너로 사용하고 겟또타임 안내는 아래 기존 섹션으로 모으는 안을 추천한다.
이 배치는 아직 확정이 아니므로 기존 대화의 승인 여부를 확인하고,
승인이 없으면 화면 담당자와 결정할 수 있도록 변경안과 파일·검증 계획을 제시하라.
API 연동·관리자 변경 후 갱신·사용자 노출 검증은 한 작업으로 묶어라.

기존 AB01~AB05와 eventDetailPath를 재사용하라.
빈 목록·이미지 실패·연결 이벤트 실패·409 순서 충돌·이전 배너 eventId=null을 처리하라.
이벤트 취소/삭제 시 사용자 숨김·관리자 유지 정책을 지키고 자동 배너 삭제를 만들지 마라.
B01에 없는 제목·본문 필드를 임의로 만들지 마라.
실제 이미지 키→공개 URL을 확인하되 업로드 API·파일 형식·용량 제한은 임의로 확정하지 마라.

승인 후 구현하고 등록→순서 변경→삭제→홈 재조회 반영을 격리 데이터로 검증하라.
같은 세션의 무효화와 다른 세션의 재조회를 구분하라.
키보드·자동 재생 정지·동작 줄이기·320/390px·상세 이동을 확인하라.
관련 테스트, format:check, lint, test:ci, build를 실행하고
로드맵·연동 현황에 위치 결정과 증거를 반영하라.
서브에이전트·자동 머지·배포는 수행하지 마라.
```

## L4 — 게임 4종·기록·보상

Jira 제목: **`[FE] 게임 4종·개인 기록·보상 실연동 및 관리자 게임 운영`**

```text
getddo-fe 로드맵 L4의 게임 실연동을 진행하려고 한다.
AGENTS.md, docs/CONTEXT.md, docs/backend-integration-status.md,
docs/superpowers/plans/2026-10-20-backend-integration-roadmap.md의 L4를 읽어라.
../getddo-spec/05-api/game.md와 game-color-word-draft.md, game-takko-run-draft.md,
game-takko-timing-draft.md, game-takko-order-draft.md 및 02-domain/game.md가 기준이다.
git 상태·원격 dev·기존 게임 담당 작업과 실제 코드·배포 목록을 먼저 확인하라.
박소연 게임 영역과 송동현의 응모권·공통 요청·목업 제거 지원 경계를 조율하라.

G01 목록·G02 상세·G05 개인 통계·G03 시작·G04 결과와 보상을 한 작업으로 묶어라.
관리자 게임·보상 조건 관리도 포함하되 AG01~AG03과 변경/예약은 상세 계약 후속이다.
사용자 게임 계약과 혼동하지 말고 최소 운영 범위·진행 중 플레이 보호·다음 KST 기준일
적용을 담당자와 확정한 뒤 승인된 화면/요청만 구현하라. 임의 CRUD를 만들지 마라.
색깔·타꼬런·타이밍·주문 네 계약은 채택됐다. 뒤 두 게임을 미확정으로 취급하지 마라.
DB UUID로 호출하고 code로 플레이어를 선택하며 임시 dailyLimit/remainingPlays를 제거하라.
시작 응답 전에는 플레이하지 말고 서버 rules·seed·playId/playToken을 사용하라.
색깔 answers, 타꼬런 120Hz endTick/inputs, 타이밍 정수 ms taps, 주문 rounds/picks를
각 세부 계약대로 기록·제출하라. 단일 POST /play와 점수 단독 전송을 제거하라.
validPlayCount는 누적 횟수다. 오늘 플레이나 개별 플레이 목록으로 표시하지 마라.

변경 파일·공통 세션/결과 처리와 게임별 입력 기록의 책임·검증 계획을 제시해 승인받아라.
승인된 범위는 재승인 없이 진행하되 계약·구조 변경은 별도로 확인한다.
동일 플레이 재시도에 원본 입력을 유지하고 PROCESSING·INVALID·reward=null·
404/409/413/429를 구분하라. 보상은 서버 확정 KST 일자·하루 1장·4등급을 따른다.
중도 종료, 최소 점수 경계, 자정, ADMIN 시작 가능/제출·통계 불가를 검증하라.
BE/FE 공통 예제의 실제 실행 결과를 대조하고 T01/T02의 지급·기록과 일치시켜라.

검증 후 gameHandlers의 배포 등록을 해제하고 테스트용 계약 fixture는 유지하라.
관련 테스트, format:check, lint, test:ci, build, 실제 플레이·통계 브라우저 증거를 남겨라.
로드맵·연동 현황을 갱신하되 미배포 게임은 완료 처리하지 마라.
관리자 운영 계약 미확정도 구현 또는 사용자 범위 조정 전까지 남은 조건으로 보고하라.
서브에이전트·자동 머지·배포는 수행하지 마라.
```

## L5 — 이벤트·출석·미션 완성

Jira 제목: **`[FE] 이벤트 상태·응모 정합성 및 출석·미션 운영 기능 완성`**

```text
getddo-fe 로드맵 L5를 진행하려고 한다.
AGENTS.md, docs/CONTEXT.md, docs/backend-integration-status.md,
docs/superpowers/plans/2026-10-20-backend-integration-roadmap.md의 L5를 읽어라.
../getddo-spec/00-requirements/functional-requirements.md, scope.md,
05-api/event.md, entry.md, attendance.md, mission.md와 해당 도메인 규칙이 기준이다.
git 상태·원격 dev·기존 GD-233/GD-239/GD-242~247 반영을 코드로 확인하라.

장준환의 이벤트·응모·결과, 박소연의 출석·미션, 송동현의 현황·응모권·공통 기반
책임을 조율하고 신규 관리자 화면 담당을 확정할 수 있게 계획을 제시하라.
취소 상태 축약 해소·목록/합계 정확성·사용자 적립 검증과
관리자 출석 정책 AP01~AP04·미션 AM01~AM04를 한 작업으로 묶어라.
새 메뉴/라우트·feature 구조는 구현 전 승인받고, 이미 승인된 동일 범위는 진행하라.

CANCELED를 발표 대기로 표시하지 말고 GD-247의 종결 오류·429·표시 행 정책을 보존하라.
E01/E06 전체 수집을 줄일 때 전체 합계·결과 필터 의미를 깨지 마라.
요약 계약이 없으면 일부 페이지 합계를 전체로 표시하지 말고 필요한 협의를 제시하라.
멤버십·브론즈 전용·누적 5장·월말 예외·중복 응모·취소 반환을 검증하라.
출석은 일일/연속/월 경계·중복 지급, 미션은 누적 정답·필수 설문·멱등·1회 보상을 확인하라.
출석 정책 예약은 다음 KST 기준일/월에 적용하고 없는 예약 수정 API를 만들지 마라.
미션 등록은 즉시 ACTIVE·보상 1장이다. 관리자 승인/반려·DRAFT를 추가하지 마라.
설문 집계는 정확한 KST 기간·미션 ID·실제 응답으로 확인하라.
자동 당첨 취소·이용 제한·추첨 제외·재현율 및 README의 오래된 안내를 정리하라.

기존 테스트 확장, 신규 운영 화면 테스트, 모바일·권한·실패·실제 API 검증 후
format:check, lint, test:ci, build를 실행하라.
L2 공개·L3 배너와 상태/경로를 대조하고 로드맵·연동 현황을 갱신하라.
서브에이전트·자동 머지·배포는 수행하지 마라.
```

## L6 — 목업 종료·통합 인수

Jira 제목: **`[FE][통합] 배포 목업 제거·시연 사용자 전환 및 전체 서비스 인수 검증`**

```text
getddo-fe 로드맵 L6의 배포 목업 종료와 프로젝트 인수 검증을 진행하려고 한다.
AGENTS.md, docs/CONTEXT.md, docs/backend-integration-status.md,
docs/superpowers/plans/2026-10-20-backend-integration-roadmap.md 전체,
../getddo-spec/00-requirements/와 05-api/common.md, user.md를 읽어라.
git 상태·원격 dev·L1~L5의 커밋/PR/실서버 증거를 대조하라.
체크박스만으로 완료를 판단하지 말고 남은 계약·담당·배포 차이를 먼저 제시하라.

송동현 통합 영역 중심으로 시연 사용자 공급·캐시 격리·가상 시계 안내·MSW 종료와
전체 사용자/관리자 흐름을 한 작업으로 마무리하라.
추천은 기존 VITE_VIRTUAL_USERS_JSON을 명시적 시연 설정으로 직접 읽고 샘플 대체를
없애는 방식이다. 사용자 문맥·환경 변수·빌드/배포 설정 변경안을 먼저 제시해 승인받아라.
기존 승인 범위는 재승인하지 말고 새로운 인증·로그인 API를 임의로 만들지 마라.
AO01을 일반 사용자의 계정 선택 API로 호출하지 마라.
실제 DB 등록 시연 계정은 유지하고 DB 데이터를 삭제하지 마라.

도메인 실연동 확인 후 배포에서 브라우저 MSW 부팅·가짜 업무 응답을 제거하라.
테스트용 MSW·fixture·필요한 로컬 개발 목업은 유지한다.
/virtual-users·비계약 /play·샘플 ID·가짜 집계·오류 시 샘플 응답을 점검하라.
기존 설치 브라우저와 새 브라우저에서 앱 전용 Worker 잔존 여부를 확인하라.
가상 시계로 서버 추첨/발표가 실행된다고 안내하지 말고 서버 일정 기반 시연을 준비하라.

격리 데이터로 사용자 선택→배너→출석/미션/네 게임 적립→응모→자동 추첨→
관리자 검토/단일 발표→공개/본인 결과→알림→별도 이벤트 취소 반환을 검증하라.
사용자 전환·403/404/429·재연결·중복 요청·320/390px·200% 확대·키보드를 확인하라.
관리자 사용자·응모권·응모·집계·미션·출석 정책·게임 운영·배너·차단도 검증하라.
성능 목표는 실제 측정값과 조건을 남기고 미측정/미달을 통과로 보고하지 마라.

format:check, lint, test:ci, build, Network·브라우저·배포 후보 검증 근거를 남기고
README·CONTRIBUTING·연동 현황·로드맵과 시연/복구 절차를 갱신하라.
미확정 필수 기능은 숨기거나 목업으로 통과시키지 말고 남은 완료 조건으로 보고하라.
검증된 PR·배포 후보를 제시하되 자동 머지·실제 배포·서브에이전트는 수행하지 마라.
```
