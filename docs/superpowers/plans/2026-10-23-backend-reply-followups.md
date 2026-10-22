# 백엔드 회신 반영 후속 작업 Implementation Plan

> **For agentic workers:** REQUIRED: dispatch a fresh subagent per task (recommended) or use the `executing-plans` skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백엔드 확정 회신(GD-314)을 FE 코드·목업·문서에 반영하고, GD-268(drawScheduledAt=endsAt+60초)의 배포 상태를 재측정한다.

**Architecture:** 문구·표시 규칙은 확정 계약(getddo-spec `05-api/drawing.md` GD-314 절)에 정렬한다. 감사 `action` 라벨은 `entities/drawResult/model/`의 기존 라벨 맵 관례(`runStatus.ts`의 `DRAW_RUN_STATUS_META`·`DRAW_TYPE_LABEL`)를 따라 상수로 둔다. 목업의 감사 기록은 확정된 action 값 집합(`DRAW_EXECUTE`·`DRAW_RESUME`)만 방출하도록 정합화한다. 재측정은 `scripts/verifyL6RemainingReads.mjs`의 GD-268 블록과 같은 방식의 읽기 전용 스크립트로 증거 JSON을 `reports/`에 남긴다.

**Tech Stack:** TypeScript, React 19, TanStack Query, Zod, MSW, Vitest

**Spec:** `../getddo-spec/05-api/drawing.md` — 305행(PUBLICATION-002 문구), 148~156행(실행 감사 표시 계약 — GD-314), 312행(GD-268 마감+1분)

## Global Constraints

- FSD 레이어 규칙: `app → pages → widgets → features → entities → shared`, 딥 임포트 금지(슬라이스 루트 `index.ts` 경유)
- 새 dependency 없음, API contract 변경 없음(표시·목업만 정렬)
- 한국어 문구는 확정 계약 문구를 그대로 사용: `추첨 결과가 아직 발표 가능한 상태가 아닙니다.`
- 검증: `npm run format:check` · `npm run lint`(0 warnings) · `npm run test:ci` · `npm run build` · `git diff --check` 전부 통과
- 커밋: Conventional Commits, 제목 한글·소문자 시작 안전, AI 어트리뷰션 트레일러 금지
- PR: 작업 브랜치 → `dev`, 생성 후 `@coderabbitai review` 댓글로 수동 리뷰 트리거
- 대상 외: 실패 실행 resume 실측 — 백엔드 담당자가 직접 진행하기로 함(blocked_on 기록만)
- 측정 스크립트는 `L6_DEPLOY_URL` 환경변수 필수(기본 대상 없음 — 운영 오실행 방지 관례 유지)

## 조사 결과 요청 (확정 사실)

- 스펙 `drawing.md`는 이미 확정 문구·표시 계약을 반영했다(GD-314) — getddo-spec 수정 불필요
- `PUBLICATION-002` 참조: `src/shared/api/errorMessage.ts:61-62`(매핑 문구), `src/mocks/handlers/draw.ts:1107-1111`(목업 응답 문구). 문구를 단정하는 테스트는 없다(코드만 단정)
- 감사 UI: `src/pages/admin/draw/ui/DrawOperationsSection.tsx` — 행위에 raw `action`, 처리자에 `actorName`+`actorId` UUID 병기, 사유 아래 `beforeData`/`afterData` 원문 표시 중 → 계약 위반 3건
- 목업 감사 action이 비계약 값 다수 방출: `DRAW_RUN_CREATED`(569), `DRAW_FAILED`(528), `AWARD_CANCELED`(953), `PUBLICATION_APPLIED`(1038), `RESULT_CONFIRMED`(1135), `RUN_RESUMED`(1211), `REDRAW_RESUMED`(1241). 실서버 probe는 `DRAW_EXECUTE`만 관측됨(`reports/20261021-L6-deploy-remaining-probe.json`)
- 계약상 action 값 집합 = `DRAW_EXECUTE`·`DRAW_RESUME`뿐. beforeData=시작 직전 status, afterData=새 실행 시도 attemptId(drawing.md:154)
- GD-268은 `scripts/verifyL6RemainingReads.mjs:321-362`가 이미 측정 블록을 갖고 있고 GD-296(10-22)에 15건 전부 60초 확인 이력이 있으나, `fix/GD-268` 머지·배포 완료 기준 재측정이 이번 작업의 요구다
- 테스트 관례: `vi.mock('@entities/...')`로 훅을 모킹하는 컴포넌트 테스트가 존재(예: `QuickLinks.test.tsx`)

---

### Task 1: PUBLICATION-002 공통 문구 동기화

**Files:**

