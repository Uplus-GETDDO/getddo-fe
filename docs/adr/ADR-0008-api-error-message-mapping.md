# ADR-0008: API 오류 문구 결정 순서

- 상태: accepted
- 날짜: 2026-10-08

## 맥락

`shared/api/client.ts`는 실패 봉투(`{ success: false, code, message, data: null }`)를 `ApiError(code, message, status)`로 정규화한다. 그러나 화면에 보일 문구는 컴포넌트마다 `error instanceof ApiError ? error.message : '...'`로 따로 정한다. 이 방식은 다음 문제가 있다.

- 서버 메시지 톤·용어가 그대로 노출된다. 또 업무 오류가 아닌 응답(5xx, MVC 표준 예외)의 `message`는 공개용으로 정의된 문구가 아닌데도 화면에 그대로 나간다
- 같은 코드(`INSUFFICIENT_TICKETS` 등)가 화면마다 다른 문구로 보일 수 있다
- 공통 문서(`../getddo-spec/05-api/common.md`)는 검토 대기지만 개별 채택·현행 구현 오류 코드가 함께 기록돼 있다. 제안 이름과 실제 `ENTRY-xxx`·`MISSION-xxx` 등의 코드를 구분해야 한다

## 결정

화면 문구는 아래 순서로 정한다. `shared/api/`에 `getErrorMessage(error, fallback?)` 하나를 두고 모든 화면이 이 함수를 쓴다.

1. **FE 매핑 테이블** — `code`가 매핑에 있으면 FE 문구를 쓴다. 개별 채택·현행 구현 코드를 우선한다: 응모 `ENTRY-001`~`010`, 미션 `MISSION-001`~`006`, 보유 부족 `TICKET-006`, 빈도 제한 `COMMON-006`, 사용자 문맥 `USER-002`~`006` 등. 나머지는 각 도메인 명세를 따른다. `INSUFFICIENT_TICKETS`·`RATE_LIMIT_EXCEEDED`·`IDEMPOTENCY_CONFLICT` 같은 제안 이름·상수 이름을 실제 오류 코드로 가정하지 않는다
2. **서버 `message`** — 매핑에 없는 `ApiError`는 서버 문구를 쓴다. 단, 공개 문구 계약이 적용되는 응답에 한한다 (아래 "서버 문구 사용 조건")
3. **기본 문구** — `ApiError`가 아닌 오류(네트워크·타임아웃·봉투 없는 5xx)는 호출부 `fallback` 또는 공통 기본 문구를 쓴다

서버 문구 사용 조건:

- 근거 계약: spec 공통 계약(`../getddo-spec/05-api/common.md` "오류")은 업무 오류의 공개 메시지를 담당자가 정의하고, 탐지 수치·내부 어뷰징 근거·예외 원문을 사용자 오류에 넣지 않는다고 정한다. FE는 이 계약이 적용되는 응답의 `message`만 사용자 문구로 신뢰한다
- 계약이 적용되지 않는 응답은 2단계를 건너뛰고 기본 문구를 쓴다 — `5xx` 전체, `COMMON-001`, MVC 표준 예외 처리가 만드는 `HTTP-{상태}` 코드(공개용으로 정의된 문구가 아니다)
- 2단계를 건너뛰어도 순서는 같다: `code`가 FE 매핑에 있으면 5xx라도 FE 문구를 쓰고, 매핑에 없으면 서버 문구 대신 기본 문구를 쓴다. 기본 문구가 FE 매핑보다 앞서는 예외는 없다
- 공통 계약이 확정될 때 이 공개 문구 조항이 빠지거나 바뀌면, 2단계를 없애고 매핑에 없는 코드는 모두 기본 문구로 처리하도록 이 ADR을 갱신한다

추가 규칙:

- `429 COMMON-006`(`RATE_LIMIT_EXCEEDED`)은 `Retry-After`를 `ApiError`에 담아 문구에 대기 시간을 표시할 수 있게 한다. 현재 값은 사용자별 1분 고정 창의 남은 초이며 CORS로 노출한다(`05-api/common.md`)
- 화면별 분기(예: 잔액 부족 시 전용 다이얼로그)는 문구가 아닌 `error.code`로 판단한다. 문구 문자열을 비교하지 않는다
- 매핑 테이블은 도메인을 모르는 `shared`에 두되, 값은 코드→문구 데이터일 뿐이다. 도메인별 화면 처리(다이얼로그 전환 등)는 각 feature에 둔다

## 결과

- 오류 코드가 확정되기 전에도 화면이 깨지지 않는다 — 모르는 업무 오류 코드는 서버 공개 문구, 그 밖의 오류는 기본 문구로 떨어진다
- 개별 계약이 확정·현행 구현으로 정리되면 매핑 테이블에 행을 추가한다. GD-199 PR 대조의 `PUBLICATION-002`는 최초·재추첨 준비 거절 모두에 재사용되므로 메시지의 재추첨 표현으로 실행 종류를 판정하지 않는다(`05-api/drawing.md`, PR 병합 후 적용 예정)
- 후속 작업(GD-124에서 처리): `shared/api/errorMessage.ts`에 `getErrorMessage` 추가, 기존 `error instanceof ApiError ? error.message` 4곳(`EventActionDialog`, `QuizForm`, `SurveyForm`, `AdminEventFormPage`) 교체, 인터셉터에서 `Retry-After`를 `ApiError.retryAfterSeconds`로 보존
