# GD-282 백엔드 계약 반영 (설문 서술 답변·출석 예약 수정·홈 미션 카드 필터) Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백엔드 PR #146·#147·#148(GD-269·270·271) 머지에 맞춰 프론트를 갱신한다 — 홈 미션 카드의 진행 중 판정을 serverTime으로 통일, 관리자 설문 화면 개선(기본 기간·문구·스크롤), AM05 서술 답변 조회, AP05·AP06 예약 정책 수정.

**Architecture:** 기존 FSD 구조 유지. 신규 API는 `entities/mission/api/admin.ts`(AM05 조회)와 `features/manageAttendancePolicy`(AP05·06 mutation + 수정 다이얼로그)에 추가. 백엔드 무관 항목(C-1·A-3)과 배포 후 확인 항목(A-2·B-1)을 한 브랜치에서 구현하되, 실서버 동작 확인은 백엔드 일일 릴리스(오전 7시) 이후다.

**Tech Stack:** React 19, TanStack Query, React Hook Form + Zod, MSW(관리자 미션·출석은 목업 없음 — 단위 테스트는 apiClient 모킹)

**Spec:** `../getddo-spec/05-api/mission.md` (AM05·GD-269 상태 전이), `../getddo-spec/05-api/attendance.md` (AP05·AP06), 백엔드 요청 원문(사용자 메시지)

## Global Constraints

- `import type`만 사용, 외부→`@app`~`@shared`→상대경로 import 순서는 eslint --fix에 맡긴다
- "지금" 판정은 `useVirtualClock().now()`(컴포넌트) — 단 C-1은 요청대로 **응답 `serverTime`**을 쓴다
- 서버 응답은 Zod 검증, 조회 훅은 `entities/*/api/`, mutation은 `features/*/api/`
- 답변 원문은 텍스트로만 표시한다(HTML 해석 금지 — React 기본 이스케이프에 맡긴다)
- 커밋: Conventional Commits(`feat:`/`fix:` 등, 한글 소문자 시작 제목), 작업 브랜치 `feat/GD-282`
- 검증: `npm run format:check && npm run lint && npm run test:ci && npm run build` 전부 통과

## 파일 지도

| 파일                                                                           | 책임                                                 |
| ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `src/entities/mission/utils/missionPeriod.ts` (+test)                          | `isMissionOpenByServerTime` 추가 — C-1 공용 판정     |
| `src/widgets/ticketBalance/ui/TicketBalanceWidget.tsx`                         | 진행 중·미완료 미션만 카드화 — C-1                   |
| `src/pages/missionList/ui/TodayRewardsBanner.tsx`                              | summarize 입력을 serverTime 진행 중 미션으로 — C-1   |
| `src/pages/home/ui/QuickLinks.tsx`                                             | 같은 판정으로 바로가기 점 통일 — C-1 (판단)          |
| `src/pages/admin/missions/ui/SurveySummaryPanel.tsx`                           | 기본 기간·조회 문구·서술 답변 섹션 — A-3 + A-2       |
| `src/pages/admin/missions/ui/MissionDetailPanel.tsx`                           | 패널 props 전달·열릴 때 스크롤·포커스 — A-3          |
| `src/entities/mission/model/adminTypes.ts`, `api/admin.ts`, `index.ts`         | AM05 스키마·`useSurveyAnswers` — A-2                 |
| `src/features/manageAttendancePolicy/api/queries.ts`                           | `useUpdateAttendancePolicy` (PUT) — B-1              |
| `src/features/manageAttendancePolicy/ui/PolicyFields.tsx` (신규)               | 등록 폼과 수정 다이얼로그가 공유하는 입력 필드 — B-1 |
| `src/features/manageAttendancePolicy/ui/AttendancePolicyForm.tsx`              | PolicyFields 사용 + 004/005 문구 갱신 — B-1          |
| `src/features/manageAttendancePolicy/ui/AttendancePolicyEditDialog.tsx` (신규) | 예약 정책 수정 다이얼로그 — B-1                      |
| `src/pages/admin/attendancePolicies/AdminAttendancePoliciesPage.tsx` (+test)   | 미래 정책 행에만 수정 버튼·다이얼로그 연결 — B-1     |
| `src/shared/api/errorMessage.ts`                                               | ATTENDANCE-002/003/006/007·MISSION-006 매핑 추가     |

**A-1 (미션 ENDED 자동 전이)은 프론트 변경 없음** — 목록·상세가 `status`를 그대로 표시하고 필터도 이미 존재한다.

---

