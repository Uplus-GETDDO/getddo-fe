# GD-263 통합 인수 잔여 실측 보고서

## Execution Metadata

- **Skill:** executing-plans + verification-before-completion + common-reporting-guide
- **Target:** getddo-fe 배포(`https://getddo-fe.vercel.app`) → CloudFront 실서버
- **Executor:** Devin (test/GD-263 워크트리)
- **Environment:** prod 배포 대상 읽기 전용 실측
- **Executed At:** 2026-10-22 (측정 시각 02:51~02:53 UTC)
- **배포 버전 근거:** 엔트리 청크 `assets/index-BvgTONd-.js` (GET / 200)

## Objective

L6 통합 인수 미검증 잔여 중 읽기로 확인 가능한 항목의 실측: GD-282 배포 후
실측 3건(AM05·AP05·AP06·ENDED), AM04 집계, GD-268 마감+1분 배포 여부,
AR01/AR02·INACTIVE·추첨 실패 재개의 사유 기록.

## Verification Criteria

| Criterion                      | Method                                                                  | Expected                              | Actual                                                                  | Pass          |
| ------------------------------ | ----------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- | ------------- |
| AM04 설문 집계                 | GET `/admin/missions/{id}/survey-summary?from=2026-10-16&to=2026-10-22` | 200·`SUCCESS`·Zod·응답 5건(BE 대조값) | 200·`SUCCESS`·zod pass·`dailyTotal=5`, 선택지 합계 5                    | ✅            |
| AM05 서술 답변 (09 설문)       | GET `.../survey-answers?questionId=…&from&to&page=1&size=20`            | 200·`SUCCESS`·Zod·3건(BE 대조값)      | 200·`SUCCESS`·zod pass·`totalElements=3`                                | ✅            |
| AM05 서술 답변 (07 설문, 대체) | 동일 경로, 대체 missionId/questionId                                    | 200·2건(BE 대조값)                    | 200·`SUCCESS`·zod pass·`totalElements=2`                                | ✅            |
| 미션 ENDED 반영                | GET `/admin/missions`(+`status=ENDED` 필터)                             | 종료 시각 경과 미션이 `ENDED`         | 과거 종료 미션 4건 전부 `ENDED`, 필터 total=4, `pastEndStillActive=0`   | ✅            |
| GD-268 +1분                    | 이벤트별 `drawScheduledAt - endsAt`                                     | +60초면 배포 반영                     | 최신 15건 전부 `deltaSeconds=60` (+300초 0건)                           | ✅            |
| AP05·AP06                      | 조회 현황 확인 후 쓰기 승인 제안                                        | 현황 확보                             | AP01 3건·AP03 2건 조회, 쓰기 미실행                                     | 아래 참조     |
| AR01/AR02                      | GET `/admin/abuse-cases`                                                | 404면 미배포로 기록                   | 404 `HTTP-404` — 미배포 유지                                            | ✅(사유 기록) |
| INACTIVE 계정                  | GET `/admin/users?status=INACTIVE`                                      | 표본 존재 여부                        | `totalElements=0` — 표본 없음                                           | ✅(사유 기록) |
| 추첨 실패 재개                 | —                                                                       | —                                     | 실패 실행 부재로 실측 불가 — 사유만 기록                                | —             |
| 자정/월 경계 적용 관측         | —                                                                       | —                                     | 관측 시점 도달 전 — 사유만 기록. 단 다음 자정 적용 대상 정책(아래) 존재 | —             |

## Procedure

1. `scripts/verifyL6RemainingReads.mjs`를 작성해 읽기 전용(GET 고정)으로 실행.
   `L6_DEPLOY_URL=https://getddo-fe.vercel.app`로 대상을 명시해 기본값 오실행 방지.
2. 실제 FE 소스의 Zod 스키마(`envelopeSchema`, `pageSchema`, `surveySummarySchema`,
   `surveyFreeTextAnswerSchema`, `adminMissionSummarySchema`, `dailyAttendancePolicySchema`,
   `streakPolicySetSchema`, `adminUserSchema`, `adminEventSchema`)를 트랜스파일 로딩해 검증.
