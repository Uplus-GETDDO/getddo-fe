# GD-225 실연동 하이브리드 목록 갱신·계약 정합 후속 Implementation Plan

> **For agentic workers:** 단일 세션에서 순서대로 실행한다. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 실서버 실측(2026-10-17)을 `hybridHandlers`·폴링 조건·오류 매핑에 반영하고, 상위 감사 문서 3개를 최신화한다.

**Architecture:** MSW 하이브리드(프로덕션 빌드는 `hybridHandlers`만 가로채고 나머지는 bypass — `src/mocks/browser.ts`). `useEvent`는 `select`로 화면 모델을 파생해 캐시에는 spec 원시 응답을 남기고, 폴링 종료를 원시 상태로 판정한다.

**Tech Stack:** TS, React Query v5, MSW, Zod, Vitest.

**Spec:** `../getddo-spec/05-api/common.md`(오류 코드), `game.md`(G01~G05), `drawing.md`(E08/E09·AD01~AD09)

## Global Constraints

- FSD 규칙 — 조회 훅은 `entities/*/api/`, 쿼리 키 상수 재사용, `import type`만 타입 import.
- 커밋·PR에 AI 어트리뷰션 금지. Conventional Commits, 제목 소문자 시작.
- 완료 전 `format:check`·`lint`·`test:ci`·`build` 전부 통과.
- 커밋 안 된 docs/ 10개 변경(작업트리에 존재)도 이 PR에 포함한다.

## 후속 이관 (2026-10-19)

