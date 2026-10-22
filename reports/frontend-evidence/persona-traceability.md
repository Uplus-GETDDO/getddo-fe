# 페르소나 추적표 — 니즈 → 화면 → 코드 → 검증

> 기준: `dev` @ `c8ba148` (2026-10-22 KST 조사). 페르소나 원본은 `docs/product-context.md`(기획 원문 발췌)와 `docs/assets/7dab1734-c9e7-4650-a96a-906c55388721.png`.
> 아래 '연결 근거'는 현재 코드와 커밋 이력에서 확인한 것이다. '페르소나 때문에 그렇게 결정했다'는 기획 인과관계가 커밋·PR에서 확인되지 않는 한 **미확인**으로 표시하고, "페르소나를 기준으로 현재 구현을 점검했다"로만 읽는다.

## 공통 과제 규약

- 시작점: 로그인된 홈(`/`) — 가상 사용자 선택·세션 확정은 과제 시간에서 제외하고, 브라우저 표본에는 `accountRole: USER`(익명)만 남긴다.
- 동작 계수: '동작 1회'는 한 번의 의도 있는 조작 — 클릭/탭 1회, 키보드 활성화(Enter/Space) 1회, 또는 단축키 없는 필드의 연속 키입력을 1개의 값 입력으로 본다. 스크롤·호버는 세지 않는다.
- 완료 시간: 사람이 수행하지 않은 자동 시나리오는 '자동 시나리오 실행 시간'으로만 표기한다.
- 종료 조건은 과제별로 고정한다 (아래 표).

## 정책 대조 결과 (이미지·기획 원문 vs 현재 정책)

| 항목                     | 이미지·원문                        | 현재 확정 정책                                                                                          | 화면 상태                                                                                                |
| ------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 출석·게임 초기화 시각    | "09:00 초기화" (이미지, 과거 내용) | 매일 00:00 KST (`getddo-spec/02-domain/attendance.md`)                                                  | `MissionListPage.tsx`는 "하루 1회 · 매일 자정 초기화", 게임 레일도 "매일 자정 초기화" — 현재 정책과 일치 |
| 추첨 제외·제외 사유 안내 | 이하늘 니즈에 '제외 사유' 언급     | ADR-018로 폐지 — 지급 전 차단 기록·관리자 조회로 전환                                                   | 응모 거절(`REJECTED`+`rejectionCode`)·낙첨(`LOST`)·미공개를 화면에서 구분 표시                           |
| 가중치·빠른 참여         | '가중치 적용 이벤트'에 몰입        | 장당 가중치(브론즈1·실버3·골드5·플래티넘10) 합산, 사용자당 최대 5장(ADR-010·014·025) — 선착순 우대 아님 | `GradeTicketSteppers`로 등급별 장수 선택, `remainingLimit` 안내                                          |
| 발표 절차                | 원문 '수동 추첨' 표현              | 마감+5분 자동 추첨 → 관리자 육안 검토 → 수동 최초 공개(ADR-022)                                         | 상태 라벨 '결과 발표 대기', 발표 후 결과 영역                                                            |

## 페르소나별 연결표

### 김도윤 — 데일리 루틴러

- 니즈: 오늘 완료/미완료 한눈에, 초기화 시각 명시, 일별 적립 이력 열람
- 화면·소스: `src/pages/missionList/MissionListPage.tsx` — `TodayRewardsBanner`(오늘의 적립·진행), `AttendanceCheckCard`+`attendanceResetCaption='하루 1회 · 매일 자정 초기화'`(`features/checkAttendance/ui/AttendanceCheckCard.tsx`), `TicketHistoryCard`, 게임 레일 `GameRail`(자정 초기화 캡션), `MissionBoard`
- 관련 검증 코드: `features/checkAttendance/api/queries.ts` — `busy` ref로 같은 틱 중복 전송 차단, `getPollingRetryDelay`로 429 대기 재클릭 차단, `minDurationMs` 굽기 연출 보장
- 연결 근거(커밋): `f397c34`(GD-269~271 홈 미션 카드 필터), `92583c3`(GD-259 정합성), `cc1ea7b`(GD-204 출석판 개편). 페르소나 인과 미확인 — 이미지의 09:00이 자정으로 정정된 것은 정책 추적이지 페르소나 때문으로 단정 불가
- 자동 검증: `features/checkAttendance/api/queries.test.tsx`(같은 틱 중복·429 재클릭 각 post 1회) — 존재·통과 (baseline `dup-attendance`)
- 사용자 과제: 홈 → 미션 페이지 진입 → 오늘 출석 여부 확인 → 출석 → 잔액 반영 확인. 종료: 출석 영수증 반영·잔액 갱신 표시. 동작: 진입 1 + 출석 1 = 2. 지표: 동작 수, 완료 시간, 피드백 지연, 자정 경계 정합성
- 실사용 검증: 없음 (사람 과제 수행 기록 없음)

### 박서연 — 타임어택 헌터

