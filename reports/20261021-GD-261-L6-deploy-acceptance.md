# GD-261 L6 배포 후 검증·통합 인수 보고서

기준: `dev` `f17056c`(GD-260 PR #111 스쿼시 머지). 배포 대상 `https://getddo-fe.vercel.app`.
검증 스크립트 `scripts/verifyL6Deployed.py` — 빌드·프록시 없이 배포 그대로 관측했다.
증거: [20261021-L6-deploy-evidence.json](20261021-L6-deploy-evidence.json), 스크린샷 [L6-deploy-evidence/](L6-deploy-evidence/).

## 배포 상태 확인 (배포 전 점검)

- `VITE_VIRTUAL_USERS_JSON` — Vercel에 이미 설정돼 배포 번들의 env 청크에 실제 등록 6계정(ADMIN 1·USER 5, UUID는 `.env.example` 예시와 일치, personaLabel 포함)이 구워져 있다. 값 설정 절차는 불필요했다.
- 배포 소스 — 배포 HTML의 콘텐츠 해시 청크(`AdminDrawPage-4DQSM_FF`, `vendor-Bc0DudgI` 등)가 로컬 dev `f17056c` 빌드와 전부 일치한다. `enableMsw:false`도 번들에 베이크돼 있다 — 프로덕션이 머지 후 dev 소스를 서빙한다(머지 시 자동 배포로 추정, 콘솔 미인증으로 배포 이력 조회는 하지 못했다).

## 배포 후 검증 결과 (2026-10-20 17:12 UTC 실행 — 증거 JSON `checkedAt` 기준, 34 checks·244 requests·pageerror 0)

| 항목                                                     | 결과                                                                                                                                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 신규 세션 Service Worker                                 | ✅ 등록 0건                                                                                                                                                                                        |
| 이전 목업 설치 재현 — `mockServiceWorker.js`만 자동 해제 | ✅ 실제 파일 등록 후 재진입 시 해제됐고, 같은 origin의 다른 module Worker(`env-*.js`로 재현)는 유지됐다                                                                                            |
| 로그인 계정 목록 = Vercel 설정                           | ✅ 번들 env의 6계정 전부 표시                                                                                                                                                                      |
| `/virtual-users` 호출                                    | ✅ 0건                                                                                                                                                                                             |
| 계정 선택→홈→이벤트 상세                                 | ✅ USER 헤더로 실서버 GET 200·실제 업무 ID (`/v1/events`, `/v1/events/{id}`, `/eligibility`, `/tickets/me` 등)                                                                                     |
| A→B 전환                                                 | ✅ B 헤더 재조회 19건, A 헤더 누수 0건                                                                                                                                                             |
| 새로고침 세션 유지                                       | ✅ 테스트사용자2 유지                                                                                                                                                                              |
| 가상 시계 비노출                                         | ✅ 헤더 0건, `/admin/virtual-clock` 404, 관리자 메뉴 0건                                                                                                                                           |
| 사용자 읽기 페이지 6곳                                   | ✅ `/my-tickets`·`/my-entries`(my-result 200 포함)·`/my-notifications`·`/events`·`/missions`·`/time-raffle` 전부 GET 200                                                                           |
| 관리자 읽기 페이지 11곳                                  | ✅ 대시보드·events·draw·users·entries·tickets·notifications·banners·attendance-policies·missions·virtual-users GET 200. `/admin/abuse-cases`만 실서버 404 — AR01/AR02 미확정의 의도된 미구현 표시  |
| 320/390px                                                | ✅ 가로 넘침 없음                                                                                                                                                                                  |
| 키보드 탭 순회                                           | ✅ A·BUTTON 포커스 도달                                                                                                                                                                            |
| 오프라인→재연결                                          | ✅ 오프라인 내비게이션 실패 관측 후 온라인 복귀 시 정상 렌더                                                                                                                                       |
| 200% 확대                                                | ✅ 실제 확대와 동등한 조건(뷰포트 640 CSS px·DPR 2, `innerWidth`·`devicePixelRatio` 실측)에서 `scrollWidth` 640 — 넘침 없음. 이전 `body.zoom` 근사 측정의 넘침은 CSS zoom 고유 동작의 artifact였다 |

요청 합계: 244건 = GET 200×242 + GET 404×2(`/admin/abuse-cases`, 의도된 미구현). non-GET 0건 — 데이터 쓰기는 실행하지 않았다.

## 쓰기 인수 (사용자 승인 범위 — 시연 계정 테스트사용자1 한정, 배포 프록시 `/api/v1` 경유)

증거: [20261021-L6-deploy-user-writes.json](20261021-L6-deploy-user-writes.json), [20261021-L6-deploy-games.json](20261021-L6-deploy-games.json), [20261021-L6-deploy-entry.json](20261021-L6-deploy-entry.json).

| 시나리오         | 결과                                                                                                                                                                                                     |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 출석(AT02)       | ✅ POST 201 → 같은 기준일 재요청 200 동일 영수증, 잔액 +1→+0                                                                                                                                             |
| 미션 QUIZ·SURVEY | ✅ 각 201 완료 + BRONZE 1장. 같은 멱등키 200 동일 결과, 완료 후 새 키는 같은 제출로 병합(보상 추가 0)                                                                                                    |
| 게임 4종         | ✅ COLOR_WORD 50→SILVER, TAKKO_ORDER 18→BRONZE, TAKKO_RUN 435→BRONZE, TAKKO_TIMING 50→BRONZE — 전부 VALID·FE 계산 점수 일치·통계+지갑+이력 반영. 중복 제출 200 동일 결과. ADMIN 통계·제출 403 `GAME-007` |
| 응모 접수·멱등   | ✅ `[DEMO-20261016] 06 예정 응모권 이벤트` BRONZE 1장 201 ACCEPTED. 같은 멱등키 재시도 200 동일 영수증                                                                                                   |
| 새 키 재응모     | ✅ 201 ACCEPTED — 계약상 상한 내 별도 응모로 접수됨(`usedTicketCount` 2, 상한 추적 정상). 거절이 아님이 계약과 일치                                                                                      |
| 등급별 응모      | ✅ SILVER 1장 201 ACCEPTED, 잔액 −1                                                                                                                                                                      |
| 잔액 부족 거절   | ✅ PLATINUM 1장 → 409 `TICKET-006`, 잔액 변동 0                                                                                                                                                          |
| 마감·미오픈 거절 | ✅ `EVENT_NOT_OPEN` 이벤트 응모 → 409 `ENTRY-005`, 잔액 변동 0                                                                                                                                           |

## 통합 인수 잔여 실측 (2차 — 격리 데이터 생성 포함, 사용자 승인)

증거: [20261021-L6-deploy-remaining-probe.json](20261021-L6-deploy-remaining-probe.json), [-entries.json](20261021-L6-deploy-remaining-entries.json), [-draw.json](20261021-L6-deploy-remaining-draw.json), [-banner.json](20261021-L6-deploy-remaining-banner.json), [-admin.json](20261021-L6-deploy-remaining-admin.json), [-misc.json](20261021-L6-deploy-remaining-misc.json). 격리 데이터는 `[TEST-GD261]` 접두사로 생성했다.

스크립트가 생성하지 않은 수동 인라인 실행분은 각 JSON의 `source`/`provenance` 필드에 표시돼 있다 — 대상: draw의 '발표 재시도·최종 상태', entries의 'TICKET_LIMIT_EXCEEDED 거절', probe의 '기존 추첨 실행·재추첨 상세', banner 전 check, admin의 `createdStatus`/`createdData`(개정 전 스크립트가 성공 생성을 실행했다 — 현 스크립트는 재현하지 않는다).

| 시나리오                             | 결과                                                                                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 서버 마감→자동 추첨                  | ✅ 격리 이벤트 마감 17:31:30 → `drawScheduledAt` +5분에 INITIAL 실행 자동 생성(17:36:37)·CONFIRMED. 감사 `DRAW_EXECUTE` actorId=null(자동)                                                     |
| 관리자 검토                          | ✅ AD01~AD03 실행·결과·후보(1명·1장·가중치1), AD04 `checks` 201·5개 항목 전부 `passed:true`                                                                                                    |
| 발표·마스킹                          | ✅ `result-confirmation` 200 → 이벤트 PUBLISHED, E08 `maskedName:"테*****1"`, E09 `WON`+경품. 최초 호출은 409 `DRAW-005`(검증 직후 타이밍) → 재시도 성공                                       |
| 알림                                 | ✅ `RESULT_PUBLISHED` 잡 COMPLETED(1회), 사용자 알림 "추첨 결과 발표" 1초 후 도착·`linkUrl` 연결                                                                                               |
| 이벤트 취소→원래 등급 반환→이력 일치 | ✅ 격리 이벤트(응모 1건) 취소 → `refundedTicketCount:1`, BRONZE 잔액 복원(1→2), AO08 반환 이력 `EVENT_CANCELED`·등급 일치, 사용자·관리자 이력 일치, 응모 이력 있는 이벤트 삭제 409 `EVENT-013` |
| `ALREADY_ENTERED`·상한 거절          | ✅ 재응모 409 `ENTRY-006`, 상한 초과 요청 409 `ENTRY-007`(잔액 변동 0)                                                                                                                         |
| 당첨 취소·재추첨(AD05·AD09)          | ✅ 기존 데모 이벤트로 확인 — INITIAL CONFIRMED 후 관리자 취소 → REPLACEMENT 실행 CONFIRMED·재발표(revision 2)·`RESULT_CHANGED` 잡                                                              |
| L3 배너 CRUD                         | ✅ AB02 등록 201 → AB03 수정 200 → B01 사용자 목록 반영 → AB05 순서 200 → AB04 삭제 200 → 원본 복원. 5개 상한 상태에서는 등록 거절                                                             |
| L5 관리자 쓰기                       | ✅ AP02 201(현재와 동일 수량)+중복 409 `ATTENDANCE-004`, AP04 201(2026-11)+단계 오류 400 `ATTENDANCE-003`, AM03 미션 201+수량 오류 400 `MISSION-001`                                           |
| 429 Retry-After                      | ✅ 실발동 — `POST /attendances` 40회 버스트 → 200×5 + 429×35, `Retry-After: 60`                                                                                                                |
| p95                                  | ✅ 측정 — `GET /tickets/me` p95 113ms·`GET /events` p95 117ms (클라이언트 관측·네트워크 왕복 포함, n=30)                                                                                       |
| USER-006 확인                        | ✅ 관리자 요청에 `X-User-Membership`을 보내면 DB 멤버십 불일치 409 — 관리자 경로는 멤버십 헤더 생략이 정상                                                                                     |

## 상태 구분

| 단계         | 상태                                                                                                                           |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| 구현         | ✅ 완료 (GD-260, PR #111)                                                                                                      |
| 머지         | ✅ 완료 (dev `f17056c` 스쿼시 머지)                                                                                            |
| 배포         | ✅ 완료 (프로덕션이 머지 후 dev 소스+실계정 env로 서빙 중)                                                                     |
| 배포 후 검증 | ✅ 완료 (위 17개 항목 전부 실측)                                                                                               |
| 통합 인수    | ⏳ 대부분 완료 — 읽기·사용자 쓰기·관리자 쓰기·추첨~발표 전 과정·취소 반환·429·p95 실측. 외부 입력 대기·계약 미확정 잔여가 있다 |

## 통합 인수 잔여 (미검증 — 완료로 표시하지 않는다)

| 항목                            | 차단 요인                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| INACTIVE 계정 동작              | DB에 INACTIVE 사용자 0건(AO01 실측)·설정 6계정에도 없음 — 계정 입력 또는 비활성화 수단 필요                                          |
| AR01/AR02 어뷰징                | `/admin/abuse-cases` 여전히 404 — 계약·서버 구현 대기                                                                                |
| 추첨 실패 재개                  | 실패한 실행이 없어 `resume` 경로 미실행 — 장애 주입 환경 필요                                                                        |
| AG01~AG03 관리자 게임·보상 조건 | 상세 계약 미확정·FE 미구현 — 담당자 확정 또는 범위 조정 결정 필요                                                                    |
| AM04 설문 집계                  | 실측 미실행 — 정확한 미션 UUID·날짜 범위 확인 필요                                                                                   |
| 자정/월 경계 정책 적용          | 생성은 실측했지만 실제 적용 시점(다음 자정·다음 달) 관측은 서버 일정 대기                                                            |
| 번들 최적화                     | 사용자 번들 크기·조회 반복·중복 코드는 미측정 — 로드맵 체크리스트 항목으로 유지                                                      |
| 잔여 시연 데이터                | `[TEST-GD261]` 이벤트 2건(PUBLISHED·CANCELED)·미션 1건·다음 자정 일일 출석 정책·2026-11 연속 출석 정책 — 삭제 API 부재로 운영에 잔존 |