- Modify: `src/shared/api/errorMessage.ts:60-62`
- Modify: `src/mocks/handlers/draw.ts:1107-1111`
- Modify: `docs/adr/ADR-0008-api-error-message-mapping.md:38`
- Modify: `docs/backend-integration-status.md:84`

- [ ] **Step 1: FE 매핑 문구 교체**

`src/shared/api/errorMessage.ts` — 주석(60행)은 그대로 두고 값만 확정 문구로 바꾼다:

```ts
    'PUBLICATION-002': '추첨 결과가 아직 발표 가능한 상태가 아닙니다.',
```

- [ ] **Step 2: 목업 응답 문구 교체**

`src/mocks/handlers/draw.ts:1107-1111` — `fail(409, 'PUBLICATION-002', ...)`의 세 번째 인자를 `'추첨 결과가 아직 발표 가능한 상태가 아닙니다.'`로 교체한다.

- [ ] **Step 3: ADR-0008 후행 표기 갱신**

`docs/adr/ADR-0008-api-error-message-mapping.md:38`의 끝 `(05-api/drawing.md, PR 병합 후 적용 예정)`을 확정 상태로 바꾼다:

```md
(`05-api/drawing.md`, GD-314로 확정 문구 적용 완료)
```

- [ ] **Step 4: 연동 현황 문서 갱신**

`docs/backend-integration-status.md:84` — BE 요청 중이던 두 질의를 확정 결과로 갱신한다:

```md
- `PUBLICATION-002` 문구와 `DrawExecutionAudit` 표시는 2026-10-23 BE 회신·GD-314로 확정됐다 — 문구는 "추첨 결과가 아직 발표 가능한 상태가 아닙니다."로 FE 매핑·목업을 정렬했고, 감사 `action`은 `DRAW_EXECUTE`(추첨 실행)·`DRAW_RESUME`(추첨 재개) 두 값만 오며 처리자 UUID와 `beforeData`/`afterData`는 화면에서 숨긴다(`05-api/drawing.md` 실행 감사 표시 계약).
```

- [ ] **Step 5: 커밋**

```bash
git add src/shared/api/errorMessage.ts src/mocks/handlers/draw.ts docs/adr/ADR-0008-api-error-message-mapping.md docs/backend-integration-status.md
git commit -m "fix: PUBLICATION-002 공통 문구를 확정 계약으로 정렬"
```

### Task 2: DrawExecutionAudit 화면 표시 규칙 적용

**Files:**

- Create: `src/entities/drawResult/model/auditAction.ts`
- Modify: `src/entities/drawResult/index.ts` (export 추가)
- Modify: `src/pages/admin/draw/ui/DrawOperationsSection.tsx:138-168`
- Modify: `src/mocks/handlers/draw.ts` (recordAudit 호출 정합화)
- Modify: `src/mocks/handlers/draw.test.ts:668-686`
- Create: `src/pages/admin/draw/ui/DrawOperationsSection.test.tsx`

**Interfaces:**

- Produces: `DRAW_AUDIT_ACTION_LABEL: Record<string, string>` — `{ DRAW_EXECUTE: '추첨 실행', DRAW_RESUME: '추첨 재개' }`. 표시는 `DRAW_AUDIT_ACTION_LABEL[a.action] ?? a.action`(미확정 값은 원문 유지 — 계약 외 값을 지우지 않는다)

- [ ] **Step 1: action 라벨 상수 추가**

`src/entities/drawResult/model/auditAction.ts`를 만든다 (`runStatus.ts`의 `DRAW_TYPE_LABEL` 관례를 따른다):

```ts
// 실행 감사 action 표시 — getddo-spec 05-api/drawing.md '실행 감사 표시 계약(GD-314)'.
// 값 집합은 DRAW_EXECUTE·DRAW_RESUME뿐이며 코드를 문자열로 치환해 저장·반환하지 않는다
export const DRAW_AUDIT_ACTION_LABEL = {
    DRAW_EXECUTE: '추첨 실행',
    DRAW_RESUME: '추첨 재개',
} as const;
```

`src/entities/drawResult/index.ts`의 model export 블록(`DRAW_RUN_STATUS_META` 등이 있는 곳)에 `DRAW_AUDIT_ACTION_LABEL`을 추가한다.

- [ ] **Step 2: 실패하는 컴포넌트 테스트 작성**

`src/pages/admin/draw/ui/DrawOperationsSection.test.tsx` — `vi.mock('@entities/drawResult')`로 `useDrawExecutionAudits`·`useDrawFailures`를 모킹한다(`QuickLinks.test.tsx`의 `vi.mock('@entities/...')` 패턴 참조). 검증:

