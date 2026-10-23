# GD-317 AR01/AR02 배포 후 실측 + 320px 넘침 수정 검증 (2026-10-23)

범위: `GET /api/v1/admin/abuse-cases`(AR01)·`GET /api/v1/admin/abuse-cases/{caseId}`(AR02) 배포 실측, `/admin/abuse-cases` 화면 인수 검증.

## 결론

- API 실측 10개 점검 전부 통과 → [증거](20261023-gd317-abuse-reads.json)
- 배포 화면 실데이터 렌더·필터·드로어 evidence 전부 통과 → [증거](20261023-gd317-abuse-page.json)
- 320px 넘침 결함 발견·수정 — 수정 후 로컬 빌드(실서버 프록시)에서 넘침 0 확인

## API 실측 (배포본, 관리자 문맥)

| 점검                           | 결과                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AR01 목록 200·Page 봉투·Zod    | pass — `totalElements: 10`, 기본 페이지 20                                                                                                                                |
| 기본 정렬 `blockedAt` 내림차순 | pass — 9/9 비교                                                                                                                                                           |
| `userId` 필터                  | pass — 1건, 대상만                                                                                                                                                        |
| `sourceType=ENTRY` 필터        | pass — 전부 ENTRY                                                                                                                                                         |
| `from`/`to` blockedAt 범위     | pass — 경계 포함·범위 외 제외                                                                                                                                             |
| 빈 결과(`userId` 미존재)       | 200 + `items: []`, `totalElements: 0`                                                                                                                                     |
| `size` 오류·`sourceType` 오류  | 400 `COMMON-002`                                                                                                                                                          |
| 잘못된 UUID                    | 400 `COMMON-005`                                                                                                                                                          |
| AR02 상세 200·evidence         | pass — `ruleVersion:"v1"`, `triggerScope:"USER"`, `requestLimit:20`, `rejectedCount:20`, `rejectionThreshold:20` (응답에 `thresholdReached:true` 추가 필드 — 스키마 통과) |
| 없는 이력 / 잘못된 ID          | 404 `ABUSE-002` / 400 `COMMON-005`                                                                                                                                        |
| USER 역할 목록·상세            | 403 `ABUSE-001`                                                                                                                                                           |
| 문맥 헤더 없음                 | 401 `USER-003`                                                                                                                                                            |

미관측 잔여: `triggerScope=EVENT`·`eventId` 연결 표본은 현재 실데이터에 없다(전부 USER·null). 표본이 생기면 재확인한다.

## 화면 검증 (배포본 Playwright)

- 관리자 로그인 → `/admin/abuse-cases` 실데이터 10행 렌더 (`list.png`)
- `userId` 필터 → 1행 (`filtered.png`)
- 행 클릭 → 상세 드로어 evidence 필드 표시 (`drawer.png`)
- 콘솔·페이지 오류 없음

## 320px 넘침 — 발견·수정·재검증

- 배포본 실측: `documentElement` 넘침 **109px**, 표 카드 `overflow-hidden`으로 행 끝(상세 버튼) 도달 불가 (`w320.png`)
- 원인: ① `DateRangeFilter` 상자 고유 폭 413px → 문서 넘침 ② 표 카드 가로 스크롤 영역 부재
- 수정: 공용 `DateRangeFilter` 줄바꿈(`filter-fields.tsx`) + 표 카드 GD-316 패턴(`overflow-x-auto` + `role="region"` + `tabIndex`) 적용(`AbuseCaseTable.tsx`)
- 재검증(로컬 빌드 + 실서버 프록시, `w320-after.png`):

| 페이지               | 수정 전 | 수정 후                                                |
| -------------------- | ------- | ------------------------------------------------------ |
| `/admin/abuse-cases` | 109     | **0** — region 존재, 표 가로 스크롤·키보드 포커스 동작 |
| `/admin/events`      | 109     | **0** — 공용 컴포넌트 수정 효과                        |
| `/admin/entries`     | 86      | 77 — 잔여는 페이지 고유 요소                           |
| `/admin/tickets`     | 91      | 91 — 표 영역 내 스크롤 미적용                          |

잔여 넘침은 `entries`·`tickets` 표의 페이지별 스크롤 미적용이 원인이며 GD-317 범위 밖 — 후속 티켓에서 `AbuseCaseTable`에 적용한 지역 패턴을 같은 방식으로 적용하면 된다.

## 재현 방법

```bash
# API 실측 (읽기 전용, GET만)
L6_DEPLOY_URL=https://getddo-fe.vercel.app node scripts/verifyGd317AbuseReads.mjs

# 화면 검증 (Playwright)
python scripts/verifyGd317AbusePage.py
```
