# GD-244 공통 감사 조회 제거 실행 계획

> **실행자 지침:** `executing-plans` 스킬로 아래 작업을 순서대로 실행한다. 사용자 승인 전에는 구현하지 않는다.

**목표:** R05에 따라 관리자 공통 감사 메뉴·직접 경로·대시보드 샘플 기록·조회 목업을 제거하고 개별 업무 이력을 보존한다.

**구조:** 기존 관리자 라우트의 `*`와 `NotFoundPage`를 재사용한다. 공통 감사 조회 전용 소비자와 엔티티를 함께 제거하며 새 라우팅 패턴이나 대체 API를 만들지 않는다.

**기술:** 기존 TypeScript·React·React Router·TanStack Query·MSW·Vitest·Testing Library를 사용한다. 의존성 추가는 없다.

**명세:** `../getddo-spec/00-requirements/scope.md`, `../getddo-spec/03-decisions/024-audit-recording-without-query.md`, `../getddo-spec/05-api/audit.md`. 원래 계획은 `2026-10-19-development-roadmap.md`의 R05다.

## 제약과 현재 상태

- AU01/AU02와 전용 조회 화면은 제외한다. 내부 감사 저장·테이블·기존 데이터와 추첨 업무별 실패·확인·공개·취소 이력은 유지한다.
- AU API·대체 샘플 패널·새 환경 변수·설정·인증 변경은 추가하지 않는다. BE와 공용 명세는 수정하지 않는다.
- ADR-024 문서 상태는 제안이지만, 제외 정책은 scope와 audit.md에 명시된 사용자 결정이다.
- 현재 `dev`이며 미추적 로드맵·후속 프롬프트·`reports/`는 기존 작업으로 보존한다. 계획 파일만 작성한 상태에서 승인을 기다린다.
- 승인 후 `git fetch`와 `git ls-remote --heads origin '*/GD-244'`로 기존 작업 브랜치를 확인한다. 있으면 재사용하고 없으면 dev 기준 `refactor/GD-244`를 만든다. 원격 확인 실패를 브랜치 부재로 간주하지 않는다.
- KB 템플릿·오류·자산 카드를 검색했다. 랜딩 전용 자산은 적용 대상이 아니며 과거 오류의 코드나 패턴은 적용하지 않는다. 경로 참조는 소스 밖 설정·문서까지 직접 검색한다.
- `execution-audits`는 현행 계약과 FE 문서에 있으나 현재 FE 소스에 구현은 없다. 이번 작업에서 새로 구현하거나 구현 완료라고 보고하지 않는다.

## 파일별 책임과 삭제 범위

| 처리 | 파일                                                    | 책임                                                                                               |
| ---- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 수정 | `src/app/routes/adminRoutes.tsx`                        | audit 라우트와 lazy import를 제거한다. 기존 관리자 404를 유지한다.                                 |
| 수정 | `src/app/layouts/adminNavItems.ts`                      | 감사 메뉴와 사용하지 않는 ScrollText import를 제거한다. 데스크톱·모바일 공통 목록이다.             |
| 수정 | `src/pages/admin/dashboard/AdminDashboardPage.tsx`      | RecentAuditLogsPanel import·렌더·관련 설명을 제거한다.                                             |
| 수정 | `src/pages/admin/dashboard/ui/DashboardPanel.tsx`       | 공통 카드 설명에서 삭제되는 감사 미리보기 예시를 정리한다.                                         |
| 수정 | `src/mocks/handlers/index.ts`                           | auditHandlers import와 handlers·hybridHandlers 등록을 모두 제거한다.                               |
| 삭제 | `src/pages/admin/audit/AdminAuditPage.tsx`              | 공통 감사 조회 전용 화면이다.                                                                      |
| 삭제 | `src/pages/admin/dashboard/ui/RecentAuditLogsPanel.tsx` | 샘플 기록·전체 보기·상세 서랍을 노출하는 전용 패널이다.                                            |
| 삭제 | `src/entities/audit/index.ts`                           | 공통 조회 전용 공개 API다.                                                                         |
| 삭제 | `src/entities/audit/api/queries.ts`                     | AU 목록·상세 요청과 캐시 키다.                                                                     |
| 삭제 | `src/entities/audit/model/types.ts`                     | AU 응답 스키마·라벨이다.                                                                           |
| 삭제 | `src/entities/audit/ui/AuditLogTable.tsx`               | 공통 감사 목록 표다.                                                                               |
| 삭제 | `src/entities/audit/ui/AuditLogDetailDrawer.tsx`        | 공통 감사 상세 서랍이다.                                                                           |
| 삭제 | `src/mocks/handlers/audit.ts`                           | 읽기 전용 샘플 데이터와 AU 핸들러다. 업무 저장 코드가 아니다.                                      |
| 수정 | `README.md`, `docs/CONTEXT.md`                          | 제공 기능 목록·시연 목업 유지 설명을 실제 제거 상태로 바꾼다. 내부 저장·업무 이력 설명은 유지한다. |
| 추가 | `src/app/routes/adminRoutes.test.tsx`                   | 실제 라우트·레이아웃을 통한 탐색과 직접 URL 회귀를 검증한다.                                       |
| 추가 | `src/pages/admin/dashboard/AdminDashboardPage.test.tsx` | 대시보드 실제 렌더에서 공통 감사 요청·샘플 패널이 없음을 검증한다.                                 |

