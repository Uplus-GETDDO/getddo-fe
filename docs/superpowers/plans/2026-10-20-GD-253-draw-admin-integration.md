# GD-253 관리자 추첨·발표 실연동 계획

- 상태: 구현 완료·실서버 기능 검증 대기 (2026-10-20 착수, feat/GD-253)
- 기준: `getddo-spec/05-api/drawing.md`(3cb9fcc 기준 병합·배포 반영), `notification.md`, `abuse.md`, `02-domain/drawing.md`, `00-requirements/pending-decisions.md`
- 목표: 관리자 추첨 조회·실패/실행 감사·최초 발표·취소/재개의 신계약 정합화 + 결과 알림 통합 검증 + 배포 `drawHandlers` 해제. AR01/AR02는 미배포·미확정이라 목업 유지(담당자 확인 항목).

## 계약 차이 → 변경 파일

| 항목           | 변경                                                                                                            | 파일                                                 |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| drawType       | `executionType`→`drawType`, 라벨 '최초 추첨/재추첨'                                                             | drawResult types·runStatus·DrawRunList·DrawRunDetail |
| execution 요약 | 최상위 failure·cancellations → `execution{failureCount,latestFailure,retryAt,waitingForOperator,cancellations}` | drawResult types·DrawRunDetail                       |
| 취소 근거      | `resultId`·`replacementRunId` 필드명                                                                            | cancellationSummarySchema                            |
| 공개 변경 이력 | reason·confirmedBy·confirmedAt nullable + `executions[]`                                                        | winner types·ResultChangesSection                    |
| 최초 발표      | `POST /admin/draws/{runId}/result-confirmation` 단일 호출                                                       | features/runDraw 훅+다이얼로그, DrawRunDetail 게이팅 |
| 운영 이력      | `/failures`·`/execution-audits`                                                                                 | drawResult queries·운영 이력 섹션                    |
| 목업           | draw.ts 신계약 + 신규 핸들러·테스트                                                                             | mocks/handlers/draw.ts, draw.test.ts                 |

## 작업 순서

1. [x] entities/drawResult·winner 스키마 정합화 + index exports
2. [x] queries: useDrawFailures·useDrawExecutionAudits + 경로
3. [x] features/runDraw: useConfirmResult(result-confirmation) + 발표 다이얼로그, CancelWinDialog 202 의미
4. [x] pages/admin/draw UI: DrawRunList·DrawRunDetail(실패·재시도/대기 구분·취소 이력)·운영 이력 섹션·ResultChangesSection·PolicyPendingNotice 정리
5. [x] mocks/draw.ts 신계약 + draw.test.ts 갱신 (25개 통과)
6. [x] format:check·lint·test:ci(623)·build 전부 통과
7. [ ] 실서버 기능 표본(AD01/AD02 Zod 통과, failures·audits 실응답, result-confirmation 왕복) + 격리 이벤트 C1~C6 — 라우팅 실측(401/405·USER-002 vs /abuse-cases 404)은 완료, DTO 표본·시나리오는 BE 관리자 컨텍스트·시드 대기
8. [ ] 공개→알림→커서→읽음→결과 이동·시작 10분 전·일정 변경/취소 알림 확인 — C1 이벤트 필요
9. [x] hybridHandlers에서 drawHandlers 해제(abuseHandlers 유지) + 연동 현황·로드맵·보고서 갱신 — 해제 근거: 라우팅 실측 + 병합 계약 정합화. DTO 표본 검증이 남아 있어 7 완료 시 재확인한다

## 차단·담당자 확인 (병렬 진행, 차단 아님)

- AR01/AR02 배포·DTO 확정(A1~A8 목록은 대화에서 합의)
- PUBLICATION-002 최초 발표 문구 정렬
- DrawExecutionAudit action 값·beforeData/afterData 내용 형태
- 격리 시연 이벤트 상태 세트 C1~C6(미공개 확정, 취소 가능 당첨, FAILED 2형태, 취소, 응모자 없음, 응모자 소유 계정) — 확보되면 7·8을 수행한다
