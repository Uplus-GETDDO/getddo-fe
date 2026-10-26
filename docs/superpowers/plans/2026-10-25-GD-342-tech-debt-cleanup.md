# GD-342 잔여 기술 부채 정리 Implementation Plan

> **For agentic workers:** 항목별 독립 PR. 각 PR은 `dev`에서 분기하고 CI 검증(format:check·lint·test:ci·build·perf:budget) 통과 후 PR 생성.

**Goal:** 직전 감사(2026-10-24)에서 확정된 5개 기술 부채 항목을 항목별 PR로 처리한다.

**Architecture:** dead dependency 제거, LCP/CLS 개선(로그인 페이지 동기 렌더), 컴포넌트 분할(admin/게임 2 PR), RUM(Vercel Speed Insights) 도입, 목업 날짜 상수의 demoTime 패턴 통일.

**Tech Stack:** React 19, Vite 8, TanStack Query, Zustand, MSW, TailwindCSS v4.

## Global Constraints

- 브랜치: `dev`에서 `fix/GD-342-<항목>` (RUM은 `feat/GD-342-rum`)
- 동작 변경 없는 리팩터 원칙 (컴포넌트 분할·목업 날짜는 fixture 의미 유지)
- 게임 로직(타이밍·판정)은 기존 테스트가 있으니 변경 금지
- FSD 레이어 규칙 준수, 기존 스타일 패턴 유지
- `import.meta.env` 직접 참조 금지, `console.log` 금지, `import type`만
- 검증: `npm run format:check && npm run lint && npm run test:ci && npm run build && npm run perf:budget`

---

## PR-1 `fix/GD-342-deps`: Dead dependency 제거

**Files:**

- Modify: `package.json` (@reduxjs/toolkit, react-redux 제거 — npm uninstall)
- Modify: `docs/adr/ADR-0003-state-management-roles.md` 이력 섹션
- Modify: `AGENTS.md` 기술 스택 줄 + 상태 관리 표의 Redux 행 처리

- [ ] Step 1: `npm uninstall @reduxjs/toolkit react-redux`
- [ ] Step 2: ADR-0003 이력에 `2026-10-25: Redux Toolkit이 미사용으로 유지돼 의존성을 제거했다. 여러 화면에 걸친 복잡한 전역 플로우가 생기면 재도입한다.` 추가. 표의 Redux 행은 정책 자체는 유지하되 비고로 제거 사실을 명시 (정책 문서는 결정의 기록 — 행 삭제보다 이력 추가가 맞다). 단, AGENTS.md "기술 스택" 줄에서 `Redux Toolkit` 제거 + "Redux Toolkit은 의존성만 있고 스토어는 아직 없다" 문장을 제거됨으로 갱신.
- [ ] Step 3: `rg "redux|@reduxjs"` 전체 검색으로 잔여 참조 확인 (CONTRIBUTING.md 등 문서 포함)
- [ ] Step 4: 검증 5종 + 커밋 `chore: 미사용 Redux Toolkit 의존성을 제거한다 (GD-342)` → PR

## PR-2 `feat/GD-342-rum`: RUM — Vercel Speed Insights

**Files:**

- Modify: `package.json` (@vercel/speed-insights 추가)
- Modify: `src/app/main.tsx`
- Modify: `docs/performance-budget.md` "RUM 판단 — 보류" 절 → "도입"으로 갱신

- [ ] Step 1: `npm install @vercel/speed-insights` (최신이 아닌 7일+ 지난 버전 확인)
- [ ] Step 2: `main.tsx`의 `<App />` 렌더 안에 `<SpeedInsights />` 추가 (`import { SpeedInsights } from '@vercel/speed-insights/react'`)
- [ ] Step 3: performance-budget.md RUM 절 갱신: 판정 "보류 → 도입", 근거(Vercel 배포 환경·제로 백엔드·~수 KB), 데이터 확인 경로(Vercel 대시보드 Speed Insights 탭 활성화 필요 — 배포 후 수동 활성화 절차 기록)
- [ ] Step 4: `perf:budget` 확인 — 스크립트 크기가 초기 JS에 들어오는지(동적 import 고려) 측정값 비교, 버짓 초과 시 기준선 표 갱신 절차 따름
- [ ] Step 5: 검증 5종 + 커밋 `feat: Vercel Speed Insights로 실사용자 지표를 수집한다 (GD-342)` → PR

