# GD-257 L4 게임 4종·기록·보상 실연동 계획

> 실행자는 `executing-plans`로 아래 작업을 순서대로 수행한다. 사용자 지시에 따라 서브에이전트를 사용하지 않는다. 사용자의 “진행해줘”로 이 계획을 승인받았다. 현재 상태는 **사용자 게임 구현·검증 완료, 배포 인수 대기**이며 L4 전체 완료가 아니다.

**목표:** 서버 발급 플레이와 네 게임의 원본 입력을 연결하고 서버 결과·누적 통계·응모권을 대조한다. 이번 세션은 L4만 수행한다.

**구조:** 기존 FSD, TanStack Query, Zod, 게임 화면·물리·에셋을 재사용한다. 조회는 game 엔티티, 시작·제출과 판별 입력 기록은 playGame feature, 화면 조합은 gameDetail 페이지가 소유한다. 서버 데이터와 일시적 플레이 상태를 분리한다.

**기술:** 현재 React·TypeScript·Vitest·MSW를 유지한다. 의존성·환경 변수·빌드 설정·라우트·인증 방식을 추가하지 않는다.

**명세:** `../../../../getddo-spec/05-api/game.md`, 네 `game-*-draft.md`의 채택 범위, `../../../../getddo-spec/02-domain/game.md`, 상위 로드맵의 공통 규칙·L4.

## 확인한 기준과 승인 경계

- 2026-10-20 `git fetch origin` 성공. 로컬 dev와 origin/dev는 `adf279e0cf87846cfb90fe073567fa00dbdb1920`이다. PR #105가 포함됐고 그 이전 PR #106도 포함돼 있다.
- `git ls-remote --heads origin '*/GD-257'` 결과는 없다. 깨끗한 dev에서 `feat/GD-257`을 생성했다. Jira 생성·담당 변경은 하지 않는다.
- 기존 게임 이력에는 GD-120 색깔·GD-127 타이밍·GD-204 주문과 GD-222 구조 정리가 있다. 현재 G01 임시 모델, 임시 ID 선택, 점수 단독 `/play`, 자체 난수를 확인했다. 이를 재사용·수정하며 게임을 새로 작성하지 않는다.
- 채택된 API 소비는 계약 변경이 아니다. 기존 승인인 네 게임 규칙·보상 점수·ADMIN 시작 권한을 재질문하지 않는다. 현재 문서에서 L4 구현 계획 승인은 확인되지 않아 이 계획만 승인받는다.
- AG01~AG03·게임 변경·예약 API는 미확정이다. 운영 기능을 만들거나 전체 게임 운영 완료로 표시하지 않는다. 확정 계약 또는 범위 조정 결정이 필요하다는 사실을 인계한다.
- KB의 패턴·프론트 자산·훅 노트를 조회했다. 랜딩 자산은 이번 작업에 해당하지 않고 훅 노트의 React 19.3 예제는 현재 19.2.8과 달라 복사하지 않는다. 프로젝트 코드와 채택 계약을 구현 기준으로 사용한다.

## 변경 파일과 책임

| 파일                                                                                                             | 책임                                                                                                |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `src/entities/game/model/types.ts`, `api/queries.ts`, `index.ts`                                                 | G01 요약·G02 상세·G05 누적 통계의 별도 스키마·키·조회. UUID 요청과 nullable 설명 유지               |
| `src/entities/game/model/gameContent.ts`, `model/gamePath.ts`, `ui/GameTicketCard.tsx`, `ui/GameGuideDialog.tsx` | code 기반 안내·이미지, 서버 이름, 최소 점수 안내, UUID 경로 유지                                    |
| `src/features/playGame/model/types.ts`, `api/queries.ts`, `index.ts`                                             | G03·G04 스키마·mutation, 결과 상태·오류·동일 입력 재시도, 기존 티켓 키 무효화                       |
| `src/features/playGame/model/gamePlayers.ts`, `utils/preloadGame.ts`, `ui/GamePlayer.tsx`                        | code별 플레이어 선택, 시작 성공 정보 전달, 새 판과 재시도 분리                                      |
| `src/features/playGame/model/{colorWord,takkoRun,takkoTiming,takkoOrder}.ts` 및 인접 테스트                      | 서버 rules 적용, 결정적 생성·시간·종료·점수 경계                                                    |
| `src/features/playGame/model/gameSession.ts` 및 인접 테스트                                                      | feature 내부 공통 xorshift32·판별 입력 타입·제출 스냅샷. 기존 순수 모델에 같은 기능이 있으면 재사용 |
| `src/features/playGame/ui/{ColorWordGame,TakkoRunGame,TakkoTimingGame,TakkoOrderGame,RewardDialog}.tsx`          | 답변·tick·정수 ms·picks 기록, 일시정지, 서버 결과·재시도 표시                                       |
| `src/pages/gameDetail/GameDetailPage.tsx`, `ui/{GameHero,GameStats}.tsx`                                         | 상세·시작·결과·통계 조합, ADMIN 체험과 기록 권한 차이, 오류·빈 상태                                 |
| `src/widgets/gameRail/ui/GameRail.tsx`, `src/pages/missionList/`의 게임 적립 안내                                | 서버 목록과 code 소비, 임시 횟수 제한 제거. L5 미션 로직은 수정하지 않음                            |
| `src/mocks/handlers/game.ts`, `game.test.ts`, `index.ts`                                                         | 계약 fixture·테스트 유지, 실연동 검증 후 hybridHandlers의 gameHandlers만 해제                       |
| 이 계획, 로드맵, `docs/backend-integration-status.md`, `docs/superpowers/plans/L4-handoff.md`                    | 실제 증거·잔여 조건·L5 인계 기록                                                                    |