### Task 1: C-1 — 홈 "오늘 받을 수 있는 응모권" 미션 카드를 serverTime 진행 중으로 필터

**Files:**

- Modify: `src/entities/mission/utils/missionPeriod.ts`
- Test: `src/entities/mission/utils/missionPeriod.test.ts`
- Modify: `src/entities/mission/index.ts` (export 추가)
- Modify: `src/widgets/ticketBalance/ui/TicketBalanceWidget.tsx` (미션 map 전 filter)
- Modify: `src/pages/missionList/ui/TodayRewardsBanner.tsx` (isMissionOpen(m, now) → serverTime 판정)
- Modify: `src/pages/home/ui/QuickLinks.tsx` (같은 판정 — 홈 안에서 브라우저 시계 기준과 serverTime 기준이 섞이지 않게 통일한다. `now`가 다른 용도로 남으면 import 유지)

**Interfaces:**

- Produces: `isMissionOpenByServerTime(mission: { startsAt: string; endsAt: string; serverTime: string }): boolean` — `entities/mission` 배럴에서 export

- [ ] **Step 1: 실패하는 테스트 작성** — `missionPeriod.test.ts`에 추가 (기존 describe 패턴 유지)

```ts
it('serverTime이 [startsAt, endsAt) 안이면 진행 중이다', () => {
    const mission = {
        startsAt: '2026-10-20T00:00:00+09:00',
        endsAt: '2026-10-25T00:00:00+09:00',
        serverTime: '2026-10-21T12:00:00+09:00',
    };
    expect(isMissionOpenByServerTime(mission)).toBe(true);
});
it('serverTime이 종료 정각이면 마감이다', () => {
    const mission = {
        startsAt: '2026-10-20T00:00:00+09:00',
        endsAt: '2026-10-21T12:00:00+09:00',
        serverTime: '2026-10-21T12:00:00+09:00',
    };
    expect(isMissionOpenByServerTime(mission)).toBe(false);
});
it('serverTime이 시작 전이면 열리지 않았다', () => {
    const mission = {
        startsAt: '2026-10-22T00:00:00+09:00',
        endsAt: '2026-10-25T00:00:00+09:00',
        serverTime: '2026-10-21T12:00:00+09:00',
    };
    expect(isMissionOpenByServerTime(mission)).toBe(false);
});
```

- [ ] **Step 2: 구현** — `missionPeriod.ts`에 추가

```ts
/**
 * 응답의 serverTime 기준으로 지금 참여할 수 있는 미션인지 — M01은 끝난·예정 미션도 섞여 오고
 * status를 주지 않아 항목의 serverTime으로 판정한다 (브라우저 시계가 아니라 서버 시각 기준, 종료 정각부터 마감)
 */
export const isMissionOpenByServerTime = (mission: {
    startsAt: string;
    endsAt: string;
    serverTime: string;
}) => isMissionOpen(mission, new Date(mission.serverTime));
```

- [ ] **Step 3: `index.ts`에 `isMissionOpenByServerTime` export 추가**
- [ ] **Step 4: TicketBalanceWidget 필터**

```ts
// 진행 중이고 아직 완료하지 않은 미션만 카드로 — 목록(M01)은 끝난 미션도 내려주므로
// 응답의 serverTime으로 걸러 완료·종료·시작 전 카드가 홈에 나오지 않게 한다
...(missions ?? [])
    .filter((mission) => !mission.completed && isMissionOpenByServerTime(mission))
    .map((mission) => ({ ...기존과 동일 })),
```

import에 `isMissionOpenByServerTime` 추가 (`@entities/mission`).

- [ ] **Step 5: TodayRewardsBanner 판정 교체**

```ts
// 지금 참여할 수 있는 미션만 센다 — 판정은 응답의 serverTime 기준이다 (완료 여부는 그대로 반영)
missions: missions?.filter((mission) => isMissionOpenByServerTime(mission)),
```

`isMissionOpen` import 제거(다른 사용 없으면).

- [ ] **Step 6: QuickLinks 판정 교체** — 같은 방식으로 `isMissionOpenByServerTime(mission)` 사용. `now`가 이 파일에서 다른 곳에 안 쓰이면 `useVirtualClock`·`now` 관련 코드 정리 여부를 확인한다(남아 있으면 유지).

- [ ] **Step 7: 검증** — `npm run test:ci -- missionPeriod` 통과 후 `git add -A && git commit -m "feat: 홈 미션 카드를 serverTime 진행 중으로 필터 (GD-282)"` — 형식은 팀 컨벤션 확인 후 조정

