# ADR-0007: 실시간 응모 현황 갱신 방식

- 상태: accepted
- 날짜: 2026-10-08

## 맥락

실시간 응모 현황(기능 요구사항 7절)은 현재 이벤트 목록·상세 쿼리(`useEventList`, `useEvent`)가 `queryPresets.realtime`(30초 폴링)으로 이벤트 전체를 다시 받아 `participantCount`·`usedTicketCount`를 표시한다. 문제는 다음과 같다.

- 현황 수치를 위해 이벤트 목록 전체(모든 페이지)를 30초마다 다시 받는다
- `participantCount`·`usedTicketCount`는 spec의 `EventSummary`에 없는 필드다. spec은 현황을 E03 `GET /events/{eventId}/statistics`(`EntryStatistics`)로 분리했다
- spec이 요구하는 "본인 차감 수"(`mySpentTicketCount`)를 표시할 경로가 없다

spec의 E03 계약(`../getddo-spec/05-api/entry.md`)은 GD-200 현행 구현으로 지표를 기록한다. `participantCount`는 접수 완료 응모자의 중복 제거 수, `totalSpentTicketCount`는 그 응모자들의 누적 차감 합계(반환은 빼지 않음), `mySpentTicketCount`는 본인 누적 차감(미응모·관리자는 0)이며 거절 이력은 포함하지 않는다. 재조회 방식은 제안이며 SSE·WebSocket은 필수 계약이 아니다. 갱신 주기는 기능 요구사항 7절에서 구현 담당자에게 위임했으므로 FE는 폴링을 선택한다.

## 결정

- 현황은 **E03 전용 조회 훅** `useEntryStatistics(eventId)`로 받는다. `entities/entry/api/`에 두고 `ENTRIES_KEY` 하위 키(`[...ENTRIES_KEY, 'statistics', eventId]`)를 쓴다
- 폴링 정책:
    - 응모 진행 중(`open`) 이벤트만 `queryPresets.realtime`(30초) 폴링한다. 그 외 상태는 폴링하지 않는다
    - 백그라운드 탭에서는 폴링하지 않는다 (TanStack Query 기본값 `refetchIntervalInBackground: false` 유지)
    - 응모 성공 직후 `features/enterEvent`가 E03·E07·T01 쿼리를 무효화한다 (spec 제안과 동일)
- 위젯(`widgets/liveEntryStatus`)은 `event` 대신 `eventId`를 받아 훅을 직접 호출한다. 표시 항목은 응모자 수, 총 차감 응모권 수, 본인 차감 수이고 당첨 확률은 표시하지 않는다
- 이벤트 목록·상세 쿼리의 폴링은 현황이 아닌 **상태 전환 감지** 용도로만 남긴다 (예: `closed → drawn`). 현황 수치 표시는 이벤트 쿼리에서 읽지 않는다
- 백엔드가 SSE를 도입하면 `useEntryStatistics` 내부만 `setQueryData` 방식으로 교체한다 — 위젯·소비자 코드는 바뀌지 않는다

## 결과

- 현황 수치용 요청이 보이는 이벤트별 E03 1건으로 한정된다. 다만 이벤트 목록·상세 폴링(상태 전환 감지용, 전체 페이지 조회)은 계속되므로 전체 API 호출량이 줄어든다고 보지 않는다 — E03 요청이 추가되는 만큼 오히려 늘 수 있다. 홈 배너처럼 여러 이벤트를 동시에 보이는 화면은 현재 보이는 슬라이드만 `enabled`로 폴링한다
- 30초 주기는 서버 부하 확인 대상이다 — 백엔드가 다른 값을 요청하면 `queryPresets.realtime` 한 곳만 바꾼다
- 후속 작업(GD-124에서 처리): E03 MSW 핸들러 추가, `useEntryStatistics` 구현, `LiveEntryStatus`·`RaffleDetailHero`·`LiveRaffleCard`·`FeaturedEventCard` 전환, `eventSchema`의 임시 필드 제거

## 2026-10-20 보완: GD-247 행별 조회와 갱신 실패

