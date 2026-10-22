# GD-262 재개 측정 조건

## 비교 대상

- 원본은 dev `aa34107`, 후보는 기존 `perf/GD-262`에 dev를 머지한 `47d2b54`다. 제품 차이는 기존 사용자 경로 lazy 분리와 인접 회귀 테스트뿐이다.
- 작업은 전용 worktree, 원본은 detached worktree에 분리했다. 다른 브랜치·reports·원본 dev의 미커밋 변경은 수정 대상이 아니다.
- 첫 빌드의 Git Bash 경로 변환 오류를 피하도록 Node 자식 프로세스의 환경 변수로 `VITE_API_BASE_URL=/api`, `VITE_ENABLE_MSW=false`를 전달했다. `.env`·빌드 설정·의존성은 변경하지 않았다.
- 기존 Codex Playwright와 시스템 Chrome을 사용할 수 있어 측정 스크립트의 도구 로딩 경로는 변경하지 않았다.
- 양쪽 preview는 같은 후보 worktree의 측정 도구로 관측한다. 원시 JSON의 `environment.commit`·`diffHash`는 도구 실행 폴더의 상태이며 원본 빌드의 소스 식별자가 아니다. 제공한 빌드의 소스·index·전체 자산 해시는 `controlled3-build-identities.json`으로 대조한다.

- 장시간 수집 중 dev가 `9ffbf4f`로 진행했다. GD-263 증거와 GD-290 공통 입력 스타일은 다른 세션의 작업으로 보존하며, 측정 시작 때 확정한 aa34107/47d2b54 쌍을 유지한다. 이후 dev를 포함한 성능과 구분하고 PR에 제한을 명시한다.

## 고정 응답

- 기존 fixture 3종의 SHA-256은 과거 inventory와 일치했다. 원본 파일은 덮어쓰지 않는다.
- dev에 추가된 E06 `eventId`·`status=ACCEPTED` 조회는 기존 응답에 없어 재생기가 502로 차단했다.
- `prepareGd262Fixture.mjs`는 기존 E06 전체 16건의 완전성을 확인한 뒤 기존 계약의 필터 응답을 재구성한다. 추가 실서버 요청은 없다. 원본·파생 파일 해시는 별도로 기록한다.
- 주 측정은 마지막 응모권 이력 커서까지 있는 pages fixture에서 파생한다. 101건 실험은 기존 101건 fixture에서 별도 파생한다. 다른 fixture의 표본은 비교·합산하지 않는다.
- 65초 체류에서는 배너 회전에 필요한 E03 4건이 추가로 누락됐다. 별도 복사본에서 `--capture=true`로 해당 4건의 GET 200 응답만 명시적으로 수집하고 파일을 고정했다. 기존 응답과 수집 시각이 다른 합성 통제 자료이며 실서버 전후 비교가 아니다. 체류 양쪽은 이 별도 fixture로 다시 실행하고 주 측정과 합산하지 않는다. `controlled3-dwell-fixture-inventory.json`에 출처·추가 경로 해시·수집 시각을 기록한다.
- 사용자 전환 검증용 USER_B는 USER_A의 복제와 합성 잔액 137을 가진 대조군이며 실제 USER_B 응답이 아니다. 헤더 격리·잔액 교체를 검증하며 서버 인증·권한이나 B의 전체 도메인 정합성을 입증하지 않는다.
- fixture 원문·실제 식별자·이름·헤더·응답 본문은 Git 밖 임시 폴더에만 둔다. inventory에는 해시·건수만 기록한다.

## 표본 설계

| 실험           | 조건                                                     | 버전별 표본                            |
| -------------- | -------------------------------------------------------- | -------------------------------------- |
| 통제 전체 화면 | 11개 화면 × cold/transition/revisit5/revisit35           | 조건별 1회 × 3배치, 워밍업 0           |
| 홈 주 검증     | cold, before-1/after-1/after-2/before-2/before-3/after-3 | 실행별 워밍업 1회 제외 10회, 합계 30회 |
| 65초 체류      | home, dwell65                                            | 1회 × 3배치, 워밍업 0                  |
| 미션 모달      | missions, missionModal                                   | 1회 × 3배치, 워밍업 0                  |
| 다음 페이지    | tickets·notifications, nextPage                          | 각각 1회 × 3배치, 워밍업 0             |
| 데스크톱       | home·events·entries, cold                                | 각각 1회 × 3배치, 워밍업 0             |
| 101건          | events, cold, 별도 fixture                               | 1회 × 3배치, 워밍업 0                  |

