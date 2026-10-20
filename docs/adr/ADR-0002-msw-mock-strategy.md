# ADR-0002: 백엔드 미준비 기간 MSW 목업 전략

- 상태: accepted
- 날짜: 2026-09-17

## 맥락

백엔드는 별도 레포에서 개발 중이고 API 계약이 확정되지 않았던 시점에 목업 전략을 채택했다. 현재는 `../getddo-spec/05-api/`의 개별 채택 계약·현행 구현과 검토 대기 초안이 함께 존재한다. 프론트 개발을 백엔드 완료까지 미룰 수 없고, 목업 없이 개발하면 연동 시점에 대량 수정이 발생한다.

## 결정

백엔드 미준비 기간에는 MSW로 API를 목업하고, 실제 연동 단계에서는 미배포 도메인만 목업하는 하이브리드로 전환한다. 현재 등록 범위는 [CONTEXT.md](../CONTEXT.md)의 실연동 하이브리드 항목을 따른다. 계약 채택을 배포 완료로 해석하지 않는다.

- `VITE_ENABLE_MSW=true`일 때만 활성화 (`shared/config/env.ts`의 `env.enableMsw`)
- 핸들러는 `src/mocks/handlers/`에 도메인별 파일로 분리 (`entry.ts`, `draw.ts`, `ticket.ts` …)
- 목업 응답은 공용 명세의 확정 요구사항·도메인 정책과 `05-api/`의 개별 채택·현행 구현 범위를 우선한다. 미합의 항목(`../getddo-spec/00-requirements/pending-decisions.md`)과 나머지 검토 대기 초안은 임의로 확정하지 않는다
- 실제 응답 검증은 `entities/*/model/`의 Zod 스키마가 담당한다. 스키마·목업이 공용 확정 계약과 충돌하면 공용 계약에 맞춰 조정하며, 스키마가 정책 원본을 대체하지 않는다

## 결과

- 백엔드 없이 전 화면 개발·시연이 가능하다
- 목업은 "계약의 임시 구현"일 뿐 진실이 아니다 — 계약 확정 시 핸들러를 수정하며 드리프트를 해소한다
- MSW 환경에서만 세션이 `ADMIN`으로 시작하는 등 목업 전용 분기가 존재한다 (`entities/user/model/session.ts`). 실제 업무 요청의 사용자 문맥은 `05-api/common.md`의 `X-User-ID`·`X-User-Role` 필수 및 조건부 `X-User-Membership` 검증을 따른다
