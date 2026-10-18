# GD-225 잔여 — spec 동기화·실연동 정합 후속 Implementation Plan

> **For agentic workers:** 단일 세션에서 순서대로 실행한다. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** getddo-spec 최신 확정(R2·R4·R7, ADR-025 플래티넘, 알림 오류 코드, 배너 1기반 순서)을 FE 코드·docs에 반영하고, 2026-10-19 실측 기준으로 `hybridHandlers`를 갱신한다.

**Architecture:** MSW 하이브리드(프로덕션 빌드는 `hybridHandlers`만 가로챔 — `src/mocks/browser.ts`). spec 계약이 원천이며 목업 DTO는 확정 계약에 맞춘다. 관리자 신규 화면(AO06·AP·AM·AS01·AM04)은 이번 범위에서 제외하고 문서만 정리한다(사용자 확정 2026-10-19).

**Tech Stack:** TS, React Query v5, MSW, Zod, Vitest, Tailwind v4.

**Spec:** `../getddo-spec/05-api/event.md`(R2 AE01·R7 myEntered·R4 겟또타임), `notification.md`(오류 정정), `banner.md`(1~N 순서·삭제 보존), `ticket.md`+ADR-025(플래티넘), `admin-stats.md`·`mission.md`(AS01·AM04 — 미배포, 문서만)

## 2026-10-19 배포 BE 실측 (dzc8oneey9mmx.cloudfront.net, 계획의 근거)

- 존재(400/401): E01~E09, T01·T02, AT01~03, M01~04, N01~03, B01, G01~05, AE01~AE08, AO01~09, AO06·AO07, AP01~04, AM01~03, AN01~05, AB01~05
- 미배포(404): **AS01** `/v1/admin/stats/daily`, **AM04** `/v1/admin/missions/{id}/survey-summary`, AD01~AD09 `/v1/admin/draws*`, `/v1/admin/abuse-cases`, `/v1/admin/audit-logs`

## Global Constraints