GET 재생만 허용하며 미수집 요청은 502다. 실서버 대체 경로는 없다. 직렬 실행하며 preview는 5188/5189, 측정 중계는 5191을 사용한다.

## 해석 한계

- p95는 nearest-rank다. n=3에서는 최댓값, n=30에서는 오름차순 29번째다. 작은 차이의 통계적 유의성을 주장하지 않는다. 실패·NA는 별도로 집계한다.
- 중계 API 시간은 요청별 50ms를 넣은 합성 응답이며 실서버 API p95·BE 내부 처리 시간이 아니다. 브라우저 API 왕복과 화면 준비 시간도 별도 지표다.
- 기존 화면 준비 끝점은 기대 문구·스켈레톤 종료·XHR 완료 후 이중 requestAnimationFrame이다. 모든 업무 값·이미지의 광학적 완성을 보장하지 않는다. 잘못된 API base의 첫 시도에는 오류 화면을 성공으로 센 표본도 있어 해당 시도 전체를 진단 자료로 제외한다.
- FCP·관측 LCP는 cold에만 기록한다. LCP는 준비 시점까지 관측한 값으로 완전한 LCP·INP·CLS나 RUM이 아니다.
- 기존 측정기는 같은 context에서 cold 다음 transition을 실행하고 각 모드의 부모 화면에는 document navigation으로 진입한다. 따라서 transition은 미수신 동적 청크로의 첫 전환과 같지 않으며 Query 캐시가 document navigation을 넘어 보존되는 것도 아니다.
- Link 없음 등 NA 표본에 남은 요청은 대상 전환 이전의 부모 화면 준비 요청일 수 있다. 이를 대상 화면의 정상 조회 비용으로 해석하지 않는다.
- 기존 측정기는 체류 전에 성공 여부를 확정해 65초 중의 오류를 놓쳤다. `diagnostic-dwell-late-errors-*`는 양쪽 각각 24건의 502가 있어도 성공으로 표시된 진단 자료다. 성공 판정을 체류 후에도 다시 수행하도록 도구만 고쳤다. 기존 불완전 fixture의 오류가 실패로 집계되는 회귀 검사를 실행하며, 최종 체류 표본은 보완된 fixture로 양쪽을 다시 측정한다. 다른 모드의 표시 끝점·조회 정책은 바꾸지 않는다.
- `assetBytes`는 해당 document의 API 외 누적 encodedBodySize이며 전환 청크만의 전송량이 아니다. 별도 bundle의 `routeChunks`는 초기 그래프를 제외한 페이지·공유 JS의 정적 gzip 비용이다. 이미 받은 공유 청크가 있으면 작아지는 상한 쪽 참고치이며 HTTP 헤더·동적 게임 실행 청크는 포함하지 않는다.
- 101건 중 추가 73건은 CANCELED·imageUrl=null이다. 전체 페이지 수집 비용이며 101개 활성 카드나 사용자 부하 실험이 아니다.
- 실서버 응모·출석·게임 제출·발표·알림 생성, 실제 공개→화면 2초, 서버 내부 처리·사용자 부하·배포는 검증 대상이 아니다.

## 재현

실행 출력은 각 `controlled3-*.log`·JSON에 보존한다. 집계기는 표본 부족이나 브라우저·fixture·제한 조건 차이가 있으면 비교를 거부한다.

```text
node scripts/measureGd262Performance.mjs --self-test
node scripts/prepareGd262Fixture.mjs --self-test
node scripts/summarizeGd262Performance.mjs --self-test
node scripts/summarizeGd262Performance.mjs controlled3
```

과거 88f4970 자료와 wrongenv·missingfilter·envcheck·filtercheck는 이번 전후 표본에 섞지 않는다. 최종 채택·검증 결과는 주 보고서에 기록한다.