## PR-3 `fix/GD-342-mock-dates`: 목업 날짜 상수 정리

**Files:**

- Create: `src/mocks/handlers/demoTime.ts` (event.ts의 `DEMO_WINDOW_MS`·`demoTime` 추출, export)
- Modify: `src/mocks/handlers/event.ts` (로컬 정의 제거, import로 교체)
- Modify: 미래 시각 의존 파일 — `adminNotification.ts`(60), `mission.ts`(17), `abuse.ts`(16), `event.ts`(17 잔여 리터럴), `adminEntry.ts`(8), `adminTicket.ts`(4), `notification.ts`(4), `adminUser.ts`(2), `entry.ts`(2), `banner.ts`(1), `adminEvent.ts`(1), `index.ts`(1)

- [ ] Step 1: `demoTime.ts` 생성 — event.ts:24-81의 DEMO_WINDOW_MS·demoTime을 그대로 이동, named export. event.ts는 import로 교체
- [ ] Step 2: 파일별 날짜 리터럴 판단:
    - **미래 의존**(startsAt·endsAt·leaseUntil·nextAttemptAt·scheduledAt이 "현재 기준 미래/윈도우"여야 의미가 유지되는 것) → `demoTime(offset)` 변환
    - **과거 사실**(createdAt·requestedAt·acceptedAt·blockedAt 등 "N일 전에 일어난 일"로 고정돼도 되는 것) → 상대 시각(demoTime(-N*day)) 또는 유지 — 의미가 "특정 과거 시점"이면 유지, "며칠 전"이면 상대 시각
    - **주석 속 날짜**(계약 확정일 등 역사 기록) → 유지
    - 판단 결과를 표로 plan/보고에 기록
- [ ] Step 3: 목업 테스트(`entry.test.ts`, `event.test.ts`, `adminNotification.test.ts` 등) 통과 확인 — 테스트의 하드코딩 날짜가 fixture 변경으로 깨지면 테스트의 기대 시각도 상대 시각으로 정합
- [ ] Step 4: 검증 5종 + 커밋 `fix: 목업 fixture의 하드코딩 날짜를 데모 시각 패턴으로 통일한다 (GD-342)` → PR

## PR-4 `fix/GD-342-lcp`: LCP/CLS 개선

**진단 (reports/20261024-gd334-prod-lighthouse-login-mobile-r2.json):**

- LCP 2,709ms = 텍스트 span(가상 사용자 목록 아이템), FCP 2,259ms
- CLS 0.109 = section 전체 이동 — `isPending` 스켈레톤(5행 h-16) → 실제 목록 교체가 원인 (폰트 swap 아님, font-display items 비어 있음)
- render-blocking: index CSS 25KB ~300ms, unused JS 91KiB

**Files:**

- Modify: `src/pages/login/LoginPage.tsx`
- Modify: `src/entities/user/api/queries.ts` 또는 `src/entities/user/model/virtualUsers.ts` (동기 데이터임을 반영한 API)

**방향:** 가상 사용자 목록은 서버 호출이 아니라 빌드타임 env(`VITE_VIRTUAL_USERS_JSON`)의 동기 파싱이다. `isPending` 스켈레톤 단계가 LCP 지연 + CLS의 직접 원인이므로 목록을 첫 렌더부터 그린다.

- [ ] Step 1: 구현 방식 결정 — (a) `useVirtualUsers`에 `initialData` 주입(throw 경로 유지 위해 try 래핑), 또는 (b) LoginPage가 `getVirtualUsers`의 결과를 `useMemo`로 동기 계산. TanStack Query 관례 유지 + 에러 UI 유지 관점에서 (a) 우선 검토, queryFn 동기라 pending 프레임만 사라지면 되는지 확인 후 택일. 테스트(`virtualUsers.test.ts`, LoginPage 관련 테스트) 확인.
- [ ] Step 2: 스켈레톤 분기 제거·조정 — 데이터가 첫 렌더에 있으면 `isPending`이 안 걸리므로 SkeletonList 분기는 사실상 도달 불가가 됨. 제거 여부는 코드 근거로 판단.
- [ ] Step 3: 로컬 Lighthouse로 개선 방향 확인 가능하면 측정, 아니면 코드 근거(첫 렌더에 LCP 요소 존재)로 문서화
- [ ] Step 4: prod 측정은 머지 후 배포본 대상 Lighthouse 3회 중앙값(20261024-gd332-prod-verification 절차) — 미달 시 `reports/`에 도달 불가 근거 기록
- [ ] Step 5: 검증 5종 + 커밋 `fix: 로그인 첫 렌더부터 가상 사용자 목록을 그려 LCP·CLS를 개선한다 (GD-342)` → PR