### Task 2: A-3 — 설문 집계 패널 개선 + 상세 패널 스크롤

**Files:**

- Modify: `src/pages/admin/missions/ui/SurveySummaryPanel.tsx`
- Modify: `src/pages/admin/missions/ui/MissionDetailPanel.tsx`
- Test: `src/pages/admin/missions/AdminMissionsPage.test.tsx`

**Interfaces:**

- Consumes: `formatYmd`(KST YYYY-MM-DD), `surveyRangeSchema`(양끝 포함 ≤31일)
- Produces: `SurveySummaryPanel({ missionId, startsAt, endsAt, questions })` — `questions`는 Task 3에서 사용. 이번 태스크에서는 props에만 추가하고 미사용이면 lint에 걸리므로 Task 3과 함께 도입한다

- [ ] **Step 1: 기본 기간 계산** — 패널 상단에

```ts
const DAY_MS = 86_400_000;
const defaultRange = useMemo(() => {
    const from = formatYmd(startsAt);
    const end = formatYmd(endsAt);
    // 서버 규칙은 양끝 포함 최대 31일 — 미션 기간이 넘으면 시작일부터 31일로 자르고 안내한다
    const clamped = Date.parse(end) - Date.parse(from) > 30 * DAY_MS;
    const to = clamped ? new Date(Date.parse(from) + 30 * DAY_MS).toISOString().slice(0, 10) : end;
    return { from, to, clamped };
}, [startsAt, endsAt]);
const { register, handleSubmit } = useForm<{ from: string; to: string }>({
    defaultValues: { from: defaultRange.from, to: defaultRange.to },
});
```

`MissionDetailPanel`에서 `startsAt={mission.startsAt} endsAt={mission.endsAt}` 전달. `defaultRange.clamped`이면 안내 문구 노출: `'미션 기간이 31일을 넘어 시작일부터 31일만 잘랐습니다.'`

- [ ] **Step 2: 문구 분기** — 기존 `마지막 성공 조회의 집계입니다.`를

```tsx
<p role="status">{query.isError ? '마지막 성공 조회의 집계입니다.' : '조회 결과입니다.'}</p>
```

- [ ] **Step 3: 상세 패널 스크롤·포커스** — `MissionDetailPanel`

```tsx
const panelRef = useRef<HTMLElement>(null);
useEffect(() => {
    // 패널은 목록 맨 아래에 그려져 '상세'를 눌러도 안 보였다 — 열리면 패널로 스크롤하고 포커스를 옮긴다
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    panelRef.current?.focus({ preventScroll: true });
}, []);
```

`<section ref={panelRef} tabIndex={-1} ...>` — 부작용: 패널이 viewport에 이미 있어도 상단 정렬로 스크롤된다(의도된 단순화, 허용).

- [ ] **Step 4: 테스트** — jsdom은 `scrollIntoView` 미구현이라 테스트에서 `Element.prototype.scrollIntoView = vi.fn()` 스텁 후, `상세` 클릭 시 호출됨 + 패널이 문서에 존재함을 확인. jsdom `focus({preventScroll})`는 무시 가능(HTMLElement.prototype.focus 존재).
- [ ] **Step 5: 검증·커밋** — 대상 테스트 통과 후 `fix: 미션 관리 상세 패널 표시와 설문 집계 기본 기간 (GD-282)`

### Task 3: A-2 — 설문 자유 서술 답변 조회 (AM05)

**Files:**

- Modify: `src/entities/mission/model/adminTypes.ts` (`surveyFreeTextAnswerSchema`)
- Modify: `src/entities/mission/api/admin.ts` (`useSurveyAnswers`)
- Modify: `src/entities/mission/index.ts` (export)
- Modify: `src/pages/admin/missions/ui/SurveySummaryPanel.tsx` (서술 답변 섹션 + questions prop)
- Modify: `src/pages/admin/missions/ui/MissionDetailPanel.tsx` (questions 전달)
- Test: `src/pages/admin/missions/AdminMissionsPage.test.tsx` (모킹 응답으로 답변 렌더 확인)

**Interfaces:**

- Consumes: `surveyRangeSchema`, `envelopeSchema(pageSchema(...))`, `ADMIN_MISSIONS_PATH`, `PagedResult`
- Produces: `useSurveyAnswers(missionId: string, questionId: string | null, range: { from: string; to: string } | null, page: number)` → `UseQueryResult<Page<SurveyFreeTextAnswer>>`

