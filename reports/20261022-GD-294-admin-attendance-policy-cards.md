# GD-294 — 관리자 출석 정책 화면 현재·예약 카드 재편 결과 보고서

## 결과

`/admin/attendance-policies`의 최신순 20건 이력 목록을 제거하고, 일일·연속 두 섹션을
"현재 정책 카드 + 예약된 변경 영역 + 수동 새로 조회" 구조로 재편했다. 브랜치 `feat/GD-294`
(`origin/dev` 기반). Jira 완료 조건 4항 전부 충족 — 증거는 아래 검증 절.

## 변경 범위

| 파일                                                                      | 변경                                                                      |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/pages/admin/attendancePolicies/utils/policySelection.ts`             | 신규 — 현재·예약 파생 선택자 (순수 함수, `now`/`kstMonth` 인자)           |
| `src/pages/admin/attendancePolicies/utils/policySelection.test.ts`        | 신규 — 경계·정렬 무의존 테스트 13건                                       |
| `src/pages/admin/attendancePolicies/ui/AttendancePolicySection.tsx`       | 신규 — 일일·연속 공용 섹션 (카드+예약 영역+새로 조회)                     |
| `src/pages/admin/attendancePolicies/ui/AttendancePolicySummary.tsx`       | 신규 — kind별 정책 요약 렌더러                                            |
| `src/pages/admin/attendancePolicies/AdminAttendancePoliciesPage.tsx`      | 재작성 — `PagedResult`·페이지 상태 제거, `page=1` 고정 조회 + 선택자 파생 |
| `src/pages/admin/attendancePolicies/AdminAttendancePoliciesPage.test.tsx` | 재작성 — 카드/분기/오류 계약 테스트 7건                                   |
| `src/features/manageAttendancePolicy/ui/AttendancePolicyForm.tsx`         | 중복 예약·성공 안내 문구를 "예약된 변경" 지칭으로 조정                    |
| `src/features/manageAttendancePolicy/ui/AttendancePolicyEditDialog.tsx`   | ATTENDANCE-007 안내를 티켓 고정 원문으로 교체                             |

승인 범위(`src/pages/admin/attendancePolicies/*` + `src/features/manageAttendancePolicy/*`) 외
파일은 변경하지 않았다. API 계약(AP01~AP06)·의존성·라우트 변경 없음.

## 판정 규칙 구현

- 일일: `effectiveFrom <= useVirtualClock().now()` argmax → 현재, `> now` argmin → 예약
- 연속: `effectiveMonth <= kstMonth`(KST 기준월) argmax → 현재, `>` argmin → 예약
- 경계 `<=` 포함 — 서버 ATTENDANCE-007 판정 기준과 일치. 목록 정렬 순서 비의존, 입력 배열 비파괴.
- 예약은 계약상 최대 1건 — 미래 행이 여러 건이어도 가장 가까운 1건만 표시(방어적 argmin).
- 판정은 표시용 사전 판정 — 최종 판단은 서버(409)가 한다.

## 오류·안내 문구 계약

| 코드                           | 화면 문구                                                         | 위치                         |
| ------------------------------ | ----------------------------------------------------------------- | ---------------------------- |
| ATTENDANCE-007 (시작 후 수정)  | "이미 적용이 시작된 정책입니다. 목록을 새로고침해 주세요"         | `AttendancePolicyEditDialog` |
| ATTENDANCE-004/005 (중복 예약) | "이미 예약된 정책이 있습니다. 예약된 변경에서 수정해 주세요."     | `AttendancePolicyForm`       |
| 예약 성공                      | "예약했습니다. 적용일·기준월은 예약된 변경에서 확인해 주세요."    | `AttendancePolicyForm`       |
| 예약 없음 안내                 | "예약된 변경이 없습니다. 예약하지 않으면 기존 정책이 유지됩니다." | `AttendancePolicySection`    |
| 현재 없음                      | "적용 중인 정책이 없습니다."                                      | `AttendancePolicySection`    |

- "예약 수정 API는 제공되지 않습니다"류 문구: `src` 전체 grep 결과 잔존 없음 — 확인 완료.
- `src/shared/api/errorMessage.ts`의 ATTENDANCE-007 공통 매핑은 승인 범위 밖이라 미수정 —
  다이얼로그의 override가 우선 표시되므로 화면 문구는 계약 원문 그대로다.

## 검증 증거 (base tip 5f22b38)

| 명령                   | 결과                                                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check` | exit 0 — All matched files use Prettier code style                                                                      |
| `npm run lint`         | exit 0 — 경고 0 (`--max-warnings=0`)                                                                                    |
| `npm run test:ci`      | exit 0 — 868 tests passed                                                                                               |
| `npm run build`        | exit 0 — tsc -b + vite build                                                                                            |
| `git diff --check`     | exit 0                                                                                                                  |
| 선택자 단위 테스트     | 13건 green — 정각 경계(`==`→현재), 월초 경계, 빈 목록, 전부 미래, 미래 다건 argmin, 순서 무관·입력 비파괴, 연도 넘김    |
| 페이지 테스트          | 7건 green — 카드 표시, 예약 유무 전환(폼↔수정), 007·004 안내, 로딩·오류 상태, 현재 없음, 이력·페이지네이션·총 건수 부재 |

실행 과정: 3 tasks/2 waves (T1 선택자+T2 문구 병렬 → T3 페이지). T1은 merge 전 독립
spec-review 통과, 전체는 최종 리뷰 approved (blocking 0).

## 미수 적용·알림

- **리뷰 advisory 처분**: ① refetch 실패 시 캐시 데이터 있으면 alert+카드 공존하도록 수정
  (데이터 없을 때만 상태 전용) ② 다시 시도 버튼 `disabled={isFetching}` 추가 ③ [수정] 버튼
  `aria-label`("일일/연속 예약 정책 수정")로 구분 ④ 테스트 월 경계 극소 플래키는 기존 패턴
  수준으로 수용.
- **자동 갱신 없음**: 경계(자정·월초) 통과 시 카드 라벨은 렌더 시점 `now` 파생이라 가상 시계
  오버라이드·refetch·수정 성공 시 전환된다. 자동 폴링은 승인 범위 밖이라 추가하지 않음 —
  수동 "새로 조회" 모델 유지.
- **브라우저 수동 확인 미실시**: 페이지 테스트(MSW)로 대체 — 실기기 확인은 PR 리뷰에서 판단.
- **`feat/GD-294`는 `origin/dev`보다 2커밋 뒤처짐** (병렬 세션 머지) — PR 머지 시점에
  GitHub이 충돌 여부를 판정한다.

## backend-integration-status 갱신안 (직접 수정은 병렬 세션 소유 — 여기만 기록)

- "관리자 출석 정책 조회" 항목에 "GD-294에서 이력 목록 → 현재·예약 카드로 재편, 조회는
  `page=1&size=20` 유지(예약 최대 1건이므로 첫 페이지에 현재·예약 포함)" 반영 가능.
