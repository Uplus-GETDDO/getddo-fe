# 프로젝트 규칙 (AGENTS.md)

> 이 파일은 이 레포지토리에서 작업하는 모든 기여자(팀원·AI 에이전트)가 따라야 하는 규칙이다.
> 코드를 수정하기 전에 반드시 이 파일을 읽는다.

## 프로젝트 개요

- LG유플러스 응모 이벤트 플랫폼 프론트엔드 (가상 사용자 기반 응모/추첨 이벤트)
- 기술 스택: TypeScript, React 19, Vite 8, React Router 7, TanStack Query, Zustand, Redux Toolkit, TailwindCSS v4, shadcn/ui, React Hook Form + Zod
- 백엔드는 별도 레포 — API가 준비되기 전까지 MSW로 목업한다
- Node >= 20.19 (`package.json` `engines` 기준, 24.x 권장) / npm

## 참조 문서

공용 정책의 원본은 공용 명세 저장소 `getddo-spec`이다 (로컬에서는 이 레포와 같은 디렉터리의 `../getddo-spec/`). 이 레포의 문서와 내용이 충돌하면 getddo-spec의 확정 내용을 우선한다.

- 기능 요구사항·구현 범위: `../getddo-spec/00-requirements/` — 새 화면·기능을 만들거나 구현/보류/제외 여부를 판단할 때 `functional-requirements.md`와 `scope.md`를 읽는다
- 도메인 용어·정책: `../getddo-spec/02-domain/` — 용어는 `glossary.md`, 이벤트·응모권·응모·추첨·출석·미션·게임·알림 정책은 도메인별 파일. 상태 전이, 보상·차감 조건, 추첨·발표 규칙을 구현할 때 읽는다
- 공용 결정(ADR): `../getddo-spec/03-decisions/` — 프론트·백엔드 공통으로 적용되는 결정과 그 이유. 정책 해석이 필요하거나 공용 결정을 바꾸려 할 때 읽는다
- API 계약: `../getddo-spec/05-api/` — 도메인별 HTTP 경로·메서드·DTO·업무 오류 코드. 확정(채택)된 범위는 알림 N01~N03·AN01~AN05, 추첨 GD-87·GD-138·GD-169 선택 범위·E08/E09, 배너 B01·AB01~AB05, 관리자 사용자 AO01·AO02·응모권 AO03·AO04·AO05·AO08·AO09, 미션 M01~M04, 게임 G01·G02·G05·글자색깔 G03/G04이며, 응모·출석·미션·게임 제출의 현행 구현 범위(거절 이력·429 `COMMON-006` 등)도 명세에 반영됐다. 공통 감사 조회(AU01·AU02)는 제외다. 나머지는 검토 대기 단계의 제안이며 도메인별 상세는 `docs/CONTEXT.md`의 '백엔드 연동 전 임시 상태'가 기준이다. `common.md`에 응답 봉투·페이징·멱등키·시연용 `X-User-ID`/`X-User-Role`/`X-User-Membership` 헤더 등 공통 계약이 있다. API 연동 코드를 작성할 때 먼저 읽는다
- 미결정 정책: `../getddo-spec/00-requirements/pending-decisions.md` — 여기 있는 항목과 각 문서의 미확정 표시는 임의로 확정해 코드에 반영하지 않는다
- 공통 협업 규칙 원본: `../getddo-spec/01-conventions/` — 이 파일의 브랜치·커밋·PR 요약과 충돌하면 원본을 따른다. Jira 에픽·태스크 작성 양식은 `../getddo-spec/templates/jira-*.md`를 사용한다

이 레포 내부 문서:

- 도메인 용어·판단 기준: `docs/CONTEXT.md` — 응모/응모권/추첨 모델 작업, UTC↔KST 시간 규칙, 멱등키 필요 여부를 판단할 때 읽는다
- 디자인 토큰 명세: `docs/DESIGN-SYSTEM.md` — 색·타이포·radius·shadow 토큰의 의미와 용도를 확인할 때 읽는다. 토큰 값의 원천은 `src/app/styles/tokens.css`다
- 아키텍처 결정 이력: `docs/adr/` — FE 전용 기술 결정을 변경하거나 결정의 이유를 확인할 때 해당 ADR을 읽는다
- 기획 맥락: `docs/product-context.md` — 페르소나·유저플로우·타겟층·비기능 요구사항 등 spec에 없는 기획 원문 발췌. 정책 관련 표현이 getddo-spec과 다르면 getddo-spec을 우선한다

## 아키텍처 — FSD (Feature-Sliced Design)

레이어는 위에서 아래로만 참조 가능하며, ESLint(`eslint-plugin-boundaries`)가 커밋·CI에서 기계적으로 강제한다.

```
src/
  app/        # 라우터, 전역 Provider, 전역 스타일
  pages/      # 라우트 단위 화면 — 라우트 1개 = 슬라이스 1개
  widgets/    # 여러 feature/entity를 조합한 화면 블록
  features/   # 사용자 행동 단위 (enterEvent, checkAttendance, ...)
  entities/   # 도메인 모델 + 기본 표시 UI (event, ticket, user, ...)
  shared/     # 도메인을 모르는 공통 코드 (ui, api, model, hooks, utils, config)
  mocks/      # MSW 목업 — FSD 레이어 밖의 독립 영역, entities·shared만 참조 가능
```

슬라이스 내부는 `ui/`, `model/`, `api/`, `hooks/`, `utils/`, `assets/` 하위 폴더 + `index.ts`(공개 API)로 구성한다. 단, `pages` 슬라이스는 예외다 — 라우트가 페이지를 직접 가리키는 최상위 소비자라 공개 API 배럴이 불필요하므로, 페이지 컴포넌트(`XxxPage.tsx`)를 슬라이스 루트에 두고 `index.ts`를 만들지 않는다.

세그먼트 배치 기준:

- `ui/`에는 React 컴포넌트(.tsx)만 둔다 — 정적 데이터·에셋 매핑·상수·스토어·context는 `model/`, 순수 함수·로더는 `utils/`, React 훅(`use*`)은 `hooks/`, 이미지·폰트·오디오·에셋 CSS는 `assets/`에 둔다 (구 `lib/`은 2026-10-17 GD-222에서 폐기·3분리됐다)
- 슬라이스 루트 `index.ts`만이 공개 API다 — 세그먼트 `index.ts`는 두지 않고, 루트 index가 세그먼트 파일을 직접 참조해 공개 항목을 named export로 열거한다 (pages 제외 — pages는 index.ts 없이 루트의 `XxxPage.tsx`가 곧 공개 API다)
- 폴더·일반 파일은 camelCase, React 컴포넌트 파일은 PascalCase. `shared/ui/`만 shadcn 관례(kebab-case.tsx)를 따르고, 이미지·폰트·오디오 등 바이너리 에셋 파일명은 rename 대상이 아니다

기타:

- 새 화면을 추가할 때: `pages/<슬라이스>/XxxPage.tsx`를 만들고 `app/routes/userRoutes.tsx`(사용자) 또는 `app/routes/adminRoutes.tsx`(관리자, `AdminGuard` 적용)에 등록한다. 네비 항목은 `app/layouts/userNavItems.ts`와 `app/layouts/adminNavItems.ts`에 있다
- 관리자 페이지는 `pages/admin/<슬라이스>/`로 중첩하고, 관리자 라우트·레이아웃은 `React.lazy`로 로드해 유저 번들과 분리한다 — boundaries가 `src/pages/admin/*`을 개별 슬라이스로 인식하므로 admin 하위 페이지끼리의 import도 같은 레이어 규칙으로 차단된다
- `index.ts`가 `export {}`만 있는 슬라이스는 구현 예정 placeholder다 — 새 슬라이스를 만들지 말고 해당 슬라이스를 채운다 (예: `features/manageBanner`, `entities/banner`)

### 의존 방향

```
app → pages → widgets → features → entities → shared
```