## PR-5 `fix/GD-342-split-admin`: 관리자 거대 컴포넌트 분할

**Files:**

- Modify: `src/pages/admin/draw/ui/DrawRunDetail.tsx` (976줄)
- Modify: `src/pages/admin/eventForm/AdminEventFormPage.tsx` (561줄)

**DrawRunDetail 분할 방향:** RunSection 4개(results/verifications/candidates/operations) 섹션 렌더를 `ui/` 하위 컴포넌트로 추출 (예: `DrawResultsSection.tsx` 등). Field·ResultChips 같은 표시 조각도 분리. RunDetailBody가 props 전달 허브가 되도록 유지. 데이터 훅이 많으면 `hooks/`로 추출.

**AdminEventFormPage 분할 방향:** `EventFormBody` 465줄의 폼 섹션(기본정보/일정/응모 조건/보상 등)을 `ui/` 폼 섹션 컴포넌트로 분할. RHF 필드 묶음 단위. 검증·매핑 로직은 `utils/`나 `model/`로.

- [ ] Step 1: 기존 테스트(DrawRunDetail.test.tsx, AdminEventFormPage.test.tsx) 먼저 실행해 기준선 확보
- [ ] Step 2: DrawRunDetail 분할 — 섹션별 컴포넌트 추출, 공개 API(export 함수명·props) 불변
- [ ] Step 3: AdminEventFormPage 분할 — 동일 원칙
- [ ] Step 4: 기존 테스트 전부 통과 + lint·build + 커밋 `refactor: 관리자 상세·폼 페이지를 섹션 컴포넌트로 분할한다 (GD-342)` → PR

## PR-6 `fix/GD-342-split-games`: 게임 거대 컴포넌트 분할

**Files:**

- Modify: `src/features/playGame/ui/TakkoOrderGame.tsx` (709), `TakkoTimingGame.tsx` (631), `TakkoRunGame.tsx` (614), `ColorWordGame.tsx` (505)

**공통 패턴:** 4개 게임 모두 `Phase = 'ready'|'countdown'|'playing'|'paused'|'over'` 상태기 + countdown/reveal 상수 + padScore + 키보드 핸들러. 분할 방향:

- 게임 루프·타이머·키 입력을 `hooks/`(`useXxxGame.ts`)로 추출 — phase 전이·점수·판정 로직 (기존 테스트가 훅을 직접 테스트하는지 확인 후 시그니처 유지)
- JSX의 오버레이(ready/countdown/pause/result)·HUD를 `ui/` 표현 컴포넌트로 추출
- 4개 게임 공통 상수(countdown, padScore)가 중복이면 `playGame/model/` 또는 `utils/` 공유 검토 — 단 동작 변경 없이 최소 추출 원칙, 공유는 중복이 명백한 것만

- [ ] Step 1: 각 게임의 기존 테스트 위치·커버 범위 확인
- [ ] Step 2: 게임별 순차 분할 (한 게임씩 완료→테스트→다음 게임)
- [ ] Step 3: 기존 테스트 전부 통과 + lint·build + 커밋 `refactor: 게임 컴포넌트의 로직과 표현을 분리한다 (GD-342)` → PR

## 최종: PPT용 전후 비교 문서

- [ ] `reports/20261025-gd342-tech-debt-summary.md` 작성 — 항목별 전후(의존성 수, LCP/CLS 수치, 컴포넌트 줄 수 표, 목업 리터럴 수, RUM 도입 여부) + GD-332~340 성능 최적화 흐름과 연결한 요약 (기존 `20261024-gd332-perf-summary-ppt.md` 형식 참조)

## 순서·의존

PR-1 → PR-2 → PR-3 → PR-4 → PR-5 → PR-6 순으로 진행한다 (작은 것부터, 각각 독립). PR-4의 prod 재측정은 머지·배포 후 별도 수행.
