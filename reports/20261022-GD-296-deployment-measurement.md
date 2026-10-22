# GD-296 배포 후 인수 잔여 실측 + GD-295 후속 검증 (2026-10-22)

- 측정 대상: `https://getddo-fe.vercel.app`(Vercel, 프록시 → `dzc8oneey9mmx.cloudfront.net`) + 로컬 실서버 프록시(`http://localhost:5196`, `origin/dev`=`4b6ffd6` 빌드 + `scripts/serveLocalRealApi.mjs`)
- 측정 계정: 테스트관리자(`X-User-Role: ADMIN`), 읽기 중심 — 승인 후 동일값 `PUT` 2건(AP05·AP06 수정 거절 확인)을 포함한다. 데이터 변경 0건은 값을 바꾸지 않는 동일값 요청이었고 직후 목록 재조회로 무결성을 확인했다는 뜻이며, 쓰기 요청 자체가 없었다는 뜻은 아니다.
- 원시 증거: `reports/20261022-GD-296-remaining-reads.json`(10 checks, 각 호출의 메서드·경로·HTTP·봉투·Zod·시각). 단 §2의 AP05·AP06 `PUT`·직후 재조회는 별도 수동 호출이라 호출 단위 레코드가 없고, GD-268의 `/admin/events` 목록·상세 호출도 집계 결과만 수록됐다 — 해당 주장은 원시 JSON에서 독립 검증이 불가한 요약 전용이다.
- 개인정보 정책: 응답 원문·답변 텍스트 미저장 — 건수·길이·식별자만 기록

## 1. 배포 식별 — GD-295 미배포

| 항목             | 배포본(Vercel)                        | 로컬 빌드(origin/dev `4b6ffd6`) |
| ---------------- | ------------------------------------- | ------------------------------- |
| 엔트리 청크      | `assets/index-Dx52IYfp.js`            | `assets/index-DhFlFJpY.js`      |
| 관리자 미션 청크 | `AdminMissionsPage-BakUPlkR.js`       | `AdminMissionsPage-rMJL_4bY.js` |
| 상세 렌더        | `main > section` 인라인 패널(구버전)  | `role=dialog` 모달(GD-295)      |
| 미션 상태 표시   | 영문 `ENDED`                          | 한글 `종료`                     |
| 확인 시각        | 2026-10-22 17:31·17:40·17:47 KST 불변 | —                               |

GD-295 머지(`4b6ffd6`, 17:16 KST) 후 반복 재확인에도 배포본 해시가 변하지 않아 **배포본 기준 모달 실측은 불가**로 기록한다. 이하 접근성 실측은 동일 커밋의 로컬 빌드 + 실서버 API로 대체 수행했다.

## 2. 읽기 실측 결과 (배포본 API)