3. 답변 원문·사용자 식별자는 증거에 기록하지 않는다 — `answerText`는 길이만,
   `createdBy` 등 식별자는 제외하고 `hasCreatedByName` 여부만 기록.

## Findings

### 확정된 결과

- **AM04 실측 일치** — 일별 응답 합계 5건(10-16:2, 10-19:1, 10-20:1, 10-21:1), 선택지
  합계 5건(커피 쿠폰 5·나머지 0). 응답 없는 날짜도 `count:0`으로 포함(계약 일치).
  BE 대조값 5건과 실측 일치.
- **AM05 실측 일치** — 09 설문 `totalElements=3`(대조값 일치), 대체 07 설문
  `totalElements=2`(대조값 일치). 익명 계약 확인 — 응답 항목이 `answerText`·
  `submittedAt` 두 필드뿐이며 사용자·제출 식별자가 없다.
- **ENDED 반영 확인** — 종료 시각이 지난 미션 4건이 전부 `ENDED`, `status=ENDED`
  필터 totalElements=4와 정합. 관측 창(실행 시점 ±3분) 내 신규 종료 미션이 없어
  전환 지연(최대 약 1분)의 실시간 관측은 못 했으나 저장 상태 반영 자체는 확인됐다.
- **GD-268 배포 반영 확인** — 최근 15개 이벤트 전부 `drawScheduledAt - endsAt = 60초`.
  과거 생성분(10-16 데모·10-21 실측 이벤트)도 60초로 계산되어 내려오므로 +1분
  기준이 배포에 반영됐다고 판정한다. "마감+5분" 기록은 변경 전 관측으로 폐기.
- **ADR-028 미배포 확인** — AM01·AP01·AP03 응답에 `createdByName` 필드 자체가
  없다(Zod `.nullish()`로 통과). "BE 구현·배포 전" 표기와 일치한다.

### 관측된 데이터 정황 (판단 보류 — BE 확인 대상)

- AP01에 2026-10-22 00:06 UTC 생성된 일일 정책 `01a160ee`(적용 시작 2026-10-22
  15:00 UTC = KST 10-23 00:00, `rewardTicketCount=1`)가 있다. 이전 `[TEST-GD261]`
  다음 자정 정책(`01a15a5e-b2eb`)은 `effectiveUntil=2026-10-22T15:00Z`로 마감 처리되어
  있어 윤태형 회신의 "원복"이 새 정책 생성으로 이뤄졌을 가능성이 있다.
- AP03 `01a15a5e-b40a`(2026-11)는 `[TEST-GD261]` 생성분이 잔존하며 단계 값(7→1,
  14→3, 28→7)이 2026-10 운영 묶음과 동일하다 — 원복 후 그대로 남은 상태로 보인다.
- `[TEST-GD261]` 이벤트 2건·미션 `01a15a5e-b4e5`는 여전히 존재 — BE 정리 확인 중이므로
  회신 대기로 기록.

## AP05·AP06 승인 제안 (미실행 — 승인 대기)

윤태형 원복 정책 2건은 수정 금지 대상이다. 조회로 확인한 현황 기준 제안이다.

| 케이스   | 대상 정책                                                                                   | 변경값                                          | 기대 응답            | 복구 방법                                                      |
| -------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------- | -------------------------------------------------------------- |
| AP05 409 | `01a15a5e-b2eb-7ad7-8731-b34bf0e7f0b7` (적용 중, ~10-23 00:00 KST까지)                      | `{"rewardTicketCount":1}` (현행과 동일)         | 409 `ATTENDANCE-007` | 거절이면 변경 없음. 만약 200이면 즉시 동일 값 재PUT 후 보고    |
| AP05 200 | 대안 A(추천): BE에 `[TEST-]` 격리 일일 정책 1건 생성 요청 후 그 정책에 PUT                  | `{"rewardTicketCount":2}` → 다시 `1`로 PUT 원복 | 200                  | 최종 PUT으로 원래 값 복귀                                      |
| AP05 200 | 대안 B: `01a160ee-963a-7845-8ecc-a409c5677522`(미시작, 윤태형 원복 추정)에 현행 동일 값 PUT | `{"rewardTicketCount":1}`                       | 200·변경 없음        | 값 동일이라 실질 변경 없음 — 단 윤태형 데이터라 별도 승인 필요 |
| AP06 409 | `01a143a8-b6de-7f01-b74f-404fee12074c` (2026-10 적용 중)                                    | 현행과 동일 `milestones`                        | 409 `ATTENDANCE-007` | 거절이면 변경 없음                                             |
| AP06 200 | 대안 A(추천): BE에 격리 연속 정책 생성 요청 후 PUT                                          | `milestones` 수정 → 원복 PUT                    | 200                  | 최종 PUT으로 원래 값 복귀                                      |