잔여 계약은 [2026-10-19 후속 계획](2026-10-19-gd225-contract-sync-followup.md)으로 이관했다. Task 1~3과 저장소 문서 동기화는 `cfb35a2`(PR #89)에 반영됐다. 아래 하이브리드 코드 예시는 10월 17일 이력이며 배너·관리자 응모권은 후속에서 해제한다. Task 4의 저장소 밖 감사·요청 문서 3개는 현재 워크스페이스에 없어 재작성하지 않았으며, 현행 계약 상태는 `docs/CONTEXT.md`를 기준으로 정합화한다. Task 5의 당시 검증·PR은 PR #89 병합 이력이며, 이번 후속의 검증은 별도로 수행한다.

거절 응모 이력·M03 claimId·AE05/AE08은 현행 spec·FE/목업에 반영되어 계약 누락 요청에서 해소됐다. 관리자 멤버십 NULL 근본 해결·CANCELED 노출 정책·게임 계약 정합·미배포 관리자 추첨은 후속에 남긴다.

## 실측 결론 (2026-10-17, 해제 판정 근거)

| 도메인                          | 실서버                                | 스키마 대조                                                        | 판정     |
| ------------------------------- | ------------------------------------- | ------------------------------------------------------------------ | -------- |
| E08 `/v1/events/{id}/results`   | 200                                   | `publicResultsSchema` 통과                                         | **해제** |
| E09 `/v1/events/{id}/my-result` | 200                                   | `myResultSchema` 통과                                              | **해제** |
| G01 `GET /v1/games`             | 200 — `{id, code, name, description}` | `gameSchema` 실패(`title`·`dailyLimit`·`remainingPlays` 필수 부재) | **유지** |
| G02·G05                         | 200 존재                              | FE가 호출 안 함                                                    | 유지     |
| G03 `POST /plays`               | 201 존재                              | FE는 비spec 경로 `/play` 단일 제출 사용                            | 유지     |
| AD01~AD09 `/v1/admin/draws*` 등 | 404                                   | —                                                                  | **추가** |

---

### Task 1: `hybridHandlers` 갱신 — `src/mocks/handlers/index.ts`

**Files:** Modify: `src/mocks/handlers/index.ts`

- [x] `drawResultHandlers`를 hybridHandlers에서 제거 (E08/E09 실서버 통과 확인)
- [x] `drawHandlers`를 hybridHandlers에 추가 (AD01~AD09 실서버 404)
- [x] 주석을 실측 기준으로 갱신 — game은 "응답 형상 불일치(name↔title 등) + FE 비spec `/play` 경로"로 사유 변경, draw는 "배포 미구현(2026-10-17 실측 404)"
- [x] 기존 핸들러 테스트는 전체 목업(`handlers`) 대상이라 `npm run test:ci`로 회귀만 확인

```ts
export const hybridHandlers = [
    ...abuseHandlers, // /v1/admin/abuse-cases — 배포 미구현(2026-10-17 실측 404)
    ...adminTicketHandlers, // /v1/admin/ticket-* — 배포 미구현(404)
    ...auditHandlers, // /v1/admin/audit-logs — 이번 버전 제외(ADR-024), 실서버 404
    ...bannerHandlers, // /v1/banners, /v1/admin/banners — 배포 미구현(404)
    ...drawHandlers, // /v1/admin/draws*·/wins/*·/cancellations/* — 배포 미구현(404)
    ...gameHandlers, // /v1/games — 서버는 있으나 GameSummary 형상이 FE 계약과 불일치(title·dailyLimit 부재), /play는 비spec 경로
    ...virtualUserHandlers, // /virtual-users — spec外 시연 전용 경로
];
```

- [x] 커밋: `fix(mocks): 실서버 구현 분을 하이브리드 목업에서 해제하고 미구현 추첨 관리를 추가`

### Task 2: `useEvent` 폴링 종료 조건 — `src/entities/event/`

**Files:**

- Create: `src/entities/event/model/eventStatus.ts` + `eventStatus.test.ts`
- Modify: `src/entities/event/api/queries.ts` (select 도입)
- Modify: `src/entities/event/index.ts` (export)

**Interfaces:** Produces `isEventFinished(status: AdminEventStatus): boolean` — `PUBLISHED`·`NO_ENTRANTS`·`NO_ELIGIBLE_ENTRANTS`·`CANCELED`에서 true.

- [x] RED: `eventStatus.test.ts` — 종결 4종 true / `SCHEDULED`·`OPEN`·`CLOSED`·`DRAW_CONFIRMED`·`REDRAWING` false
- [x] GREEN: `model/eventStatus.ts` 작성
- [x] `queries.ts`: `useEvent`의 queryFn이 `EventDetailResponse`를 반환하고 `select: toEvent`로 화면 모델 파생. `refetchInterval`은 `query.state.data?.status`(원시)로 `isEventFinished` 판정
- [x] 소비처 확인: `useEvent` 반환 타입은 `Event` 그대로(select 적용값) — EventDetailPage·TimeRaffleDetailPage 무수정
- [x] 커밋: `fix(event): 취소된 이벤트 상세의 영구 폴링 중단`

```ts
refetchInterval: (query) => {
    const status = query.state.data?.status;
    return status && isEventFinished(status) ? false : queryPresets.realtime.refetchInterval;
},
select: toEvent,
```

### Task 3: 오류 코드 매핑 보강 — `src/shared/api/errorMessage.ts`

**Files:** Modify: `src/shared/api/errorMessage.ts`, `src/shared/api/errorMessage.test.ts`

추가(실서버 현행 코드, common.md):

- `USER-002`(미등록 ID)·`USER-003`(헤더 누락) → USER_CONTEXT_REQUIRED 문구 계열
- `USER-004`(역할 불일치) → USER_CONTEXT_INVALID 문구 계열
- `USER-005`(DB 멤버십 없음) → 멤버십 정보 없음 문구
- `USER-006`(멤버십 불일치) → USER_MEMBERSHIP_MISMATCH와 동일 문구
- `COMMON-001`(500) → 서버 오류 문구 (매핑이 fallback보다 우선 — ADR-0008)
- `COMMON-005`(JSON/UUID 해석 실패) → 요청 형식 오류 문구
- `COMMON-006`(429) → RATE_LIMIT_EXCEEDED와 동일 문구 + `retryAfterSeconds` 대기 표시 분기를 두 코드 모두에 적용
- `HTTP-404` → '요청한 대상을 찾을 수 없습니다.'
- `ENTRY-010`(ADMIN_REQUIRED) → 권한 문구
- `MISSION-001`~`005` → 미션 구성/답변 형식/찾을 수 없음/미오픈/멱등 충돌

의도적 비매핑(주석으로 명시): `COMMON-002`는 서버의 구체 입력 위반 문구가 공개 계약상 신뢰 대상이라 매핑하면 문구가 죽는다 — 매핑하지 않고 서버 message를 통과시킨다.

구형 이름 코드(`USER_MEMBERSHIP_MISMATCH`·`INSUFFICIENT_TICKETS` 등)는 삭제하지 않고 병존 — 목업 핸들러가 계속 방출하고 spec상 '제안' 상태라 향후 채택 가능. 번호 코드(현행)·이름 코드(제안/목업) 섹션을 주석으로 구분한다.

- [x] RED: 신규 코드별 매핑 문구 + COMMON-006의 Retry-After 표시 테스트 추가
- [x] GREEN: 매핑 테이블·주석 반영
- [x] 커밋: `fix(api): 실서버 오류 번호 코드 매핑 보강`

### Task 4: 감사 문서 최신화 — `../` 3개 md

**Files:** Modify: `../api-contract-audit-2026-10-16.md`, `../be-contract-request-2026-10-16.md`, `../be-data-request.md`

삭제 금지 — "해결됨(2026-10-17 실측)" 표기로 이력 유지:

- audit: `drawScheduledAt` 리네임 해결·E03/E06 구현됨(200)·ATTENDANCE-001 해소·games/E08/E09 실서버 존재(단 G01 형상 불일치로 게임은 목업 유지)·ADMIN 멤버십 409는 FE 헤더 생략으로 우회(GD-215, 배포 반영 확인 필요)
- be-contract-request: 요청 1-1(drawScheduledAt)·요청 2(E03/E06) 해결 표기. 잔여: M03 claimId·거절 응모 이력(GD-200)·AE05/AE08·draws 미구현·3-x 계약 확인 질의·관리자 멤버십 NULL 근본 해결·CANCELED 노출 정책
- be-data-request: 요청 1(ATTENDANCE-001)·요청 2(FE 우회로 해소, 근본 해결은 잔여) 해결 표기. 시드 데이터 요청은 게임·결과가 실서버로 넘어간 점 반영해 목록 갱신

- [x] 커밋: `docs: 실측 기준으로 계약 감사·요청 문서 해결 항목 갱신`

### Task 5: 검증·PR

- [x] `npm run format:check && npm run lint && npm run test:ci && npm run build`
- [x] `git push -u origin fix/GD-225` → `gh pr create --base dev` (템플릿 전부 작성)
- [x] 작업트리에 있던 docs/ 10개 변경도 함께 커밋(`docs:`)