- [ ] **Step 1: 스키마** — `adminTypes.ts`

```ts
export const surveyFreeTextAnswerSchema = z.object({
    answerText: z.string(),
    submittedAt: z.string(),
});
export type SurveyFreeTextAnswer = z.infer<typeof surveyFreeTextAnswerSchema>;
```

- [ ] **Step 2: 조회 훅** — `api/admin.ts`, `useSurveySummary` 패턴 복제

```ts
export function useSurveyAnswers(
    missionId: string,
    questionId: string | null,
    range: { from: string; to: string } | null,
    page: number,
) {
    return useQuery({
        ...pollingReadPolicy,
        queryKey: [...ADMIN_MISSIONS_KEY, 'surveyAnswers', missionId, questionId, range, page],
        enabled: !!questionId && !!range,
        queryFn: (context) =>
            withPollingReadGuard(context, async () => {
                const params = surveyRangeSchema.parse(range);
                const { data } = await apiClient.get<unknown>(
                    `${ADMIN_MISSIONS_PATH}/${missionId}/survey-answers`,
                    {
                        params: { questionId, ...params, page, size: 20 },
                        signal: context.signal,
                    },
                );
                return envelopeSchema(pageSchema(surveyFreeTextAnswerSchema)).parse(data).data;
            }),
    });
}
```

`index.ts`에 훅·스키마·타입 export 추가.

- [ ] **Step 3: 패널 UI** — `SurveySummaryPanel`에 `questions` prop 추가(`AdminMission['questions']`), FREE_TEXT 필터 후 집계 결과 아래 섹션:

```tsx
const freeTextQuestions = questions.filter((q) => q.questionType === 'FREE_TEXT');
...
{freeTextQuestions.length > 0 && (
    <section className="flex min-w-0 flex-col gap-3" aria-label="자유 서술 답변">
        <h3>자유 서술 답변</h3>
        {!range ? (
            <p>위 기간으로 집계를 조회하면 같은 기간의 답변이 표시됩니다.</p>
        ) : (
            freeTextQuestions.map((q) => (
                <FreeTextAnswers
                    key={q.id}
                    missionId={missionId}
                    questionId={q.id}
                    questionText={q.questionText}
                    range={range}
                />
            ))
        )}
    </section>
)}
```

`FreeTextAnswers`(같은 파일 내부 컴포넌트): 문항별 `page` state + `useSurveyAnswers` + `PagedResult`(countUnit 기본 '건'). 항목 렌더:

```tsx
<li key={i} className="border-border-default rounded-lg border p-3">
    {/* 답변 원문은 가공하지 않는다 — 텍스트로만 표시(HTML 해석 금지, 계약) */}
    <p className="break-words whitespace-pre-wrap">{a.answerText}</p>
    <p className="text-caption text-fg-tertiary">{formatKst(a.submittedAt)} KST</p>
</li>
```

- [ ] **Step 4: `MissionDetailPanel`에서 `questions={mission.questions}` 전달**
- [ ] **Step 5: 테스트** — apiClient.get 모킹으로 survey-answers 페이지 응답을 주고 `answerText`가 텍스트로 렌더되는지 확인 (`<b>` 포함 문자열이 태그로 해석되지 않는지)
- [ ] **Step 6: 검증·커밋** — `feat: 설문 자유 서술 답변 조회 연동 (GD-282)`

### Task 4: B-1 — 출석 예약 정책 수정 (AP05·AP06)

**Files:**

- Modify: `src/features/manageAttendancePolicy/api/queries.ts` (`useUpdateAttendancePolicy`)
- Create: `src/features/manageAttendancePolicy/ui/PolicyFields.tsx` (공유 입력 필드)
- Modify: `src/features/manageAttendancePolicy/ui/AttendancePolicyForm.tsx` (PolicyFields 사용 + 004/005 문구)
- Create: `src/features/manageAttendancePolicy/ui/AttendancePolicyEditDialog.tsx`
- Modify: `src/features/manageAttendancePolicy/index.ts` (다이얼로그 export)
- Modify: `src/pages/admin/attendancePolicies/AdminAttendancePoliciesPage.tsx`
- Modify: `src/shared/api/errorMessage.ts` (코드 매핑)
- Test: `src/pages/admin/attendancePolicies/AdminAttendancePoliciesPage.test.tsx`

**Interfaces:**