## 실행 순서와 검증

### 1. 조회 계약과 식별자

- [x] G01 `{id,code,name,description}`와 G02 `{ruleVersion,rules,serverTime}`를 분리하고 G05의 `bestScore,totalScore,validPlayCount,rewardDate,rewardClaimedToday,nextResetAt,serverTime`을 검증한다.
- [x] 모든 HTTP 경로에 목록의 UUID를 사용하고 플레이어·에셋만 code로 선택한다. 미지원 code/버전·404·409·조회 실패를 기본 게임으로 보정하지 않는다.
- [x] 누적 유효 플레이 횟수를 “오늘 플레이”로 표시하지 않는다. dailyLimit/remainingPlays와 비계약 필드를 제거하고 관련 소비자를 검색해 갱신한다.
- [x] 인접 스키마·쿼리·화면 테스트에서 nullable 설명, 빈 목록, 누적 수치, USER/ADMIN G05 차이를 확인한다.

### 2. 플레이 발급·원본 제출·재시도

- [x] 시작 버튼만 본문 없는 `POST /v1/games/{UUID}/plays`를 호출하고 201 성공 후 seed/rules를 고정한다. 시작 응답 유실은 자동 재발급하지 않는다.
- [x] G03의 playId/playToken·규칙·seed를 판 단위로 보존하고 자연 종료 시 원본 validationData를 복제·고정한다. G04는 `PUT /v1/games/{UUID}/plays/{playId}/result`에 `{playToken,validationData}`만 제출한다.
- [x] 기존 feature 내부 메모리 상태로 미확정 결과와 원본을 유지한다. 해결 전 새 판으로 덮어쓰지 않으며 늦은 응답을 다른 판에 적용하지 않는다. 새로고침 후 복구용 브라우저 영속 저장은 이번 계획에 추가하지 않고 미지원 범위를 명시한다.
- [x] 202 PROCESSING·응답 유실·5xx는 같은 판·본문으로 재시도한다. 404 은닉, 409 입력 충돌, 413 한도, 429 Retry-After를 별도 표시한다. ADMIN은 체험만 하고 G04/G05를 호출하지 않는다.
- [x] VALID·INVALID·PROCESSING·reward=null을 구분한다. 확정 응답을 클라이언트 점수로 대체하거나 보상을 로컬 잔액에 합산하지 않는다.
- [x] MSW 지연·응답 유실·중복 제출·본문 동일성·429 대기 테스트를 작성하고 `/play` 요청이 사라졌는지 검색한다.

### 3. 네 게임 입력과 공통 예제

- [x] 색깔: xorshift32 색 순서·재추출·활성 정수 ms·시간 초과 정규화와 클릭 경합을 검증한다. seed 123456789의 첫 네 문제와 명세 10점 예제, 세 번째 실패 종료·50점 경계를 확인한다.
- [x] 타꼬런: dt=1/120 고정 누산, tick0 press, 동일 tick 배열 순서, 정지 release를 기록한다. 충돌 또는 endTick=71999에서 종료하며 렌더 프레임·정지·카운트다운이 활성 tick에 섞이지 않게 한다.
- [x] 타꼬런 고정 원본의 충돌 데이터·난수 소비 순서를 대조하고 seed/inputs/endTick/score 공통 벡터를 고정한다. BE 소스·배포 응답과 대조하지 못한 벡터는 TS 검증으로만 기록한다.
- [x] 타이밍: 누른 순간 Math.floor한 ms로 화면과 제출을 함께 판정한다. seed1의 0/40/50/60점·반사 이동, 192/832·191/833·416/608·415/609 경계와 첫 실패 종료를 검증한다.
- [x] 주문: seed1의 3→4→5→6 성공·세 번 실패 18점 예제, 세 번 연속 메뉴 재추출, 첫 오답까지만 picks 기록, 세 번째 실패 종료를 검증한다. 얼굴 난수를 분리하고 탭 이동 중 주문 표시 시간을 정지한다.
- [x] 모든 게임에서 미완료·종료 후 추가 입력·10,000개/1MiB 상한을 검증한다. 한도 도달은 정상 완료로 바꾸지 않는다.

### 4. 실제 연동과 보상 대조