삭제 후보는 총 8개다. 검색 결과 엔티티의 외부 소비자는 전용 화면·대시보드 패널·audit 목업이며, 목업은 전체/하이브리드 등록에서만 소비한다. 삭제 직전 전체 저장소 참조를 다시 확인하고 이 목록의 파일만 개별 삭제한다. 추가 소비자가 발견되면 보존 여부를 먼저 판단하고 승인 범위를 벗어나는 삭제는 하지 않는다. 과거 계획·보고서·ADR의 역사적 언급은 보존한다.

## 작업 1: 관리자 진입점과 대시보드 회귀

소비: 기존 `adminRoutes`, `ADMIN_NAV_ITEMS`, `AdminDashboardPage`. 결과: 감사 경로가 기존 404로 끝나고 대시보드가 AU 요청을 만들지 않는다.

- [x] 승인과 브랜치 확인 후 기존 테스트 Provider·세션 fixture·MSW 관례를 읽는다.
- [x] `adminRoutes.test.tsx`에서 관리자 세션으로 실제 라우트와 레이아웃을 렌더한다. 감사 링크가 데스크톱·모바일 메뉴 모두에 없고 이벤트·추첨 링크는 남는지 검증한다. `/admin/audit`, `/admin/audit/임의ID`, 쿼리가 붙은 `/admin/audit?page=2`가 관리자 셸 안의 기존 404로 끝나는지 검증한다. 기존 가드의 비로그인·일반 사용자 동작도 유지되는지 확인한다.
- [x] `AdminDashboardPage.test.tsx`에서 실제 페이지와 QueryClient를 렌더하고 정상 대시보드 패널이 표시될 때까지 기다린다. MSW 요청 관찰자로 `/v1/admin/audit-logs` 및 하위 경로 요청이 0건인지 확인하고 최근 운영 기록·감사 상세·감사 전체 보기 링크가 없는지 검증한다. 쿼리 훅 자체를 mock하지 않는다.
- [x] `npx vitest run src/app/routes/adminRoutes.test.tsx src/pages/admin/dashboard/AdminDashboardPage.test.tsx`로 제거 전 실패를 확인한다.
- [x] 라우트·메뉴·대시보드 import와 렌더를 제거하고 같은 테스트가 통과하는지 확인한다.

## 작업 2: 조회 구현·목업 제거와 문서 정합화

소비: 작업 1에서 끊은 UI 참조와 기존 `handlers`, `hybridHandlers`. 결과: 두 목업 모드에 AU 핸들러가 없고 조회 전용 파일이 남지 않는다.

- [x] `rg -n 'audit|Audit|audit-logs|/admin/audit' src`와 저장소 전체 검색으로 삭제 후보의 소비자와 설정 문자열을 재확인한다.
- [x] 목업 등록 두 곳과 import를 제거하고 위에서 확정한 8개 파일을 개별 삭제한다. 추첨·응모·어뷰징 핸들러는 보존한다.
- [x] README와 CONTEXT의 공통 감사 제공·시연 유지 문구를 제거 상태로 맞춘다. ADR-0006과 과거 보고서는 이미 제외 정책을 설명하므로 이력으로 보존한다.
- [x] 테스트 파일의 부정 검증 문자열과 정책 설명을 제외한 런타임 AU 참조가 0개인지 확인한다. 삭제 경로가 설정에 남지 않았는지도 검색한다.

## 작업 3: 업무 이력 회귀와 필수 검증

