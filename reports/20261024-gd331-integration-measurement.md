# GD-331 통합 측정 보고서 — AP06 200 실측·알림 관측 (2026-10-24)

배포본(`https://getddo-fe.vercel.app`, 엔트리 청크 `index-DRCSlZyx.js` 최신성 확인)에서 사용자 승인 쓰기 3건과 읽기 관측을 수행했다. 증거 JSON에는 실서버 식별자·닉네임·사유 원문을 기록하지 않았다.

## 쓰기 인수 (승인 3건, 모두 소진)

| 순서 | 작업      | 경로                                                            | 결과 |
| ---- | --------- | --------------------------------------------------------------- | ---- |
| 1    | AP06 수정 | `PUT /v1/admin/policies/attendance/streak/{id}` — 28일 보상 7→8 | 200  |
| 2    | AP06 원복 | 동일 — 8→7                                                      | 200  |
| 3    | N02 읽음  | `PUT /v1/notifications/{id}/read` — 미읽음 1건 클릭             | 200  |

그 외 요청은 전부 GET이며, 알림 생성 트리거(추첨·발표)는 일으키지 않았다.

## AP06 — 예약 연속 정책 수정 200

- 대상: `effectiveMonth=2026-11` 연속 정책 묶음, 마일스톤 `(7일→1장, 14일→3장, 28일→7장)`.
- 경로: 관리자 출석 정책 화면 '예약된 변경' 카드 → 수정 다이얼로그 → '3단계 보상 장수' 입력.
- 결과: 두 PUT 모두 200, `{success:true, code:SUCCESS, message}` 봉투와 `effectiveMonth`·`milestones(milestoneDays·rewardTicketCount)` 값·`id`/`createdByName`/`createdAt` 존재를 대조했다. `effectiveMonth`·마일스톤 구성(일수·보상·개수)은 원복 후 GET 재조회로 원본 일치, 화면 카드 즉시 반영. (마일스톤 `id`·`createdBy` 불변 대조는 스크립트 보강으로 추가됐다 — 기록된 증거에는 없다.)
- 증거: `reports/20261024-gd331-ap06-streak-update.json`, `reports/gd331-ap06/after-update.png`·`after-restore.png`, 스크립트 `scripts/verifyGd331Ap06Update.py`.

## AP05 — 미측정 유지

일일 정책 3건이 전부 적용 중·과거라 미래 예약 표본이 없다. 표본을 만드는 AP02 생성은 예약 삭제 API가 없어 영구 잔존하므로 수행하지 않았다(사용자 결정). 표본이 생기면 같은 절차로 측정한다.

## 알림 — N01 읽기·N02 읽음·UI 통합

- **N01 커서 페이징**: size=5로 `nextCursor` 종단 추적 — 5쪽·23건, `createdAt` 내림차순, id 중복 0, `totalElements` 일치.
- **N01 `isRead` 필터**: false 7·true 16·합계 23 일치, 필터 결과 전부 미읽음.
- **빈 목록**: ADMIN 계정(알림 0건)으로 API total 0·`nextCursor:null`, `/my-notifications`에서 '새 알림이 없어요' 렌더 확인.
- **드로어**: 미읽음 배지(`알림, 읽지 않음 7개`)·목록 요청 200·'모두 읽기' 컴포넌트 존재 확인(N03 호출은 승인 범위 밖이라 미수행).
- **`/my-notifications`**: 1쪽 20건 → '2페이지' 클릭으로 서버 커서 추적 요청 200·3건, '읽지 않음' Segmented 필터 표시 6건(읽음 후 잔여).
- **N02**: 미읽음 1건 클릭 → PUT 200·`{id, isRead:true}` → `linkUrl` 내부 이동(`/events/{id}` 계열, 래플 이벤트라 `EventDetailPage`가 `/time-raffle/{id}`로 안내) → 무효화 재조회로 벨 미읽음 7→6.
- 콘솔 오류 0건. 증거: `reports/20261024-gd331-notifications.json`, `reports/gd331-notifications/*.png`, 스크립트 `scripts/verifyGd331Notifications.py`.

## 관측 불가로 남긴 항목

- 발표→알림 생성 도착 트리거: 서버 이벤트 없이 유발 불가 — 기존 알림의 존재로 생성 파이프라인 동작을 추정할 뿐 도착 순간은 미관측.
- N03 전체 읽음: 승인 범위 밖 쓰기라 버튼 존재만 확인.
- AP05 200: 위 '미측정 유지' 참조.

## 재실행 주의

- `verifyGd331Notifications.py`는 증거를 읽어 완료 체크·N02 쓰기를 건너뛰는 재개 가드가 있다 — 신규 쓰기는 별도 승인 필요.
- `verifyGd331Ap06Update.py`는 대상 정책의 현재값을 GET으로 기록하지만 다이얼로그 필드('3단계 보상 장수'=28일) 매핑을 가정한다 — 정책 마일스톤 구성이 바뀌면 재확인.
- 두 스크립트 모두 자기 증거 JSON을 덮어쓴다. cp949 콘솔은 체크명의 비-CP949 문자에서 `UnicodeEncodeError`를 낼 수 있으나 JSON은 save() 시점에 무손상.