- Consumes: `ADMIN_ATTENDANCE_PATH`, `dailyPolicyWriteSchema`/`streakPolicyWriteSchema`, `dailyAttendancePolicySchema`/`streakPolicySetSchema`, `useVirtualClock`, `toKst`, `Dialog` (`@shared/ui/dialog`)
- Produces: `useUpdateAttendancePolicy()` mutation — 요청 `{ kind: 'daily' | 'streak'; id: string; body: DailyPolicyWrite | StreakPolicyWrite }`; `AttendancePolicyEditDialog({ kind, policy, open, onOpenChange })`

- [ ] **Step 1: 에러 코드 매핑** — `errorMessage.ts` 번호 코드 블록에 추가

```ts
'ATTENDANCE-002': '관리자 권한이 필요합니다.',
'ATTENDANCE-003': '출석 정책 값을 확인해 주세요.',
'ATTENDANCE-006': '수정할 정책을 찾을 수 없습니다. 목록을 새로 확인해 주세요.',
'ATTENDANCE-007': '이미 적용이 시작된 정책이라 수정할 수 없습니다.',
'MISSION-006': '관리자 권한이 필요합니다.',
```

- [ ] **Step 2: `useUpdateAttendancePolicy`** — `useCreateAttendancePolicy`와 같은 busy/lastError 가드 패턴, `apiClient.put(`${ADMIN_ATTENDANCE_PATH}/${request.kind}/${request.id}`, body)`, 응답은 동일 스키마로 검증, `onSettled`에서 `ADMIN_ATTENDANCE_KEY` 무효화. `apiClient.put` 존재 여부 먼저 확인(없으면 axios 인스턴스 메서드 확인 후 보고).
- [ ] **Step 3: `PolicyFields` 추출** — `AttendancePolicyForm`의 daily 입력·streak field-array 마크업을 `ui/PolicyFields.tsx`로 이동. props: `{ kind, register, fields, append, remove }` (RHF 제네릭은 `DailyPolicyWrite & StreakPolicyWrite` 폼 타입). 폼은 이를 사용하도록 교체, 동작 동일.
- [ ] **Step 4: `AttendancePolicyEditDialog`** — MissionFormDialog 패턴. `defaultValues`는 policy에서 주입(일일: `rewardTicketCount`, 연속: `milestones`의 id 제외한 write 형태). 성공 시 `'수정했습니다.'` 후 닫기, 실패는 코드 분기:

```ts
error instanceof ApiError && error.code === 'ATTENDANCE-007'
    ? '이미 적용이 시작된 정책이라 수정할 수 없습니다. 목록을 새로 확인해 주세요.'
    : `${getErrorMessage(error)} 처리 여부가 불확실하면 목록을 먼저 확인해 주세요.`;
```

- [ ] **Step 5: 페이지에 수정 버튼** — 각 행에

```ts
const now = useVirtualClock().now();
const kstMonthOf = (d: Date) => {
    const k = toKst(d);
    return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}`;
};
// 표시용 사전 판정 — 최종 판단은 서버(409 ATTENDANCE-007)가 한다
const editableDaily = (p: DailyAttendancePolicy) => new Date(p.effectiveFrom) > now;
const editableStreak = (p: StreakPolicySet) => p.effectiveMonth > kstMonthOf(now);
```

`editing` state(`{ kind: 'daily'; policy: DailyAttendancePolicy } | { kind: 'streak'; policy: StreakPolicySet } | null`) + 버튼 → `AttendancePolicyEditDialog` 렌더.

- [ ] **Step 6: `AttendancePolicyForm` 004/005 문구 갱신**

```ts
'이미 예약된 정책이 있습니다. 목록에서 예약된 정책을 수정해 주세요.';
```

- [ ] **Step 7: 테스트** — 미래 `effectiveFrom` 정책에만 수정 버튼, PUT 호출 본문 확인, ATTENDANCE-007 응답 문구 확인. 기존 테스트의 004 문구 검증(`이미 예약된 정책`)은 새 문구에 맞춰 갱신.
- [ ] **Step 8: 검증·커밋** — `feat: 출석 예약 정책 수정 연동 (GD-282)`

### Task 5: 전체 검증

- [ ] `npm run format:check && npm run lint && npm run test:ci && npm run build` 전부 통과
- [ ] `git diff dev` 셀프 리뷰 — 주석 규칙·토큰 색상·FSD 경계 확인
- [ ] **배포 후 확인 예약 항목(이번 세션 불가)**: 백엔드 일일 릴리스(오전 7시) 이후 `https://getddo-fe.vercel.app/`에서 ① AM05 답변 조회 200 ② AP05·AP06 수정 200/409 ③ 미션 ENDED 자동 반영 확인
