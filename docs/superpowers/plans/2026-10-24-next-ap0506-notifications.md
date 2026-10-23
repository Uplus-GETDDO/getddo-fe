# 다음 세션 프롬프트 — AP05/AP06 200 실측 + 알림 통합 관측

아래를 새 세션의 시작 프롬프트로 사용한다.

---

Ureca-getddo 프로젝트 진행. jira 키는 별도 발급 예정 — 세션 시작 시 먼저 물어볼 것.

## 맥락

- 레포: `C:\Users\s_don\Desktop\Projects\Ureca-getddo\getddo-fe`, `dev` = `63e58a6`(GD-330 머지 완료)
- 공용 명세: `../getddo-spec`, 상태 문서: `docs/backend-integration-status.md`의 "GD-330 미실측 표본 재확인" 절
- 이전 보고서: `C:\Users\s_don\AppData\Roaming\devin\open-steps\reports\Ureca-getddo\latest.md` 복원 패킷·do_not을 먼저 읽는다

## 작업 1: AP05·AP06 200 실측 (쓰기 인수 — 사용자 승인 필요)

배경: 예약 출석 정책 수정 API(AP05 daily·AP06 streak)는 GD-261/GD-296에서 409 `ATTENDANCE-007`만 확인했고 200은 격리 데이터 부재로 미측정. 2026-10-24 재확인(`reports/20261023-gd330-spec-samples.json`)으로 연속 출석 정책에 **미래 `effectiveMonth` 예약 1건**이 존재해 수정 200 측정이 가능해졌다.

- 계약 원본: `../getddo-spec/05-api/attendance.md` AP05·AP06. FE 연결: `src/entities/attendance/api/admin.ts`, 수정 다이얼로그는 GD-282 연결분.
- **운영 데이터 쓰기다 — 세션에서 사용자 승인을 받은 뒤 진행.** 대상은 미래 예약 정책 1건뿐이며 수정 후 원복할 값을 사전에 기록한다.
- 절차: ① 예약 정책 현재 값을 GET으로 기록 ② 동일 다이얼로그 값 범위에서 유효한 변경 1회 PUT → 200·응답 봉투·필드 대조 ③ 원복 PUT → 200 확인 ④ 목록에 예약 카드로 남는지 화면 확인.
- 측정 패턴: `scripts/verifyGd330SpecSamples.py`·`scripts/serveLocalRealApi.mjs` 참조. 증거에는 policy id·작성자 원문 대신 마스킹된 표시만 남긴다.

## 작업 2: 알림 통합 관측

배경: `GET /v1/notifications/me` 배포 확인(23건·미읽음 7·전부 eventId 연결). 목록 조회는 가능하지만 **도착 트리거→드로어 표시** 시나리오는 아직 관측되지 않았다.

- 계약: `../getddo-spec/05-api/notification.md` N01~N03. FE: `src/entities/notification/api/queries.ts`(cursor 무한스크롤)·알림 드로어·읽음 처리 경로.
- 읽기 전용 관측 가능: 목록 cursor 페이징(nextCursor 재조회), `isRead` 필터, 알림 항목 `linkUrl` 네비게이션, 빈 목록 상태.
- 트리거 연동(당첨 발표→알림 도착)은 서버 이벤트가 필요 — 기존 데이터로 관측할 수 없으면 **가능 범위만 실측하고 나머지는 관측 불가로 기록**. 읽음 처리(N02 PATCH)는 쓰기라 승인 후 1건만.
- 추첨 발표 등 알림 생성 트리거를 직접 일으키지 않는다(운영 데이터 변경).

## 공통 규칙

- 브랜치 `feat/`·`fix/`+Jira 키, Conventional Commits 한글 제목, PR은 `dev` 대상·템플릿 전 항목.
- 실서버 프록시 검증: `scripts/serveLocalRealApi.mjs`(5196). dist는 `VITE_ENABLE_MSW=false`+배포 env 청크에서 추출한 `VITE_VIRTUAL_USERS_JSON`으로 빌드 — env 없는 `npm run build`가 로그인 버튼을 지우는 함정 주의.
- 증거 JSON에 실서버 userId·eventId·닉네임·사유 원문 금지(마스킹).
- 배포본 측정 전 청크 해시로 최신 빌드 확인.
- 검증: `npm run format:check`·`lint`·`test:ci`·`build` 전부 통과 후 커밋.
- 완료 선언 전 `verification-before-completion`, 보고는 `common-reporting-guide`, 마무리 시 `session-handoff`.