| 항목                     | 호출                                                                                           | HTTP                 | Zod  | 결과                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------- | -------------------- | ---- | -------------------------------------------------------------------------------------------- |
| AM04 선택형 집계         | `GET /admin/missions/01a143a8-…-86677/survey-summary?from=2026-10-16&to=2026-10-22`            | 200                  | pass | 일별 합계 5건·선택지 합계 5건(커피 쿠폰 5, 나머지 0) — BE 대조값 5건 일치                    |
| AM05 서술 답변(주)       | `GET /admin/missions/01a143a8-…-b194cb/survey-answers?questionId=…&from=…&to=…&page=1&size=20` | 200                  | pass | totalElements 3 — BE 대조값 3건 일치                                                         |
| AM05 서술 답변(대체)     | `GET /admin/missions/01a143a8-…-fb668/survey-answers?questionId=…&from=…&to=…`                 | 200                  | pass | totalElements 2 — BE 대조값 2건 일치                                                         |
| AM01 + ENDED             | `GET /admin/missions?page=1&size=50` + `status=ENDED`                                          | 200                  | pass | ENDED 필터 8건, 종료 시각 경과 후에도 ACTIVE 잔존 0건 — `ENDED` 반영 확인(안내 문구와 일치)  |
| AP01 일일 정책           | `GET /admin/policies/attendance/daily?page=1&size=50`                                          | 200                  | pass | 3건 — 최신 `01a160ee` effectiveFrom 2026-10-22T15:00Z(예약, 윤태형 원복본)                   |
| AP03 연속 정책           | `GET /admin/policies/attendance/streak?page=1&size=50`                                         | 200                  | pass | 2건(2026-10 적용 중·2026-11 예약)                                                            |
| AR01 차단 목록           | `GET /admin/abuse-cases?page=1&size=5`                                                         | 404                  | —    | **미배포 유지** — 완료로 표시하지 않음                                                       |
| AR02 차단 상세           | —                                                                                              | —                    | —    | 목록 404로 상세를 요청하지 않음 — 배포 여부 미검증으로 기록                                  |
| INACTIVE 표본            | `GET /admin/users?status=INACTIVE&page=1&size=5`                                               | 200                  | pass | totalElements 0 — 표본 없어 비활성 동작 검증 불가(기록만)                                    |
| GD-268 +1분 추첨         | `GET /admin/events` 목록 + 이벤트별 `drawScheduledAt`                                          | 200×15               | pass | **15건 전부 `drawScheduledAt - endsAt` = 60초** — 마감+1분 신기준 배포 반영 확인             |
| AP05 일일 정책 수정 거절 | `PUT /admin/policies/attendance/daily/01a15a5e-b2eb-…` (적용 중, 동일값)                       | 409 `ATTENDANCE-007` | —    | 적용 중 정책 수정 거절 확인 — 직후 목록 재조회로 값 무결성 확인. 원시 JSON 미수록(요약 전용) |
| AP06 연속 정책 수정 거절 | `PUT /admin/policies/attendance/streak/01a143a8-b6de-7f01-…` (2026-10 적용 중, 동일값)         | 409 `ATTENDANCE-007` | —    | 동일 — 무결성 확인. 원시 JSON 미수록(요약 전용)                                              |

- ENDED 안내 문구: 목록 페이지에 "종료 시각이 지난 미션은 서버 주기 처리로 최대 약 1분 뒤 '종료'로 표시됩니다" 노출 확인(로컬 GD-295 빌드, 배포본은 구버전이라 해당 문구 없음).

## 3. GD-295 미션 상세 모달 — 브라우저 접근성 실측 (로컬 빌드 + 실서버)

측정 경로: `npm run build`(`VITE_API_BASE_URL=/api`, `VITE_ENABLE_MSW=false`, 실계정 JSON) → `node scripts/serveLocalRealApi.mjs 5196` → Playwright 브라우저, 테스트관리자 로그인 → `/admin/missions` → `[DRAW-DEMO-V2] 지급근거 2-4`·`[DEMO-20261016] 08 설문` 상세.