금지 사항 (위반 시 `npm run lint`에서 error):

- 하위 → 상위 참조 ❌ (예: `entities → pages`)
- 같은 레이어의 다른 슬라이스 참조 ❌ (예: `features/enterEvent → features/checkAttendance`) — 공유가 필요하면 `shared`나 `entities`로 내린다
- 슬라이스 내부 파일 직접 import ❌ — 반드시 해당 슬라이스의 `index.ts`를 통해 import한다 (딥 임포트 금지). 단, pages는 슬라이스 루트의 `XxxPage.tsx`까지가 허용 경계다 — `ui/`·`model/`·`api/`·`hooks/`·`utils/`·`assets/` 하위 파일을 외부에서 참조할 수 없다
- `import.meta.env` 직접 참조 ❌ — `@shared/config/env`의 `env` 객체만 사용한다

## 코드 작성 규칙

### 기존 코드 우선

- 새 컴포넌트/함수/유틸을 만들기 전에 **반드시 기존 구현을 먼저 검색**한다
- `shared/ui/`(shadcn/ui), `shared/utils/`, `shared/hooks/`에 이미 있는 것을 새로 만들지 않는다
- UI 컴포넌트가 필요하면 `npx shadcn add <component>`로 `shared/ui/`에 생성한다

### 컴포넌트

- shadcn/ui 컴포넌트(`@shared/ui/*`)를 우선 사용한다
- 300줄을 넘는 컴포넌트는 분할을 우선 검토한다 (권장), 반복되는 UI는 공통 컴포넌트로 추출한다
- 색상은 토큰(`bg-primary`, `bg-brand-primary`, `text-fg-secondary` 등)을 쓰고 임의 색상(`bg-blue-500`, hex 하드코딩)을 쓰지 않는다 — 토큰 목록은 `docs/DESIGN-SYSTEM.md`, 값의 원천은 `src/app/styles/tokens.css`다

### API 호출

- 컴포넌트에서 fetch/axios를 직접 호출하지 않는다 — TanStack Query 훅을 통해 호출한다
- 조회(읽기) 훅은 `entities/*/api/`에, 사용자 행동 mutation 훅은 `features/*/api/`에 둔다 (예: `features/enterEvent/api/queries.ts`)
- 엔티티의 쿼리 키는 해당 `entities/*/api/`에서 상수로 export한다 (`EVENTS_KEY`, `TICKETS_KEY` 등). 다른 슬라이스에서 무효화할 때 이 상수를 쓰고, 문자열 리터럴로 키를 적지 않는다
- 서버 응답은 Zod 스키마로 검증한다 (`entities/*/model/`에 정의)
- 시간은 서버에서 UTC로 받고, 화면 표시는 `shared/utils/date`의 KST 변환 함수를 사용한다
- "지금"이 필요한 코드는 `new Date()`를 직접 호출하지 않고 `useVirtualClock().now()`(`shared/model/virtualClock`)를 쓴다 — 관리자 시간 여행이 오버라이드할 수 있어야 한다. 컴포넌트 밖 순수 함수는 `now`를 인자로 받는다
- 응모·추첨 등 중복 위험 요청에는 `shared/utils/idempotencyKey`의 멱등키를 붙인다. 헤더명은 `IDEMPOTENCY_HEADER` 상수(`Idempotency-Key`)를 쓰고 문자열을 직접 쓰지 않는다 (ADR-0005)

### 상태 관리 (역할이 겹치지 않도록 구분)

새 상태의 도구는 **공유 범위 → 수명 → 변화 빈도** 순으로 판단한다:

| 판단 질문                                         | 데이터 종류                                                 | 도구                                   |
| ------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| 서버가 진실의 원천인가?                           | 서버 데이터 (이벤트 목록, 응모권 잔액)                      | TanStack Query                         |
| 한 컴포넌트·페이지 안에서만 살고 사라져도 되는가? | 일시적 로컬 상태 (입력값, 열림, 진행 단계)                  | `useState`/`useReducer` — 전역화 금지  |
| 여러 컴포넌트·화면이 동기적으로 공유하는가?       | 전역 UI 상태 (테마, 큰글씨, 전역 모달, 화면 간 "의도" 전달) | Zustand (`shared/model/uiSettings` 등) |
| Provider 생명주기와 같고 드물게 변하는가?         | 세션·환경 Context (가상 시계, 인증 세션)                    | React Context                          |
| 여러 화면을 오가는 복잡한 전이가 있는가?          | 복잡한 전역 플로우                                          | Redux Toolkit                          |
| 폼인가?                                           | 폼 상태                                                     | React Hook Form (전역 승격 금지)       |

- 서버 데이터를 Zustand·Redux·store 내부 비동기 호출로 복사·캐싱하지 않는다 — 캐시·무효화·재시도는 TanStack Query가 소유한다 (store 안에서 `fetch → set()` 하는 이중 캐시 패턴 금지)
- 로그인·가상 사용자 등 조건이 필요한 데이터는 라우트 가드(`app/routes/UserGuard`·`AdminGuard`)가 1차로 차단한다 — entities 쿼리 훅이 세션 스토어를 참조하면 같은 레이어 참조 위반이라 훅 내부에서 게이팅하지 않는다. 화면 단의 세부 조건은 호출부에서 `enabled`로 넘긴다
- 여러 컴포넌트가 같은 행동을 중복 요청할 수 있으면 `useRef` Set으로 동기적으로 차단하고, 서버 측 중복은 멱등키로 막는다 (ADR-0005)
- 컴포넌트 트리 밖 → 안쪽으로 신호를 보낼 때는 props 드릴링 대신 "의도" store(pending flag + consume) 패턴을 쓴다

역할 분리 기준은 `docs/adr/ADR-0003-state-management-roles.md`를 따른다. Redux Toolkit은 의존성만 있고 스토어는 아직 없다 — 필요한 전역 플로우가 생길 때 도입한다. 가상 시계는 상태 라이브러리가 아닌 `shared/model/virtualClock`의 React context다 — context·훅·Provider·저장 키가 한 폴더에 있다. Provider 중첩은 `QueryClientProvider`가 가장 바깥이다 — Context 기반 상태(가상 시계)가 쿼리의 `enabled`·queryFn에 영향을 줄 수 있어야 한다.

### 스타일

- TailwindCSS v4 + shadcn/ui, `@custom-variant dark` 기반 다크모드
- 조건부 클래스는 `cn()`(`@shared/utils/cn`)으로 조합한다
- Prettier가 포맷을 강제한다: 세미콜론, 싱글 쿼트, 4칸 들여쓰기 (커밋 시 자동 적용)

### 타입·import

- 타입 import는 `import type`으로만 한다 (ESLint가 강제 — `verbatimModuleSyntax`와 짝)
- import 정렬은 ESLint(`perfectionist/sort-imports`)가 강제한다 — 외부 패키지 → 내부 alias(`@app`~`@shared`) → 상대경로 순. 수동 정렬 금지, `eslint --fix`에 맡긴다
- `console.log` 금지 — `console.warn`/`console.error`만 허용. 디버깅 로그는 커밋 전에 지운다

> 협업 프로세스 상세(브랜치 라이프사이클, PR 절차, 리뷰 규칙)는 [CONTRIBUTING.md](./CONTRIBUTING.md) 참조.
> 아래는 작업 시 반드시 지켜야 하는 규칙의 요약본이다.

## 브랜치 전략

- `main` — 배포/시연 가능한 안정 버전
- `dev` — 개발 통합 브랜치
- 작업 브랜치 — `dev`에서 생성, `<타입>/<Jira 이슈 키>` 형식, Jira 키는 대문자 유지
    - `feat/GD-123`, `fix/GD-45`, `refactor/GD-67`, `chore/GD-1`, `docs/GD-12`