- [x] 격리된 시연 USER/ADMIN으로 G01/G02/G03 성공, USER G04/G05 성공과 ADMIN 체험을 확인한다. 기존 공통 사용자 문맥을 유지한다.
- [x] 네 게임의 기준 미달·정확한 기준·기준 초과, 동일 판 재제출 전후 G05와 T01/T02를 비교한다. reward의 등급·1장·지급/만료 시각과 실제 원장·잔액을 대조한다.
- [x] KST 자정은 최초 VALID completedAt 기준이며 재시도 시 최초 보상을 유지한다. 실제 자정 표본이 없으면 자동 테스트만 통과했다고 구분한다. 서버 시간을 조작하지 않는다.
- [x] 브라우저 Network에서 UUID 경로·원본 입력·MSW 미개입·응모권 갱신을 확인한다. API 직접 호출과 브라우저 검증을 따로 기록한다.
- [x] 실제 연동 검증을 통과한 뒤 hybridHandlers에서 gameHandlers를 해제한다. 테스트 handlers와 로컬 fixture는 유지한다. 정상 표본·격리 계정·공통 Java 벡터가 없으면 해당 조건을 외부 차단으로 남긴다.

### 5. 최종 검사와 인계

- [x] `npm run format:check`, `npm run lint`, `npm run test:ci`, `npm run build`, `git diff --check`의 실제 실행 결과를 기록한다. 기존 경고를 무관하게 자동 수정하지 않는다.
- [x] `git diff`로 L5·다른 담당 변경·비계약 API·민감값 유입을 점검한다. 이번 작업 문서·코드의 필요한 포맷만 정리한다.
- [x] 계획 체크박스·로드맵·연동 현황을 증거대로 갱신한다. 구현 완료·인수 대기·L4 완료를 별개로 기록한다.
- [x] L4-handoff에 브랜치·커밋·PR·머지/배포 상태, 검사 결과, 실서버 미검증, 외부 차단, 사용자 결정, L5 영향 파일·착수 가능 여부를 남긴다. 자동 머지·실제 배포는 하지 않는다.

## 선행 조건과 완료 판정

확정 계약 소비와 로컬 검증은 독립적으로 진행한다. 실서버 검증에는 네 게임 등록 UUID·지원 버전·현재 배포와 격리 USER/ADMIN, 지급 이력 표본이 필요하다. 현재 원격 FE 확인만 끝났고 실서버 게임 검증은 아직 수행하지 않았다.

관리자 운영의 확정 계약과 Java/TS 공통 예제 대조 증거가 없거나 실서버 보상 검증이 남으면 L4 전체 완료로 표시하지 않는다. L5는 다음 새 세션으로 넘기며 L4의 잔여가 L5를 실제로 차단하는지 인계 문서에서 명시한다.

## 실행 증거와 인수 잔여

- 원격 dev는 착수·최종 fetch 모두 adf279e다. 작업 브랜치는 feat/GD-257이며 Jira 생성·담당 변경·자동 머지·실제 배포는 하지 않았다.
- 전체 자동 테스트: 94개 파일·691개 테스트 통과. format:check·lint·build·git diff --check의 최종 결과는 L4-handoff에 기록한다. 샌드박스 변환 캐시 ENOENT는 정상 실행 환경에서 같은 명령을 재실행해 해결했다. 설정을 바꾸지 않았다.
- 실제 API: 네 게임 VALID(50/18/451/50점)·중복 불변·게임별 1장·G05/T01/T02·ADMIN 차이, 기준 미달·INVALID·404/409/413·429 대기를 확인했다. JSON 증거 2개에 원문 토큰을 기록하지 않았다.
- 브라우저: MSW 없는 로컬 preview+실제 API 프록시에서 네 게임 VALID(0/121/0/0점), 타이밍 응답 유실·원본 재시도·내 응모권·320px 가로 넘침 없음·JS 예외 없음. 새로고침 복구·실제 배포 CORS 인수는 포함하지 않는다.
- Java 고정 예제와 TS 테스트: 타꼬런 seed1/endTick348/122점, seed123456789/endTick347/121점이 일치한다. 실서버의 새 seed·입력에서도 서버 점수와 TS 계산을 대조했다. 타이밍·주문·색깔의 명세 예제를 자동 테스트로 실행했다.
- 로컬 MSW는 고정 예제 fixture이며 임의 정상 플레이의 완전한 서버 시뮬레이터가 아니다. fixture 성공을 실연동 증거로 사용하지 않았다.
- 외부 차단: 관리자 AG01~AG03·변경/예약 계약 확정 또는 사용자 범위 조정, 변경본 배포 후 인수. 미확정 API는 추가하지 않았다.
- 미검증: 실제 KST 자정·실제 PROCESSING 잠금 경합·실기기 10분 연속 UI 플레이·GOLD/PLATINUM 실제 지급. 자정·PROCESSING·71999 tick 종료는 자동 테스트로 구분해 검증했다.
- 사용자 선택 재사용: 네 게임 규칙·보상 기준·ADMIN 체험·기존 사용자 문맥. 새 의존성·DB/API 계약·인증·환경 변수 정의·라우트·빌드 설정 변경은 없다.
- L5는 새 세션에서 독립적으로 착수할 수 있다. 공유 파일·미병합 변경과 L5 고유 선행 조건은 L4-handoff를 따른다.