- 마감 목록 E03은 이미 렌더링된 preview 3행/full 첫 10행만 최초 조회하고 폴링하지 않는다. 더보기는 새 행만 조회한다. DOM에 렌더링된 범위를 뜻하며 viewport 감지는 추가하지 않는다.
- E09 최초 전체 조회는 결과 필터·건수·최근 당첨일 계산 때문에 유지한다. 이후 주기 조회는 내 응모 목록의 필터·정렬·더보기 적용 후 행, 마이페이지 최근 4행의 접수 이벤트로 제한한다. 같은 이벤트 ID는 중복 조회하지 않는다.
- 다중 E09의 캐시가 있으면 재마운트·네트워크 재연결로 전체를 다시 읽지 않는다. 표시 행의 30초 폴링, 명시적 전체 재조회, 기존 mutation 무효화는 유지한다. 집계는 각 결과의 마지막 조회 기준이며 가장 오래된 성공 시각과 부분 조회 실패를 안내한다. 캐시가 제거된 뒤에는 최초 전체 조회가 다시 필요하다.
- E08은 `isPublished=true` 또는 `displayStatus=CANCELED/NO_ENTRANTS`에서 폴링을 종료한다. 미공개 취소·응모자 없음에는 발표 대기 카드 대신 종료 안내를 표시한다.
- E09는 기존처럼 `isPublished=true`에서 종료한다. `CANCELED`가 이벤트 취소인지 개별 당첨 취소인지, 미공개 `NOT_ENTERED/PENDING`이 종결인지 현재 입력만으로 확정하지 않는다. 이 의미와 과거 `NO_ELIGIBLE_ENTRANTS`의 종결성은 계약 협의 대상으로 남긴다. 판단을 위해 행마다 E08 요청을 추가하지 않는다.
- E03/E08/E09에만 오류 정책을 적용한다. 400/401/403/404 및 Zod 스키마 오류는 자동 재시도와 후속 폴링을 중단한다. 네트워크/5xx는 1초 뒤 1회 재시도하고 활성·비종결 행은 이후 30초 주기로 재조회한다. 명시적 재시도는 가능하다.
- 429는 `Retry-After` 초 또는 HTTP-date를 해석해 대기 후 1회 재시도한다. 헤더가 없거나 해석되지 않으면 FE 복구 정책으로 30초 대기한다. 서버가 이 조회 API에 빈도 제한을 적용한다고 새로 단정하지 않는다. 대기 근거를 Query 수명에 보존해 수동 조회·재마운트가 HTTP 요청으로 우회하지 못하게 한다. 대기는 `performance.now()` 경과 시간으로 계산해 가상 시계·시스템 시각 변경과 분리한다.
- 최초 로딩과 기존 값이 있는 갱신을 구분한다. 실패해도 캐시 값·성공 시각을 유지하고 최초 실패/갱신 실패·서버 대기·재시도를 안내한다. 결과를 받기 전 전체 집계를 0건·미당첨·발표 대기로 확정하지 않는다. E03 다중 조회도 기존 성공값을 null로 가리지 않는다.
- E03/E08/E09 queryFn은 AbortSignal을 Axios에 전달한다. 키는 유지하고 다른 이벤트의 이전 값을 현재 행으로 표시하지 않는다. 전역 기본 재시도·포커스 설정, SSE/WebSocket·dependency·전역 상태는 변경하지 않는다.
- E01 20개 페이지 및 E06 50개 페이지 전체 수집과 CANCELED→closed 화면 모델 변경은 [통합 로드맵 L5](../superpowers/plans/2026-10-20-backend-integration-roadmap.md)의 후속이다(구 R08 잔여·R04). 전체 결과 집계/결과 필터 서버 계약과 발표 후 revision 변경 감지도 L2/L5에서 별도로 확인한다. GD-247의 완료 범위로 확대하지 않는다.

검증 근거는 [GD-247 검증 보고서](../../reports/20261020-GD-247-row-polling.md)에 기록한다. 완료 계획은 2026-10-21 문서 정리로 삭제했으며 Git 이력에서 확인할 수 있다.

## GD-259 L5 상태 보완

화면 변환에서 CANCELED를 canceled, 대상 없는 종료를 ended로 분리했다. DRAW_CONFIRMED/REDRAWING은 공개 전 사용자에게 발표 대기로 유지한다. E03/E08/E09의 위 종료·429·표시 행 정책은 변경하지 않았다. 이벤트 취소를 E09 CANCELED의 단독 종결 근거로 확대하지 않는다. E01/E02·출석/미션·신규 관리자 읽기에는 기존 오류/Retry-After 가드를 재사용하며 전역 설정은 변경하지 않았다.