- 200 케이스는 미시작 정책이 필요한데, 현재 미시작 정책은 윤태형 원복 데이터뿐이고
  검증용 정책 신규 생성도 금지됐다 — **BE 격리 데이터 제공(대안 A)을 추천**한다.
- 409 케이스도 PUT이라 쓰기 요청이다 — 승인 후에만 실행한다.
- 예약 취소(삭제)는 계약상 제공되지 않는다.

## backend-integration-status.md 갱신안 (파일 미수정 — 병렬 세션 충돌 방지)

말미 "통합 인수 잔여 실측" 절의 **미검증 잔여** 목록을 아래로 교체한다:

- ~~AM04 설문 집계 실측(데이터 확보·실행만 남음)~~ → 2026-10-22 실측 완료(본 보고서).
- ~~GD-268 +1분의 배포 반영~~ → 배포 반영 확인(15건 전부 `drawScheduledAt-endsAt=60초`).
- ~~GD-282 배포 후 실측 3건~~ → AM05(200·3건/2건 일치)·ENDED 반영 해소, AP05·AP06은
  쓰기 승인 대기(대상·복구안 위 표).
- AR01/AR02 → `404 재확인(2026-10-22)`으로 기록값 갱신.
- `[TEST-GD261]` 잔여 데이터 → "출석 정책 2건은 10-22 원복 완료로 해소(사용자 편집
  반영), 이벤트 2건·미션은 BE 정리 확인 중"으로 갱신 — 조회로 잔존 확인됨.
- INACTIVE(DB 0건)·추첨 실패 재개(실패 실행 부재)·자정/월 경계(관측 시점 전)는 유지.

"GD-269~271 → GD-282 … 배포 후 실측 잔여" 행은 "AM05·ENDED 실측 완료, AP05·AP06
승인 대기"로 갱신한다.

## Actions Taken

- 읽기 전용 GET 33건(추정) — 쓰기 0건. 운영 데이터 변경 없음.
- `scripts/verifyL6RemainingReads.mjs` 신규(읽기 전용 측정 스크립트),
  `reports/20261022-GD-263-remaining-reads.json` 증거 생성.

## Rollback Plan

- 산출물은 워크트리 `test/GD-263`의 신규 파일뿐 — 되돌릴 운영 변경이 없다.
- 산출물 자체를 폐기하려면 브랜치 삭제로 충분하다(`git branch -D test/GD-263` +
  `git worktree remove .claude-worktrees/test-gd-263`).

## Artifacts

- `reports/20261022-GD-263-remaining-reads.json` — 호출별 메서드·경로·HTTP·봉투·
  Zod·시각·정제 필드 (10 checks)
- `scripts/verifyL6RemainingReads.mjs` — 재현용 읽기 전용 측정 스크립트
- 본 보고서 `reports/20261022-GD-263-remaining-measurement.md`

## 미실측 항목과 사유

- 추첨 실패 재개 `resume`: 실패 실행 부재(기존 probe·이번 목록에 FAILED 없음)
- AR01/AR02: 서버 404 유지 — 배포 후 재실측 필요
- INACTIVE: `totalElements=0` — 계정 입력 없이 동작 검증 불가
- 자정/월 경계 적용 관측: 다음 자정(10-23 00:00 KST) 적용 정책 `01a160ee`가 있어
  그 시점 이후 `effectiveFrom` 적용 확인으로 관측 가능 — 이 세션에서는 기다리지 않음
- `[TEST-GD261]` 이벤트·미션 정리: BE 확인 중 — 회신 대기

## Sign-off

- Agent 실행·측정·초안 작성. AP05·AP06 쓰기 실측과 `[TEST-GD261]` 정리는 사용자·BE 승인 대기.