| 점검 항목                | 결과                                                                                                                                                                                                    | 수정 필요                                                          |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 상세가 진짜 모달로 렌더  | ✅ `role=dialog`, 인라인 `section` 없음, 배경 전체 `aria-hidden`                                                                                                                                        | —                                                                  |
| dialog 이름·설명         | ✅ `aria-labelledby`→h2 "미션 상세", `aria-describedby`→설명 단락                                                                                                                                       | —                                                                  |
| 구역 aria-label          | ✅ `기본 정보`·`문항`·`설문 집계`·`서술 답변` section 라벨 존재                                                                                                                                         | —                                                                  |
| Tab 순서                 | ✅ Close → 상세 다시 조회 → 집계 시작일 → 종료일 → 집계 조회 (시각 순서와 일치)                                                                                                                         | —                                                                  |
| 포커스 가둠              | ✅ 마지막 요소 Tab → 첫 요소 순환, 첫 요소 Shift+Tab → 마지막 순환                                                                                                                                      | —                                                                  |
| 시각 포커스 표시         | ✅ X 버튼 등 포커스 링 확인(스크린샷 `gd296-dialog-focus.png`)                                                                                                                                          | —                                                                  |
| ESC 닫힘                 | ✅ 닫힘 동작 정상                                                                                                                                                                                       | —                                                                  |
| **닫은 뒤 포커스 복귀**  | ✅ **수정 완료** — 실측 시 `body` 유실을 확인해 `detailTriggerRef`+`onClose` `requestAnimationFrame` 복원으로 고쳤고, ESC 후 트리거 버튼 복귀를 재확인·단위 테스트 추가                                 | 완료(WCAG 2.4.3 취지)                                              |
| 닫기 버튼 접근성 이름    | ✅ 이름 존재("Close", shadcn 기본 sr-only)                                                                                                                                                              | 참고 — 한글 UI에서 영문 "Close"이므로 "닫기" 권장(공용 dialog.tsx) |
| `aria-modal` 속성        | ○ 없음 — 대신 형제 요소 전체 `aria-hidden`로 차폐(Radix 동작)                                                                                                                                           | —                                                                  |
| 320px(sm 미만) 전체 화면 | ✅ 다이얼로그 320×568 전체 화면, 클리핑·가로 오버플로 없음, 스크롤 정상                                                                                                                                 | —                                                                  |
| 기본 기간 자동 집계      | ✅ 오픈 즉시 `survey-summary`(미션 기간 기본값) 자동 GET — 집계 조회 버튼 없이 `status` live region에 "조회 결과입니다."+일별 목록 표시. AM04 미션은 기본 기간(10-16~11-15)에서 커피 쿠폰 5건 자동 표시 | —                                                                  |
| 서술 답변 자동 조회      | ✅ FREE_TEXT 문항 존재 시 `survey-answers` 자동 GET                                                                                                                                                     | —                                                                  |
| `status` live region     | ✅ "조회 결과입니다."가 `role=status`로 노출                                                                                                                                                            | —                                                                  |
| 콘솔 오류                | ✅ 0건(오류·경고)                                                                                                                                                                                       | —                                                                  |

## 4. 저장소 잔여물 정리

| 대상                                            | 확인                                                                                                          | 처리                                        |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `.claude-worktrees/feat-gd-294-stale`           | 미등록 디렉터리, `.git` 없이 `node_modules`만 — 폐기물                                                        | 삭제                                        |
| `.claude-worktrees/perf-gd-262` + `perf/GD-262` | 미커밋 0건, 팁 `294a128`이 스쿼시 커밋 `40e9fda`(PR #131)와 내용 동일, 잔여 diff는 후속 머지(GD-263·GD-290)분 | worktree remove + `branch -D`               |
| `.claude-worktrees/test-gd-264` + `test/GD-264` | 미커밋 0건, 팁 `0d72a98`이 스쿼시 커밋 `f0f2245`(PR #132)와 내용 동일                                         | 동일                                        |
| `.claude-worktrees/gd262-baseline-dev`          | detached `aa34107`, 미커밋·미추적·고유 산출물 없음                                                            | worktree remove                             |
| 잠금 원인                                       | stale `vite preview` 2개(PID 10876·39636, 포트 5188·5189)가 `perf-gd-262`를 점유                              | taskkill 후 디렉터리 삭제                   |
| 잔여                                            | —                                                                                                             | `.claude-worktrees/`에 `test-gd-296`만 존재 |

## 5. 실측 불가·보류 항목 (사유 기록)

- 추첨 실패 resume — 실패 실행 표본 없음(관측만 가능, 데이터 생성은 금지 범위)
- INACTIVE 계정 동작 — 표본 0건
- 자정/월 경계 정책 적용 — 관측 시점 미도래 + 윤태형 원복으로 해당 예약 데이터 해소
- AP05·AP06 200 — 미적용 예약 정책이 윤태형 원복본(`01a160ee`, `2026-11` 연속 세트)뿐이라 격리 `[TEST-` 데이터 부재로 미측정. 409는 승인 후 동일값 PUT 1회씩으로 측정 완료(위 §2)
- 배포본 GD-295 — 미배포(위 §1). 배포 갱신 후 모달 실측 재확인 필요
