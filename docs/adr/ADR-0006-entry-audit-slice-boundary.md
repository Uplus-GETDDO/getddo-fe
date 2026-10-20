# ADR-0006: 응모 기록·감사 로그 슬라이스 경계

- 상태: accepted
- 날짜: 2026-10-08

## 맥락

기획 단계에서 "응모 내역(entry)", "참여 로그(participation-log)", "감사 로그" 세 개념이 혼용됐다. 감사 로그는 관리자 변경 기록(처리자·시각·변경 전후)이라 응모 기록과 성격이 다르지만, entry와 participation-log는 경계가 불분명해 슬라이스를 어떻게 나눌지 정해지지 않았다.

공용 API 초안(`../getddo-spec/05-api/entry.md`, `audit.md`)을 확인한 결과:

- 응모 기록은 `EntryReceipt` 하나로 표현된다. 접수(`ACCEPTED`)뿐 아니라 업무 거절(`REJECTED`, `rejectionCode`·`rejectionReason`)도 같은 모델로 E05/E06에서 조회한다 — "참여 시도 로그"가 별도 리소스로 존재하지 않는다
- 감사 로그는 AU01/AU02의 별도 리소스다 (`actorId`, `action`, `targetType`, `beforeData`/`afterData`) — (후속: ADR-024로 공통 감사 조회 API와 전용 화면은 이번 버전에서 제외됐다. 감사 기록 저장 자체는 유지된다, 2026-10-15)
- spec 어디에도 participation-log라는 리소스·용어가 없다

## 결정

- **participation-log 슬라이스를 만들지 않는다.** 응모 시도·접수·거절 이력은 모두 `entities/entry`가 소유한다 (`EntryReceipt` 기반)
- 관리자 응모 조회(AO06 `AdminEntry`)도 `entities/entry`에 둔다 — `EntryReceipt` 전체 + `userId`·nullable `participantId`라 같은 모델의 확장이다(`05-api/entry.md`, GD-218 현행 구현)
- 감사 기록 저장은 공용 ADR-024에 따라 유지하지만 공통 감사 조회 AU01·AU02와 전용 화면은 이번 버전에서 제공하지 않는다. 기존 `entities/audit`·감사 화면은 과거 초안 기반 구현이며 현재 제공 범위의 근거가 아니다. 응모 화면은 감사 로그에 의존하지 않는다
- 응모 현황 집계(E03 `EntryStatistics`)도 응모 도메인이므로 `entities/entry`에 둔다 (ADR-0007)
- 추첨 업무별 실행 이력은 `05-api/drawing.md`의 `GET /admin/draws/{drawId}/failures`·`execution-audits`를 사용한다. 공통 감사 조회를 재사용하거나 다시 제공하는 것으로 해석하지 않는다
- 오너: `entities/entry`는 응모 기능 담당, 감사 기록은 각 업무 담당이 유지한다. 업무별 조회는 해당 도메인 계약을 따른다

## 결과

- 개념이 2개(응모 기록, 감사 로그)로 줄어든다. "참여 로그"라는 표현은 문서·티켓에서 "응모 내역"으로 통일한다
- 백엔드가 이후 "응모 시도 로그"(형식 오류·인증 실패 포함)를 별도 리소스로 제공하기로 하면 이 ADR을 다시 연다 — 현재 응모 계약은 해당 이력을 "제공하지 않는다"고 명시한다. AO06·AO07은 GD-218 현행 구현 범위이며 `AdminEntry`에는 `userId` 외에 nullable `participantId`도 포함한다(`05-api/entry.md`)