- 니즈: 모집 시작 시각 고지, '응모하기' 즉각 피드백, 사용한 응모권 수·실시간 현황, 반복 클릭의 중복 차감 방지
- 화면·소스: `src/pages/timeRaffleDetail/TimeRaffleDetailPage.tsx` — 자격(E07)·내 응모(E06)·잔액(T01)·남은 한도 표시, `useEnterEvent`(`features/enterEvent/api/queries.ts`), `queryPresets.realtime`(30초 폴링, `shared/api/queryPresets.ts`), 확인·완료·부족 모달(`widgets/eventEntry`)
- 관련 검증 코드: `useEnterEvent`의 `attemptRef` — 같은 장수 맵의 재시도는 멱등키 유지, 접수 성공·4xx 응답 수신·맵 변경 시 새 키(ADR-0005), `IDEMPOTENCY_HEADER`(`shared/utils/idempotencyKey.ts`), 성공 시 잔액·자격·응모 캐시 동시 무효화 후 완료 모달
- 연결 근거(커밋): `948256c`(GD-257 게임·보상 실연동 맥락), `92583c3`(GD-259 정합성), `25268db`(GD-267 E06 실내역 표시). 페르소나 인과 미확인
- 자동 검증: 훅 수준 멱등키 수명 테스트는 이번에 `features/enterEvent/api/queries.test.tsx`로 신규 추가 (baseline `dup-enter-event`); 페이지 수준 E07·모달 흐름은 `TimeRaffleDetailPage.test.tsx`로 존재
- 사용자 과제: 진행 중 가중치 이벤트 상세 진입 → 장수 선택 → 응모 접수. 종료: 완료 모달의 잔액·한도 반영. 동작: 진입 1 + 장수 입력 1 + 확인 1 + 접수 1 = 4. 지표: 클릭 피드백, 응답 시간, 잔액 반영, 같은 의도 재전송의 중복 차감 수
- 실사용 검증: 없음

### 이하늘 — 신뢰중시 확인러

- 니즈: 지급·차감 이력의 사유·시각·관련 행위, 거절/낙첨/미공개 구분, 추첨 절차의 검증 가능한 설명
- 화면·소스: `src/pages/myTickets/MyTicketsPage.tsx`(지갑·월 합계·만료 예정·`useTicketHistoryCounts`), `src/pages/myEntries/MyEntriesPage.tsx`(`useMyEntryRows`로 이벤트 단위 묶음), `entities/ticket/api/history.ts`(커서 더보기·스트림 병합), `entities/drawResult/api/queries.ts`(E08 공개 결과·E09 본인 결과, 미공개 폴링·종료 상태 정지), `entities/event/model/eventStatus.ts`(`isFinalEventStatus`)
- 관련 검증 코드: `rowPolling.test.tsx`의 표시 행 갱신·종료 상태 정지, 거절 행 제외(`results`에 `rejected` 미포함), `myResult`의 `NOT_ENTERED`/`PENDING` 구분, 이벤트 취소 시 "차감한 응모권은 원래 등급으로 반환" 안내
- 연결 근거(커밋): `923b07c`(GD-246 이력 커서 전환), `a49796a`(GD-247 행별 폴링·종료 조건), `ca3347e`(GD-281 이벤트 단위 묶음·당첨 건수 중복 집계 수정), `c8ba148`(상세 안내 정정). 페르소나 인과 미확인 — 단, GD-281은 '집계가 어긋나는' 신뢰 문제를 직접 수정
- 자동 검증: `entities/ticket/api/history.test.tsx`(0/5/6/1000건 최초 1요청, 커서 중복·부분 실패·스트림 병합), `app/config/rowPolling.test.tsx`(85 누적·집계 유지), `entities/drawResult/api/queries.test.tsx` — 존재·통과 (baseline `req-ticket-history-*`, `req-my-entry-rows-90s`)
- 사용자 과제: 내 응모 내역에서 특정 거절/낙첨 건의 사유·수량 확인 → 결과 확인. 종료: 사유 표시 도달 + 결과 화면 도달. 동작: 내역 진입 1 + 행 확장·상세 1 + 결과 확인 1 = 3. 지표: 도달 동작 수, 이력 요청 수, 잘못된 결과 확정 수
- 실사용 검증: 없음

### 최민준 — 라이트 참여형

- 니즈: 응모권 없는 간단 참여, 한눈에 이해되는 방법·기간 안내, 배너 진입 동선
- 화면·소스: `src/widgets/bannerSlider/ui/BannerSlider.tsx`(B01 배너→연결 이벤트), `src/pages/eventDetail/EventDetailPage.tsx`(미사용 이벤트 상세·`useEnterEvent`), `entities/event/model/eventStatus.ts`·페이지 상태 라벨(마감/취소/종료 구분)
- 관련 검증 코드: 미사용 이벤트(`NO_TICKET`)는 `requestedTickets={}`·사용자당 1회, 자격 사유별 버튼 문구(`readEligibility`), `STATUS_LABEL`로 비응모 상태 명시
- 연결 근거(커밋): `c8ba148`(이벤트 상세 안내·대표 이미지 노출), `92583c3`(GD-259 정합성), `2ff5718`(GD-258 사용자 화면 개선). 페르소나 인과 미확인
- 자동 검증: `EventDetailPage.test.tsx` 존재 — 통과 여부는 `npm run test:ci` 전체 결과에 포함
- 사용자 과제: 홈 → 배너/목록에서 미사용 이벤트 발견 → 상세 → 응모. 종료: 응모 접수 완료 안내. 동작: 배너 클릭 1 + 응모 1 + 확인 1 = 3. 지표: 동작 수·완료율·첫 화면 로딩·마감 상태 이해
- 실사용 검증: 없음

## 미연결·한계

- 페르소나 4명은 가상 인물이다 — 사용성 개선 효과 주장에는 사람의 과제 수행 기록이 별도로 필요하며 이번 기준선에는 없다.
- 네 과제 모두 '로그인된 홈' 시작점 기준의 자동 계수만 정했다. 실브라우저 측정은 Playwright 설치본 범위에서 시도하고, 불가하면 `not-measured`로 남긴다.