```tsx
// 감사 행: action=DRAW_EXECUTE, actorName='홍길동'+actorId UUID, reason=null, beforeData/afterData 있음
expect(screen.getByText('추첨 실행')).toBeInTheDocument();
expect(screen.queryByText('DRAW_EXECUTE')).not.toBeInTheDocument(); // raw 코드 미노출
expect(screen.getByText('홍길동')).toBeInTheDocument();
expect(screen.queryByText(actorUuid)).not.toBeInTheDocument(); // UUID 숨김
expect(screen.queryByText(/status:FAILED/)).not.toBeInTheDocument(); // beforeData 숨김
expect(screen.getByText('—')).toBeInTheDocument(); // reason null → —
// action=DRAW_RESUME 행은 '추첨 재개'로 표시
```

- [ ] **Step 3: 테스트가 실패함을 확인**

```bash
npx vitest run src/pages/admin/draw/ui/DrawOperationsSection.test.tsx
```

Expected: FAIL — 현재 구현은 raw action·UUID·beforeData/afterData를 그대로 보여준다.

- [ ] **Step 4: DrawOperationsSection 표시 수정**

`src/pages/admin/draw/ui/DrawOperationsSection.tsx`의 감사 행(143-164행)을 계약대로 바꾼다:

```tsx
import { DRAW_AUDIT_ACTION_LABEL, useDrawExecutionAudits, useDrawFailures } from '@entities/drawResult';
...
<TableCell className="text-body-sm font-medium whitespace-nowrap">
    {DRAW_AUDIT_ACTION_LABEL[a.action as keyof typeof DRAW_AUDIT_ACTION_LABEL] ?? a.action}
</TableCell>
<TableCell className="text-body-sm whitespace-nowrap">{a.actorName ?? '—'}</TableCell>
<TableCell className="text-body-sm max-w-60 whitespace-normal">{a.reason ?? '—'}</TableCell>
```

사라지는 것: 처리자 아래 `actorId` 보조 줄, 사유 아래 `beforeData`/`afterData` 원문 줄, 그 주석(156행).

- [ ] **Step 5: 목업 감사 action 정합화**

`src/mocks/handlers/draw.ts` — 확정 값 집합(`DRAW_EXECUTE`·`DRAW_RESUME`)만 방출하도록 고친다:

- 526-533행 `DRAW_FAILED` 레코드 삭제 — 실패는 `/failures`가 소유하고 감사에 남지 않는다. 실행 자체는 store 생성 시 `DRAW_EXECUTE`로 이미 남는다
- 567-574행 `action: 'DRAW_RUN_CREATED'` → `'DRAW_EXECUTE'`, `reason: null`, `beforeData: 'status:PREPARING'`, `afterData: `attemptId:att-${store.eventId}-1`` 로 바꾼다(154행 규칙: beforeData=시작 직전 status, afterData=attemptId). 주석도 "실행이 업무 감사에 남는다"로 맞춘다
- `createRedrawRun`의 `store.runs.push(run)` 직후(460행 부근)에 재추첨 실행 감사를 추가한다 — AD05는 서버가 즉시 실행하므로 `DRAW_EXECUTE`:

```ts
store.runs.push(run);
// AD05는 등록과 함께 서버가 즉시 실행한다 — 실행 감사는 action 값 집합의 DRAW_EXECUTE다
recordAudit(store, run.detail.id, {
    actorId: canceledByActor,
    action: 'DRAW_EXECUTE',
    reason: null,
    beforeData: 'status:PREPARING',
    afterData: `attemptId:att-${run.detail.id}-1`,
    requestId: null,
});
```

이를 위해 `createRedrawRun` 시그니처에 `canceledByActor: string`을 추가하고 호출부(AD05 취소 핸들러의 `actor`, `seedFailedRedraw`의 `'vu-admin'`)에서 넘긴다.

- 951-958행 `AWARD_CANCELED` recordAudit 호출 삭제(취소는 `execution.cancellations`가 소유)
- 1036-1043행 `PUBLICATION_APPLIED` recordAudit 호출 삭제(반영은 변경 이력 `changes`가 소유)
- 1133-1140행 `RESULT_CONFIRMED` recordAudit 호출 삭제
- 1209-1216행 `RUN_RESUMED` → `'DRAW_RESUME'`, `afterData: `attemptId:att-${detail.id}-2``로 교체(`beforeData: 'status:FAILED'` 유지)
- 1239-1246행 `REDRAW_RESUMED` → `'DRAW_RESUME'`로 동일 교체

- [ ] **Step 6: 목업 테스트 갱신**

`src/mocks/handlers/draw.test.ts:668-686` — 감사 테스트를 계약 값으로 맞춘다:

```ts
        it('/execution-audits는 실행·재개 행위를 최신순으로 돌려준다', async () => {
            const original = await firstRun(FAILED_INITIAL_EVENT);
            const audits = await call<
                Page<{ action: string; actorId: string | null; createdAt: string }>
            >('get', `/v1/admin/draws/${original.id}/execution-audits`);
            expect(audits.status).toBe(200);
            expect(
                audits.data.data.items.every((a) =>
                    ['DRAW_EXECUTE', 'DRAW_RESUME'].includes(a.action),
                ),
            ).toBe(true);
            expect(audits.data.data.items.some((a) => a.action === 'DRAW_EXECUTE')).toBe(true);

            await call('post', `/v1/admin/draws/${original.id}/resume`);
            const after = await call<Page<{ action: string }>>(
                'get',
                `/v1/admin/draws/${original.id}/execution-audits`,
            );
            expect(after.data.data.items[0]?.action).toBe('DRAW_RESUME');
            ...
        });
```

- [ ] **Step 7: 테스트·린트 실행**

```bash
npx vitest run src/pages/admin/draw/ui/DrawOperationsSection.test.tsx src/mocks/handlers/draw.test.ts
npm run lint
```

Expected: 전부 통과.

- [ ] **Step 8: 커밋**

```bash
git add src/entities/drawResult src/pages/admin/draw src/mocks/handlers/draw.ts src/mocks/handlers/draw.test.ts
git commit -m "fix: 실행 감사 화면을 GD-314 표시 계약으로 정렬"
```

### Task 3: GD-268 drawScheduledAt 재측정

**Files:**

- Create: `scripts/verifyGd268Schedule.mjs`
- Create: `reports/20261023-gd268-drawscheduledat.json` (실행 산출물)

- [ ] **Step 1: 측정 스크립트 작성**

`scripts/verifyL6RemainingReads.mjs`의 GD-268 블록(321-362행)만 발췌한 읽기 전용 스크립트. `L6_DEPLOY_URL` 필수·기본 대상 없음, `X-User-ID`/`X-User-Role: ADMIN` 헤더, `GET /admin/events?page=1&size=50` → endsAt 최신순 15건 → 각 `GET /admin/events/{id}`의 `drawScheduledAt - endsAt` 델타(초)를 `reports/20261023-gd268-drawscheduledat.json`에 기록한다. 기대값 60초, 호출 단위 증거(method·path·httpStatus·at)를 함께 남기는 관례를 유지한다. 실제 추첨 시작 지연은 측정·판정 대상이 아니다(`drawScheduledAt` 값 자체만 본다).

- [ ] **Step 2: 실서버 측정 실행**

```bash
L6_DEPLOY_URL=https://getddo-fe.vercel.app node scripts/verifyGd268Schedule.mjs
```

Expected: `summary.plus60` = 측정 건수 전부, `plus300`·`other` = 0. 네트워크·배포 지연으로 실패하면 결과를 그대로 증거에 기록하고 보고한다(성공처럼 표시하지 않는다).

- [ ] **Step 3: 연동 현황 문서에 재측정 반영**

`docs/backend-integration-status.md:86`의 GD-268 항목 끝에 재측정 사실을 한 줄 덧붙인다:

```md
fix/GD-268 머지·배포 후 2026-10-23 재측정에서도 delta=60초를 재확인했다(증거: reports/20261023-gd268-drawscheduledat.json).
```

- [ ] **Step 4: 커밋**

```bash
git add scripts/verifyGd268Schedule.mjs reports/20261023-gd268-drawscheduledat.json docs/backend-integration-status.md
git commit -m "test: GD-268 drawScheduledAt 배포 재측정 증거 추가"
```

### Task 4: 최종 검증·PR

- [ ] **Step 1: 전체 검증**

```bash
npm run format:check && npm run lint && npm run test:ci && npm run build && git diff --check
```

- [ ] **Step 2: push·PR 생성**

```bash
git push -u origin <브랜치>
gh pr create --base dev --title "<타입>(GD-xxx): ..." --body ...
```

PR 템플릿(`.github/pull_request_template.md`) 전 항목 작성, 재측정 수치(plus60/N건)를 본문에 기록.

- [ ] **Step 3: CodeRabbit 수동 트리거**

```bash
gh pr comment <PR> --body "@coderabbitai review"
```

## Self-Review 결과

- Spec coverage: 작업 1(문구)→Task 1, 작업 2(표시)→Task 2, 작업 3(재측정)→Task 3, 대상 외(resume 실측)→Global Constraints에서 제외 명시. 검증·PR 절차→Task 4
- 스펙 저장소는 이미 확정 반영됨(추가 수정 없음)
- 목업에서 삭제하는 감사 action(`AWARD_CANCELED`·`PUBLICATION_APPLIED`·`RESULT_CONFIRMED`·`DRAW_FAILED`)은 확정 값 집합 밖이라 계약 정합화의 일부다 — 취소·반영 정보는 `execution.cancellations`·`changes`가 소유하므로 표시 정보 손실 없음