- [x] `npx vitest run src/mocks/handlers/draw.test.ts src/mocks/handlers/drawResult.test.ts`로 기존 추첨 실행·정합성 검증·확인·공개·취소·재추첨 동작을 회귀 검증한다. 기존 테스트가 실제 보장하는 항목만 보고한다.
- [ ] 로컬 브라우저에서 관리자 데스크톱/모바일 메뉴, 대시보드, 직접 감사 URL의 404와 다른 관리자 화면 이동을 확인한다. 네트워크에서 대시보드 AU 요청 0건을 확인한다.
- [x] 추첨 화면에서 기존 정합성 검증 이력·취소/재추첨 연결을 목업으로 확인한다. 서버 쓰기나 실제 추첨을 실행하지 않는다. 미구현 execution-audits의 서버 검증을 했다고 보고하지 않는다.
- [ ] `npm run format:check`, `npm run lint`, `npm run test:ci`, `npm run build`를 모두 실행한다. build의 `tsc -b`로 타입 검사도 확인한다. 기존 문제는 새 변경의 문제와 구분하며 무관한 경고를 자동 수정하지 않는다.
- [x] `git diff --check`, `git diff --stat`, `git diff`, `git status --short`와 삭제 목록을 확인한다. 추첨 도메인·핸들러·저장 코드 변경이 없음을 확인한다.
- [x] `verification-before-completion`과 `common-reporting-guide`로 명령 결과·브라우저 증거·한계를 보고한다. R05 체크는 검증된 뒤에만 갱신하며 원래 미추적 로드맵의 다른 내용은 보존한다. 커밋·PR·배포는 실제 수행 여부를 구분한다.

## 승인 대상

위 메뉴·라우트 제거, 8개 조회 전용 파일 삭제, 문서 정리와 회귀 테스트 추가를 승인받는다. 기존 라우트에서 제외된 경로를 제거하는 작업이며 새 아키텍처·API 계약·의존성·DB·인증·환경 설정 변경은 없다. 실행은 이 채팅에서 `executing-plans`로 진행한다.

## 실행 결과 — 2026-10-19

- 사용자가 계획을 승인했다. 원격 조회 성공 후 기존 GD-244 브랜치가 없음을 확인하고 `refactor/GD-244`를 만들었다.
- 계획한 조회 전용 파일 8개만 삭제했다. 실행 소스의 AU 참조는 0개이며 테스트의 부정 검증 문자열만 남았다. 추첨 도메인·핸들러·페이지는 변경하지 않았다.
- 제거 전 테스트에서 감사 메뉴 노출·감사 경로 정상 진입과 대시보드 `/api/v1/admin/audit-logs` 요청 1건을 확인했다. 제거 후 해당 회귀 테스트가 통과했다.
- 관리자 경로·대시보드·추첨 회귀는 4개 파일 37개 테스트 통과, 전체 `npm run test:ci`는 61개 파일 475개 테스트 통과다. 샌드박스 임시 모듈 ENOENT 때문에 테스트는 권한 확장 환경에서 실행했다.
- `npm run lint`와 `npm run build`는 종료 코드 0이다. build는 `tsc -b` 타입 검사를 포함한다. `git diff --check`도 통과했다.
- 변경 파일 10개를 명시한 `npx prettier --check`는 모두 통과했다. 최종 전체 테스트 재실행도 61개 파일 475개 테스트가 통과했다.
- `npm run format:check`는 기존 미추적 `2026-10-19-development-roadmap.md`, `2026-10-19-next-session-prompts.md`, `reports/20261019-deployment-audit.md` 3개에서 실패했다. 사용자 규칙에 따라 무관한 형식 문제는 수정하지 않았다. 필수 검사 전체 통과로 보고하지 않고 R05 완료 체크도 보류한다.
- 앱 내 브라우저에서 목업 기반 대시보드 패널·데스크톱/320px 모바일 메뉴·쿼리/하위 경로 직접 URL의 관리자 404를 확인했다. 모바일 메뉴에서 Tab→Enter로 추첨 화면에 진입했다. 추첨의 실패 정보·당첨 취소 근거·최초 확정 결과와 정합성 검증/공개 명단 변경 이력의 빈 상태를 확인했다. 실제 추첨·공개·취소 쓰기는 실행하지 않았다.
- 대시보드 AU 요청 0건은 MSW `request:start`를 관찰하는 실제 페이지 렌더 테스트로 검증했다. 브라우저 네트워크 캡처는 전용 MCP Chromium 미설치로 수행하지 못했으며, 앱 내 브라우저의 화면 확인과 구분한다. 테마·200% 확대·자동 접근성 검사는 수행하지 않았다.
- `execution-audits`의 미구현 상태는 유지된다. BE 내부 저장·실서버 조회를 실행하거나 변경하지 않았다. 커밋·push·PR·배포는 수행하지 않았다.