- Jira 연동으로 이슈 키의 브랜치가 원격에 자동 생성될 수 있다. 작업 브랜치를 만들기 전에 `git fetch` 후 `git ls-remote --heads origin '*/<Jira 키>'`(또는 `git branch -r`)로 동일 키의 원격 브랜치가 있는지 확인한다
    - 이미 있으면 새로 만들지 않고 해당 브랜치를 체크아웃(`git switch <브랜치>`)해 이어서 작업하고, `dev`보다 뒤처져 있으면 `dev`를 머지해 동기화한다
    - 원격에 없을 때만 `dev`에서 새로 생성한다

## 커밋 컨벤션

Conventional Commits + 팀 확장 타입. `commit-msg` 훅의 commitlint(`commitlint.config.js`)가 타입 목록과 형식을 강제한다 — 형식 위반은 커밋 단계에서 바로 걸린다.

```
<타입>: <제목>          예) feat: 응모 버튼 멱등키 적용
<타입>(<스코프>): <제목>  예) fix(ticket): 만료일 표시 오류 수정
```

- 제목은 `sentence-case`, `start-case`, `pascal-case`, `upper-case` 형식으로 쓰지 않는다 (`subject-case` 규칙이 제목 전체를 검사한다 — 한글·소문자 시작 제목이 안전하다)
- 본문 각 줄은 100자 이하
- 허용 타입 목록과 타입별 의미는 CONTRIBUTING.md를 따른다

## PR 규칙

- 작업 브랜치 → `dev` 대상으로 PR 생성
- 머지 조건: CI(lint·format·test·build) 통과 + 최소 1명 리뷰 + Squash and Merge
- PR 템플릿(`.github/pull_request_template.md`)의 관련 이슈·작업 내용·테스트 결과·리뷰 포인트·체크리스트를 모두 채운다

## 개발·테스트

- 개발 서버: `npm run dev` (`VITE_ENABLE_MSW=true`면 MSW 목업으로 시작 — 준비 절차는 CONTRIBUTING.md)
- 테스트는 대상 파일 옆에 `*.test.ts(x)`로 둔다 (Vitest, jsdom, globals 활성, setup `src/shared/test/setup.ts` + MSW 수명주기 `src/mocks/testSetup.ts`). `utils/`의 순수 함수와 비자명한 파생 로직에는 테스트를 둔다

## 검증 명령

작업 완료 전에 아래를 모두 통과시킨다 (CI와 동일한 검사):

```bash
npm run format:check  # Prettier
npm run lint          # ESLint — FSD 규칙 포함, 경고 0개 기준
npm run test:ci       # Vitest
npm run build         # tsc -b && vite build
```

커밋 시 pre-commit 훅이 lint-staged(ESLint --fix + Prettier)를 자동 실행한다.

## 금지 사항

- 새 상태관리·UI 라이브러리를 임의로 추가하지 않는다 (추가가 필요하면 팀 합의 후). 설치만 된 미사용 의존성(`gsap`, `canvas-confetti`, `react-day-picker` 등)을 새로 도입할 때도 마찬가지다 — 허용된 것: `framer-motion`(모션), `sonner`(토스트), `@tanstack/react-table`(테이블)
- `main`과 `dev`에 직접 커밋·push하지 않는다 — `dev`는 PR(Squash and Merge)로만 머지한다. 한 브랜치는 한 Jira 이슈에 대응한다
- 기존 컴포넌트/유틸과 유사한 것을 새로 만들지 않는다
- API 스키마·연동 계약을 임의로 변경하지 않는다
- 타입 에러를 `any`로 해결하지 않는다
- ESLint 규칙을 임의로 disable하지 않는다 (특히 `boundaries/*`)
- 테스트를 삭제해서 빌드를 통과시키지 않는다
- `.env*` 파일에 실제 비밀값을 넣거나 커밋하지 않는다 (`.env.example`만 커밋)
- 요구사항이 불명확하면 추측하지 않는다 — `../getddo-spec/`의 요구사항·도메인 문서와 기존 코드를 먼저 확인하고, 미확정이면 작업을 멈추고 사용자에게 질문한다
