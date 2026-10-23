# 다음 세션 프롬프트 — 프론트엔드 성능 최적화 (AP05/AP06·알림 작업 이후)

아래를 새 세션의 시작 프롬프트로 사용한다.

---

Ureca-getddo 프로젝트 진행. jira 키는 별도 발급 예정 — 세션 시작 시 먼저 물어볼 것.

## 맥락

- 레포: `C:\Users\s_don\Desktop\Projects\Ureca-getddo\getddo-fe`, `dev` 최신(GD-330 머지 완료로 Pretendard 셀프호스트·SEO 수정 적용됨)
- 기준선: `reports/20261023-gd328-baseline-lighthouse-login-mobile.json`(LH 12.8.2, perf 0.84) vs GD-330 머지 후 프로덕션 재측정 `reports/20261024-gd330-prod-lighthouse-login-*.json`(LH 13.5, perf 0.78~0.89 — 분산 존재)
- 이전 보고서: `C:\Users\s_don\AppData\Roaming\devin\open-steps\reports\Ureca-getddo\latest.md`의 복원 패킷·do_not을 먼저 읽는다

## 작업: `/login` 모바일 성능 잔여 최적화

GD-330에서 폰트 CDN 렌더블로킹을 제거했으나 프로덕션 모바일 perf는 0.8~0.89 구간이다. Lighthouse가 지목한 잔여:

- **미사용 JavaScript** — `vendor-*.js`(417KiB/139KiB gzip)·`index-*.js`(193KiB)·`react-*.js`에서 최대 ~900ms 절감 추정. 원인 후보: 초기 번들에 포함된 불필요 의존성, msw 청크(`msw-*.js` 420KiB)의 프로덕션 번들 포함 여부, 관리자 코드가 index 청크로 새는지 여부.
- **index CSS 195KiB** — 셀프호스트한 `@font-face` 92개가 index CSS에 합쳐짐. 분리(별도 stylesheet) 또는 필요 서브셋 축소 검토. 단 분리하면 별도 요청이 렌더블로킹이 될 수 있어 트레이드오프 평가 필요.
- 진단 도구: `vite build --mode` 분석, `rollup-plugin-visualizer` 같은 번들 분석기 도입은 **승인 게이트(새 dependency)** — 세션에서 먼저 묻는다. 수단이 없으면 `npx vite build` 출력 + 소스맵 기반 수동 분석으로 진행.
- 관리자 lazy 로딩은 이미 돼 있다(`adminRoutes.tsx` React.lazy) — 분리가 실제로 동작하는지 확인부터.

## 범위 제한

- **`--color-fg-brand` 등 색상 토큰 수정 금지** — GD-330에서 디자인 토큰 담당자에게 인계된 항목(`reports/20261023-gd330-color-contrast-handoff.md`). axe `color-contrast` 위반은 이 티켓 범위가 아니다.
- API 계약·스키마·auth 로직·환경 변수 정의 변경 금지. 무리한 최적화(과도한 코드 분할·폰트 제거)는 하지 않는다.
- 측정은 프로덕션(`getddo-fe.vercel.app`) 기준 — 머지 후 배포 반영을 청크 해시로 확인하고 같은 조건으로 전후 비교. 로컬 프록시 측정은 render-blocking 항목 목록 비교에만 유효(절대값 무의미).

## 공통 규칙

- 브랜치 `perf/GD-xxx`, Conventional Commits 한글 제목, PR은 `dev` 대상.
- 실서버 프록시 검증 함정: env 없는 `npm run build`가 `virtualUsersJson`을 지워 로그인 버튼이 사라진다 — 프록시 검증 dist는 `VITE_ENABLE_MSW=false`+배포 env 추출 JSON으로 빌드.
- 검증: `npm run format:check`·`lint`·`test:ci`·`build` 전부 통과 후 커밋.
- 완료 선언 전 `verification-before-completion`, 마무리 시 `session-handoff`로 `open-steps/reports/Ureca-getddo/latest.md` 갱신.