- FSD 규칙 — 조회 훅은 `entities/*/api/`, 쿼리 키 상수 재사용, `import type`만 타입 import.
- 커밋·PR에 AI 어트리뷰션 금지. Conventional Commits, 제목 소문자 시작.
- 완료 전 `format:check`·`lint`·`test:ci`·`build` 전부 통과.
- 사용자 이벤트 목록 UI(GD-233, PR #90)는 건드리지 않는다 — `myEntered`는 스키마·목업·화면 모델까지만.
- 브랜치 `fix/GD-225`를 `dev`에서 새로 생성한다 (원격 동명 브랜치 없음 확인됨).

---

### Task 0: 브랜치 생성

- [x] `git switch -c fix/GD-225` (dev 최신 `cfb35a2` 기준)

### Task 1: 목업 오류 코드 현행화 — notification·entry

**Files:** Modify: `src/mocks/handlers/notification.ts`, `src/mocks/handlers/notification.test.ts`, `src/mocks/handlers/entry.ts`

spec 정정(2026-10-18): `USER_CONTEXT_REQUIRED`→`USER-003`, `USER_CONTEXT_INVALID`→`USER-002`, `USER_MEMBERSHIP_MISMATCH`→`USER-006`.

- [x] `notification.ts` 3곳 `USER_CONTEXT_REQUIRED` → `USER-003`
- [x] `notification.test.ts` — 401 기대값·테스트명 갱신 ("헤더 없으면 401 USER-003")
- [x] `entry.ts:443` `USER_MEMBERSHIP_MISMATCH` → `USER-006` (공통 계약 멤버십 불일치 코드)
- [x] `src/mocks/handlers/` 전체 grep으로 `USER_CONTEXT_|USER_MEMBERSHIP_MISMATCH` 잔여 확인 → 있으면 같은 기준으로 교체
- [x] 커밋: `fix(mocks): 사용자 문맥 오류를 현행 번호 코드로 정정`

### Task 2: E01 `myEntered` (R7)

**Files:** Modify: `src/entities/event/model/contract.ts`, `src/entities/event/model/types.ts`(Event 화면 모델), `src/entities/event/model/utils`(toEvent 매퍼, 있으면), `src/mocks/handlers/entry.ts`, `src/mocks/handlers/event.ts`

spec: E01 각 EventSummary에 `myEntered:boolean` 항상 반환. 정상 접수 응모가 있으면 true(취소·반환 후에도 기록 기준 유지), 거절만·미응모·관리자 조회는 false. E02·AdminEvent에는 없다.

- [x] `contract.ts` — `eventSummaryResponseSchema`에 `myEntered: z.boolean().optional()` 추가 + 주석 "spec 필수이나 BE 배포 확인 전까지 optional". `eventDetailResponseSchema`는 extend라 자동 포함 — spec은 E02에 없다고 하므로 `myEntered`를 detail에서 `omit`하거나 그대로 두되 매퍼에서 무시한다 (BE가 E02에 안 보내면 optional이라 무해 — 두되, 주석으로 명시)
- [x] `types.ts` Event 스키마 — `myEntered: z.boolean().default(false)` 추가 (화면 모델은 항상 boolean)
- [x] `toEvent` 매퍼 — `myEntered: raw.myEntered ?? false`
- [x] `entry.ts` — `mockUserHasAcceptedEntry(userId, eventId): boolean` export 추가 (`myAcceptedFor` 재사용, ACCEPTED 건 존재 여부)
- [x] `event.ts` — `toSummary(event, now)`에 `myEntered` 계산 추가: 시그니처를 `toSummary(event, now, userId)`로 바꾸고 `http.get('/v1/events')`에서 `request.headers.get('X-User-ID')`를 넘긴다. userId 없거나 관리자면 false. `toResponse`에는 넣지 않는다 (E02는 spec상 myEntered 없음 — 목업도 제외)
- [x] 기존 이벤트 핸들러 테스트에 myEntered 케이스 추가(응모한 사용자 true / 미응모 false / 헤더 없음 false)
- [x] 커밋: `feat(event): e01 목록에 내 응모 여부 myEntered 반영`

### Task 3: AE01 검색 확장 (R2)

**Files:** Modify: `src/entities/event/api/adminQueries.ts`, `src/pages/admin/events/AdminEventsPage.tsx`, `src/mocks/handlers/adminEvent.ts`, `src/shared/api/errorMessage.ts`(+test)

spec 파라미터: `sort`(createdAt/startsAt/endsAt/title + `,asc|,desc`, 기본 `createdAt,desc`, 동값은 id 같은 방향), `weightingEnabled`(boolean), `createdFrom`·`createdTo`(KST `YYYY-MM-DD`, `createdAt` 기준 양끝 포함). 위반은 400 `EVENT-008`.

- [ ] `AdminEventsParams`에 `sort?: string`, `weightingEnabled?: boolean`, `createdFrom?: string`, `createdTo?: string` 추가 — 쿼리 스트링으로 그대로 전달 (boolean은 `'true'`/`'false'`)
- [ ] `adminEvent.ts` AE01 핸들러 — `sort` 파싱(`field,dir` 분리, 허용 목록 외·형식 오류 → 400 `EVENT-008`), `weightingEnabled` 필터(`'true'`/`'false'` 외 값은 무시하지 않고 형식 오류 없이 그냥 필터 — spec은 boolean 검증을 공통에 위임, 목업은 'true'/'false'만 해석), `createdFrom`·`createdTo`(KST 날짜 → `createdAt` 기준 양끝 포함 비교, `createdFrom > createdTo` → `EVENT-008`), 기본 정렬 `createdAt,desc` + id 타이브레이크 유지
- [ ] `AdminEventsPage` — 정렬 Select(`등록일 최신`/`등록일 오래된`/`시작일 빠른`/`시작일 늦은`/`마감일 빠른`/`마감일 늦은`/`제목 오름차순`/`제목 내림차순`), 가중치 Select(전체/가중치 적용/미적용), 등록일 `DateRangeFilter`(basis="등록일", `createdFrom`·`createdTo`는 `YYYY-MM-DD` 그대로 전송 — UTC 변환하지 않음). `hasAppliedFilters`·`resetFilters`·검색 draft 패턴에 새 상태 통합
- [ ] `errorMessage.ts` — `EVENT-008: '검색 조건을 확인해 주세요.'` 추가 + 테스트
- [ ] 목업 테스트 — sort 정상·비정상(EVENT-008), weightingEnabled, createdFrom/To 경계·역전(EVENT-008)
- [ ] 커밋: `feat(event): 관리자 이벤트 검색에 정렬·가중치·등록일 조건 추가`

### Task 4: 플래티넘 등급 (ADR-025)

**Files:** Modify: `src/entities/ticket/model/types.ts`, `src/entities/ticket/model/grade.ts`, `src/app/styles/tokens.css`, `src/mocks/handlers/ticket.ts`(`drawMockTicketGrade`), `src/mocks/handlers/adminTicket.ts`(시드 등급 필요 시), docs는 Task 7

spec: `PLATINUM` 추가 — 확률 브론즈 79.98·실버 18·골드 2·플래티넘 0.02(%), 가중치 10, 지급 1장, 출석은 브론즈 고정 유지.

- [ ] `ticketGradeSchema` → `['BRONZE','SILVER','GOLD','PLATINUM']` — Record<TicketGrade,…> 사용처 전부 컴파일 오류로 드러나므로 tsc가 수정 지점을 알려준다
- [ ] `grade.ts` — LABEL `플래티넘`, DOT `bg-grade-platinum`, WEIGHT `PLATINUM: 10`, ODDS를 `BRONZE:79.98, SILVER:18, GOLD:2, PLATINUM:0.02`로 (주석 갱신)
- [ ] `tokens.css` — `--color-grade-platinum: #3e5c76;` · `--color-grade-platinum-soft: #dde6ee;` (골드 계열 다음 프리미엄 등급 — 스틸 블루, 디자인 확정 전 임의값 아닌 토큰으로만 추가)
- [ ] `drawMockTicketGrade` — 누적 분기 `roll<0.7998 BRONZE / <0.9798 SILVER / <0.9998 GOLD / else PLATINUM`
- [ ] 등급 노출 UI(`TicketGradePill`·`GradeTicketTiles`·`TicketHistoryRow` 등)와 `EntryReceipt` tickets 맵·관리자 티켓 목업(`adminTicket.ts` 시드 grade) 점검 — Record 누락·switch default만 수정, 시드는 필요할 때만 PLATINUM 포함
- [ ] `entry` 응모 목업의 `tickets` 맵 검증(허용 등급 키 목록)에 PLATINUM 포함 확인
- [ ] 관련 테스트 갱신(확률표·등급 enum 스냅샷 등 실패분)
- [ ] 커밋: `feat(ticket): 플래티넘 응모권 등급과 가중치 반영 (ADR-025)`

### Task 5: 배너 계약 정합 — 1기반 순서·삭제 보존·eventId nullable

**Files:** Modify: `src/entities/banner/model/types.ts`, `src/mocks/handlers/banner.ts`, `src/mocks/handlers/banner.test.ts`, `src/mocks/handlers/adminEvent.ts`(removeMockBannersOfEvent 호출부), `src/features/manageBanner`(순서 UI 산술 필요 시)

spec(2026-10-15 채택): 목록 순서 1~N, 등록 1~N+1(N=5 거절 `BANNER-004`), 수정 1~N 이동, 삭제 시 빈자리 당김, AB05 전체 ID 원자 반영(409 `BANNER-005`), 이벤트 삭제로 배너 자동 삭제 없음 — 삭제·취소 이벤트 연결분은 사용자 B01에서만 숨기고 관리자 목록 보존, 이전 행 AdminBanner `eventId` nullable.

- [ ] `types.ts` — `adminBannerSchema`의 `eventId`를 `.nullable()`로, `displayOrder`를 `min(1)`로 (B01 사용자 Banner는 `int` 유지 여부 확인 — spec은 int만 명시, 목업 write 검증이 1~N을 강제)
- [ ] `banner.ts` 목업 — 시드 `displayOrder` 0,1,2 → 1,2,3; 등록 위치 검증 0~N → 1~N+1; 삽입·이동·당기기 산술 전부 1기반으로 (`item.displayOrder !== index` → `index + 1`)
- [ ] `adminEvent.ts` — `removeMockBannersOfEvent` 호출 제거(이벤트 삭제 시 행 보존), 대신 B01 핸들러가 연결 이벤트를 조회해 목록에서 없거나 `CANCELED`면 숨긴다 (mockEvents에 없는 id = 삭제됨)
- [ ] `manageBanner` UI·테스트에서 0기반 순서 가정(표시 `displayOrder + 1` 등) 수정
- [ ] `banner.test.ts` 전면 갱신 — 1~N 경계, 삽입 밀기, 삭제 당기기, 이벤트 삭제 후 사용자 목록 숨김·관리자 보존
- [ ] 커밋: `fix(banner): 확정 계약의 1기반 순서와 이벤트 삭제 시 행 보존 적용`

### Task 6: `hybridHandlers` 갱신 — 배포 확인분 해제

**Files:** Modify: `src/mocks/handlers/index.ts`

- [ ] `bannerHandlers` 제거 — B01·AB01~05 배포 확인(2026-10-19 실측 400)
- [ ] `adminTicketHandlers` 제거 — AO03·AO04·AO05·AO08·AO09 배포 확인
- [ ] 주석 갱신 — 실측일 2026-10-19, 유지 사유: draw·abuse(미배포 404)·audit(버전 제외 ADR-024)·game(형상 불일치)·virtualUsers(spec外). AS01·AM04 미배포(404)지만 FE 미호출이라 핸들러 없음을 명기
- [ ] 커밋: `fix(mocks): 배포된 배너·관리자 응모권을 하이브리드 목업에서 해제`

### Task 7: docs 동기화

**Files:** Modify: `docs/CONTEXT.md`, `docs/DESIGN-SYSTEM.md`, `docs/superpowers/plans/2026-10-17-gd225-hybrid-contract-followup.md`

- [ ] `CONTEXT.md` "백엔드 연동 전 임시 상태" — 2026-10-19 실측 매트릭스로 갱신: AS01·AM04·draws·abuse 미배포(목업 유지/미연동), banner·adminTicket 실연동 해제, AO06/AO07·AP01~04·AM01~03·AS01·AM04는 BE 구현·배포(또는 병합)됐으나 FE 연동 후속, R2/R4/R7 반영, 알림 코드 현행화, 플래티넘(적용 시점 후속 표기), 거절 이력·claimId·AE05/AE08 해소 정정. 잔여: 멤버십 NULL 근본 해결·CANCELED 노출 정책(BE/정책)
- [ ] `CONTEXT.md` 도메인 표 — R4 겟또타임 용어("기본 이벤트 NO_TICKET·겟또타임 TICKET") 반영
- [ ] `DESIGN-SYSTEM.md` — grade 토큰 표에 `--color-grade-platinum`/`-soft` 추가
- [ ] 기존 GD-225 계획 파일 — 코드 반영 확인된 Task 1~5 체크박스를 `[x]`로 정합화 + "잔여 계약은 2026-10-19 후속 계획으로 이관" 표기
- [ ] 커밋: `docs: spec 확정분과 실측 기준으로 연동 상태 갱신`

### Task 8: 검증·PR

- [ ] `npm run format:check && npm run lint && npm run test:ci && npm run build` 전부 통과
- [ ] `git push -u origin fix/GD-225` → `gh pr create --base dev` (템플릿 전부 작성, 관련 이슈 GD-225)
- [ ] 머지는 사용자 승인 후 — 이 계획은 머지까지 자동으로 진행하지 않는다

## 잔여(이번 범위 제외 — 문서 기록만)

- AS01·AM04·AO06·AO07·AP01~04·AM01~03 FE 연동 — 신규 관리자 화면, 별도 이슈
- draws·abuse·audit — BE 미배포, 목업 유지
- 관리자 멤버십 NULL 근본 해결·CANCELED 노출 정책 — BE/정책 잔여
- `myEntered` 화면 표시 — GD-233 영역
- 게임 계약 정합(G01 형상·G03/G04 2단계) — 기존 후속 유지
